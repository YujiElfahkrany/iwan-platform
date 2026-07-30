// Wrapper around Chrome's built-in on-device Translator API (Chrome 138+,
// desktop only — phones don't ship the models).
//
// Shape verified July 2026 against
// https://developer.chrome.com/docs/ai/translator-api and
// https://developer.mozilla.org/en-US/docs/Web/API/Translator :
// a global `Translator` with static `availability({sourceLanguage,targetLanguage})`
// and `create({sourceLanguage,targetLanguage,monitor})`, instances exposing
// `translate(text)` and `destroy()`, and the `monitor` callback receiving an
// object that emits `downloadprogress` events carrying `loaded` (0..1).
//
// Nothing here throws: on a browser without the API, or a language pair it
// refuses, callers get `null` and fall back to showing the original text.

import { normalizeLang } from "@/lib/captions";

/**
 * Values `availability()` can report. "unavailable" means the browser cannot
 * do this pair at all; the other three are all usable (the model may still
 * need downloading, which `create()` waits for).
 */
type TranslatorAvailability = "unavailable" | "downloadable" | "downloading" | "available";

/**
 * The download monitor handed to `create()`. Declared locally because the DOM
 * lib has no types for this API yet; we only use the one event we need.
 */
interface TranslatorDownloadMonitor {
  addEventListener(type: "downloadprogress", listener: (event: { loaded: number }) => void): void;
}

interface TranslatorInstance {
  translate(input: string): Promise<string>;
  destroy(): void;
}

interface TranslatorApi {
  availability(options: {
    sourceLanguage: string;
    targetLanguage: string;
  }): Promise<TranslatorAvailability>;
  create(options: {
    sourceLanguage: string;
    targetLanguage: string;
    monitor?: (monitor: TranslatorDownloadMonitor) => void;
  }): Promise<TranslatorInstance>;
}

function translatorApi(): TranslatorApi | null {
  if (typeof self === "undefined") return null;
  return (self as unknown as { Translator?: TranslatorApi }).Translator ?? null;
}

/** Whether this browser has the built-in translator at all. */
export function translatorSupported(): boolean {
  return translatorApi() !== null;
}

/**
 * One entry per language pair. Values are the in-flight or settled creation
 * promise, so concurrent callers share a single translator.
 */
const translators = new Map<string, Promise<TranslatorInstance | null>>();

/**
 * Pairs the browser itself ruled out. This is the only permanent verdict:
 * anything else is treated as retryable, because the most common creation
 * failure is a missing user gesture (Chrome requires one before it will
 * download a language pack) and that clears the moment the user clicks
 * something.
 */
const impossiblePairs = new Set<string>();

/** When a retryable creation last failed, so retries don't run per utterance. */
const lastFailureAt = new Map<string, number>();
const RETRY_COOLDOWN_MS = 5000;

async function createTranslator(
  key: string,
  sourceLanguage: string,
  targetLanguage: string,
  onProgress?: (loaded: number) => void,
): Promise<TranslatorInstance | null> {
  const api = translatorApi();
  if (!api) return null;
  try {
    const availability = await api.availability({ sourceLanguage, targetLanguage });
    if (availability === "unavailable") {
      // A real platform verdict: this pair will never work here.
      impossiblePairs.add(key);
      return null;
    }
    return await api.create({
      sourceLanguage,
      targetLanguage,
      monitor: onProgress
        ? (monitor) =>
            monitor.addEventListener("downloadprogress", (event) => onProgress(event.loaded))
        : undefined,
    });
  } catch (err) {
    // Usually "no user activation" — the caller was a speech callback rather
    // than a click. Deliberately NOT cached as impossible: forget the attempt so
    // a later try (after any user gesture) can succeed, but note the time so we
    // don't hammer create() once per sentence.
    console.error("[captions] could not create translator", sourceLanguage, targetLanguage, err);
    translators.delete(key);
    lastFailureAt.set(key, Date.now());
    return null;
  }
}

/**
 * Get (or lazily create) a translator for a language pair. Accepts full BCP-47
 * tags like "ar-SA" and reduces them to the base language the API expects.
 * Resolves to `null` when translation is impossible — never rejects.
 */
export function getTranslator(
  source: string,
  target: string,
  onProgress?: (loaded: number) => void,
): Promise<TranslatorInstance | null> {
  const sourceLanguage = normalizeLang(source);
  const targetLanguage = normalizeLang(target);
  // Same language in and out: there is nothing to translate.
  if (sourceLanguage === targetLanguage) return Promise.resolve(null);

  const key = `${sourceLanguage}>${targetLanguage}`;
  if (impossiblePairs.has(key)) return Promise.resolve(null);

  const cached = translators.get(key);
  if (cached) return cached;

  // Back off briefly after a retryable failure, so a cold pair doesn't call
  // create() again for every single caption line.
  const failedAt = lastFailureAt.get(key);
  if (failedAt !== undefined && Date.now() - failedAt < RETRY_COOLDOWN_MS) {
    return Promise.resolve(null);
  }
  lastFailureAt.delete(key);

  const pending = createTranslator(key, sourceLanguage, targetLanguage, onProgress);
  translators.set(key, pending);
  return pending;
}

/**
 * Translate one caption line. Resolves to `null` instead of throwing when the
 * browser can't do it, and gives up after `timeoutMs` so a slow first-time
 * model download never holds a caption back — the original text is shown
 * meanwhile and later lines get the translation once the model is warm.
 */
export function translateText(
  text: string,
  source: string,
  target: string,
  timeoutMs = 1500,
): Promise<string | null> {
  if (!translatorSupported()) return Promise.resolve(null);

  const work = (async () => {
    const translator = await getTranslator(source, target);
    if (!translator) return null;
    return await translator.translate(text);
  })().catch((err: unknown) => {
    console.error("[captions] translation failed", err);
    return null;
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), timeoutMs);
  });

  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

/** Release every cached translator (call when leaving the room). */
export function destroyAllTranslators(): void {
  for (const pending of translators.values()) {
    pending
      .then((translator) => translator?.destroy())
      .catch((err: unknown) => console.error("[captions] failed to destroy translator", err));
  }
  translators.clear();
}
