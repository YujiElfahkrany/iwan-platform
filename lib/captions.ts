// Caption protocol + display logic for the in-call translated captions.
// Everything here is pure: the browser APIs (SpeechRecognition, Translator,
// Agora RTM) live in components/video/, and this module decides what to send,
// what a received payload means, and what to show.

export const PLATFORM_LOCALES = ["en", "ar", "ru"] as const;
export type PlatformLocale = (typeof PLATFORM_LOCALES)[number];

/** Speech-recognizer language tags per platform locale. */
export const SPEECH_LANG_TAGS: Record<PlatformLocale, string> = {
  en: "en-US",
  ar: "ar-SA",
  ru: "ru-RU",
};

/** Minimum gap between two interim (non-final) caption sends per speaker. */
export const INTERIM_INTERVAL_MS = 1000;
/** A caption line disappears after this long without an update. */
export const CAPTION_TTL_MS = 6000;
/** Upper bound on caption entries kept in memory per room. */
export const MAX_CAPTIONS = 20;

export type CaptionTranslations = Partial<Record<PlatformLocale, string>>;

export interface CaptionMessage {
  v: 1;
  type: "caption";
  /** Per-sender utterance id; interims and the final of one utterance share it. */
  seq: number;
  final: boolean;
  /** BCP-47 tag of the spoken language, e.g. "ar-SA". */
  lang: string;
  /** Original transcript. */
  text: string;
  /** Sender display name (avoids a uid→name lookup on receivers). */
  name: string;
  /** Sender-attached translations, finals only. */
  tr?: CaptionTranslations;
}

export interface RecordingMessage {
  v: 1;
  type: "recording";
  active: boolean;
}

export type RoomMessage = CaptionMessage | RecordingMessage;

export function buildCaptionMessage(opts: {
  seq: number;
  final: boolean;
  lang: string;
  text: string;
  name: string;
  tr?: CaptionTranslations;
}): CaptionMessage {
  const msg: CaptionMessage = {
    v: 1,
    type: "caption",
    seq: opts.seq,
    final: opts.final,
    lang: opts.lang,
    text: opts.text,
    name: opts.name,
  };
  if (opts.tr && Object.keys(opts.tr).length > 0) msg.tr = opts.tr;
  return msg;
}

function isTranslations(value: unknown): value is CaptionTranslations {
  if (typeof value !== "object" || value === null) return false;
  return Object.entries(value).every(
    ([locale, text]) =>
      (PLATFORM_LOCALES as readonly string[]).includes(locale) && typeof text === "string",
  );
}

/**
 * Parse an incoming RTM payload. Returns null for anything that is not a
 * well-formed v1 message — including unknown message types, so newer clients
 * can add types without breaking older ones.
 */
export function parseRoomMessage(raw: unknown): RoomMessage | null {
  if (typeof raw !== "string") return null;
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof data !== "object" || data === null) return null;
  const msg = data as Record<string, unknown>;
  if (msg.v !== 1) return null;

  if (msg.type === "caption") {
    if (
      typeof msg.seq !== "number" ||
      typeof msg.final !== "boolean" ||
      typeof msg.lang !== "string" ||
      typeof msg.text !== "string" ||
      typeof msg.name !== "string"
    ) {
      return null;
    }
    if (msg.tr !== undefined && !isTranslations(msg.tr)) return null;
    const parsed: CaptionMessage = {
      v: 1,
      type: "caption",
      seq: msg.seq,
      final: msg.final,
      lang: msg.lang,
      text: msg.text,
      name: msg.name,
    };
    if (msg.tr !== undefined) parsed.tr = msg.tr as CaptionTranslations;
    return parsed;
  }

  if (msg.type === "recording") {
    if (typeof msg.active !== "boolean") return null;
    return { v: 1, type: "recording", active: msg.active };
  }

  return null;
}

/** "ar-SA" → "ar": the base language, lowercased. */
export function normalizeLang(lang: string): string {
  return lang.split("-")[0].toLowerCase();
}

/** Platform locales a sender should translate into (everything but its own). */
export function translationTargets(speakerLang: string): PlatformLocale[] {
  const base = normalizeLang(speakerLang);
  return PLATFORM_LOCALES.filter((locale) => locale !== base);
}

/** Throttle decision for interim results; finals are always sent. */
export function shouldSendInterim(lastSentAt: number | null, now: number): boolean {
  return lastSentAt === null || now - lastSentAt >= INTERIM_INTERVAL_MS;
}

export interface CaptionEntry {
  /** RTM publisher id (Mongo user id string) — dedupe key together with seq. */
  sender: string;
  seq: number;
  final: boolean;
  lang: string;
  text: string;
  name: string;
  tr?: CaptionTranslations;
  updatedAt: number;
}

/**
 * Fold an incoming caption into the display list: interims update their entry
 * in place, a final replaces its interim, and anything arriving for an
 * utterance that already finalized is dropped (out-of-order delivery).
 */
export function applyCaption(
  list: CaptionEntry[],
  sender: string,
  msg: CaptionMessage,
  now: number,
): CaptionEntry[] {
  const index = list.findIndex((entry) => entry.sender === sender && entry.seq === msg.seq);
  const entry: CaptionEntry = {
    sender,
    seq: msg.seq,
    final: msg.final,
    lang: msg.lang,
    text: msg.text,
    name: msg.name,
    tr: msg.tr,
    updatedAt: now,
  };
  if (index >= 0) {
    if (list[index].final) return list;
    const next = [...list];
    next[index] = entry;
    return next;
  }
  const next = [...list, entry];
  return next.length > MAX_CAPTIONS ? next.slice(next.length - MAX_CAPTIONS) : next;
}

/** Entries still fresh enough to show. */
export function visibleCaptions(list: CaptionEntry[], now: number): CaptionEntry[] {
  return list.filter((entry) => now - entry.updatedAt <= CAPTION_TTL_MS);
}

/** Best text for the viewer: their translation if present, else the original. */
export function pickDisplayText(
  entry: Pick<CaptionEntry, "lang" | "text" | "tr">,
  viewerLocale: PlatformLocale,
): string {
  return entry.tr?.[viewerLocale] ?? entry.text;
}
