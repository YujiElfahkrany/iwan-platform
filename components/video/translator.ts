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
 * promise, so concurrent callers share a single translator, and a pair that
 * turned out to be impossible stays cached as `null` instead of being retried
 * on every utterance.
 */
const translators = new Map<string, Promise<TranslatorInstance | null>>();

async function createTranslator(
  sourceLanguage: string,
  targetLanguage: string,
  onProgress?: (loaded: number) => void,
): Promise<TranslatorInstance | null> {
  const api = translatorApi();
  if (!api) return null;
  try {
    const availability = await api.availability({ sourceLanguage, targetLanguage });
    if (availability === "unavailable") return null;
    return await api.create({
      sourceLanguage,
      targetLanguage,
      monitor: onProgress
        ? (monitor) =>
            monitor.addEventListener("downloadprogress", (event) => onProgress(event.loaded))
        : undefined,
    });
  } catch (err) {
    // The model download was blocked or failed, or the browser rejected the
    // pair at creation time. Returning null keeps this pair negatively cached:
    // retrying per utterance would just stall captions again and again.
    console.error("[captions] translator unavailable", sourceLanguage, targetLanguage, err);
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
  const cached = translators.get(key);
  if (cached) return cached;

  const pending = createTranslator(sourceLanguage, targetLanguage, onProgress);
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
