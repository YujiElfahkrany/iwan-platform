"use client";

// Live captions for one participant: transcribe our own microphone with the
// browser's speech recognizer, translate finals on-device when the browser can,
// send everything over Signaling, and keep the short display list for the
// overlay. All the protocol/display decisions live in lib/captions.ts — this
// hook is only the browser-API glue around them.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  applyCaption,
  buildCaptionMessage,
  normalizeLang,
  shouldSendInterim,
  translationTargets,
  visibleCaptions,
  SPEECH_LANG_TAGS,
  type CaptionEntry,
  type CaptionMessage,
  type CaptionTranslations,
  type PlatformLocale,
  type RoomMessage,
} from "@/lib/captions";
import { destroyAllTranslators, getTranslator, translateText, translatorSupported } from "./translator";

/** Sender key for our own lines, which we show locally without a round-trip. */
const LOCAL_SENDER = "me";
/** Two lines is what fits above the video controls without covering faces. */
const VISIBLE_LINES = 2;
/** Recognizer restart backoff: instant first, then 1s doubling up to this. */
const MAX_RESTART_DELAY_MS = 15_000;

export type TranslatorStatus = "idle" | "preparing" | "ready" | "unavailable";

export interface UseCaptionsOptions {
  publish: (msg: RoomMessage) => void;
  displayName: string;
  micOn: boolean;
  /** UI language of this viewer — what their captions get translated into. */
  viewerLocale: PlatformLocale;
  /** Language this participant says they are speaking. */
  spokenLocale: PlatformLocale;
  /** Whether this participant opted in to transcribing their own microphone. */
  transcribing: boolean;
  /** Called once per own finished sentence, for transcript persistence. */
  onFinalLine?: (line: { at: Date; name: string; lang: string; text: string }) => void;
}

export interface Captions {
  /** Already TTL-filtered, oldest first, at most two lines. */
  captions: CaptionEntry[];
  /** Feed a caption received over Signaling into the display list. */
  ingest: (publisherId: string, msg: CaptionMessage) => void;
  sttSupported: boolean;
  /** The user (or their browser policy) refused microphone transcription. */
  sttDenied: boolean;
  translatorStatus: TranslatorStatus;
}

// Minimal local types for the Web Speech API: the DOM lib does not reliably
// declare it, and we only touch the handful of members we use.
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: { readonly transcript: string };
}
interface SpeechRecognitionEventLike {
  readonly resultIndex: number;
  readonly results: { readonly length: number; readonly [index: number]: SpeechRecognitionResultLike };
}
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event: { error: string }) => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useCaptions({
  publish,
  displayName,
  micOn,
  viewerLocale,
  spokenLocale,
  transcribing,
  onFinalLine,
}: UseCaptionsOptions): Captions {
  const [entries, setEntries] = useState<CaptionEntry[]>([]);
  // The clock the TTL is measured against; bumped by the tick below and by
  // every incoming caption, so a line never inherits a stale "now".
  const [now, setNow] = useState(() => Date.now());
  const [sttDenied, setSttDenied] = useState(false);
  const [sttSupported] = useState(() => speechRecognitionCtor() !== null);
  const [translatorAvailable] = useState(() => translatorSupported());
  // Which spoken language we finished warming translators for, and whether any
  // of them worked. Everything else about the status is derived from it.
  const [prepared, setPrepared] = useState<{ locale: PlatformLocale; ok: boolean } | null>(null);

  const publishRef = useRef(publish);
  const displayNameRef = useRef(displayName);
  const onFinalLineRef = useRef(onFinalLine);
  useEffect(() => {
    publishRef.current = publish;
    displayNameRef.current = displayName;
    onFinalLineRef.current = onFinalLine;
  }, [publish, displayName, onFinalLine]);

  /** Utterance counter, monotonic across recognizer restarts. */
  const seqRef = useRef(0);

  const addCaption = useCallback((sender: string, msg: CaptionMessage) => {
    const at = Date.now();
    setNow(at);
    setEntries((list) => applyCaption(list, sender, msg, at));
  }, []);

  const ingest = useCallback(
    (publisherId: string, msg: CaptionMessage) => {
      addCaption(publisherId, msg);

      // Gap filling: senders that can translate attach translations themselves,
      // which is what phones rely on. If this line arrived without ours and we
      // do have the built-in translator, produce it locally.
      const needsTranslation =
        msg.final && !msg.tr?.[viewerLocale] && normalizeLang(msg.lang) !== viewerLocale;
      if (!needsTranslation || !translatorAvailable) return;

      void translateText(msg.text, msg.lang, viewerLocale).then((translated) => {
        if (!translated) return;
        setEntries((list) =>
          list.map((entry) =>
            entry.sender === publisherId && entry.seq === msg.seq
              ? { ...entry, tr: { ...entry.tr, [viewerLocale]: translated } }
              : entry,
          ),
        );
      });
    },
    [addCaption, viewerLocale, translatorAvailable],
  );

  const captions = useMemo(
    () => visibleCaptions(entries, now).slice(-VISIBLE_LINES),
    [entries, now],
  );

  // Re-evaluate the TTL once a second, but only while something is on screen:
  // an idle room does no work at all.
  const hasVisible = captions.length > 0;
  useEffect(() => {
    if (!hasVisible) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasVisible]);

  // Warm up the translators needed to *read* other people, which is a different
  // set from the ones needed to send. This has to be kicked off by a real user
  // gesture: Chrome refuses to create a translator (and so to fetch the language
  // pack) from a plain callback, and an incoming caption arrives in a message
  // handler. Without this a viewer who never speaks could never translate
  // anything, and every line stayed in the speaker's language.
  useEffect(() => {
    if (!translatorAvailable) return;
    let done = false;

    function prepare() {
      void Promise.all(
        translationTargets(viewerLocale).map((source) => getTranslator(source, viewerLocale)),
      ).then((results) => {
        // Keep listening until one pair actually works: the first gesture can
        // still fail (e.g. the pack download is refused) and a later click may
        // succeed.
        if (!results.some((translator) => translator !== null)) return;
        done = true;
        window.removeEventListener("pointerdown", prepare);
        window.removeEventListener("keydown", prepare);
      });
    }

    window.addEventListener("pointerdown", prepare);
    window.addEventListener("keydown", prepare);
    return () => {
      if (done) return;
      window.removeEventListener("pointerdown", prepare);
      window.removeEventListener("keydown", prepare);
    };
  }, [translatorAvailable, viewerLocale]);

  // Warm up the translators this speaker will need, so the first sentence isn't
  // the one that pays for the model download.
  useEffect(() => {
    if (!translatorAvailable || !transcribing) return;
    let cancelled = false;
    void Promise.all(
      translationTargets(spokenLocale).map((target) => getTranslator(spokenLocale, target)),
    ).then((results) => {
      if (cancelled) return;
      setPrepared({ locale: spokenLocale, ok: results.some((translator) => translator !== null) });
    });
    return () => {
      cancelled = true;
    };
  }, [translatorAvailable, transcribing, spokenLocale]);

  // "preparing" simply means: we are transcribing but the warm-up for this
  // language has not reported back yet.
  const translatorStatus: TranslatorStatus = !translatorAvailable
    ? "unavailable"
    : !transcribing
      ? "idle"
      : prepared?.locale !== spokenLocale
        ? "preparing"
        : prepared.ok
          ? "ready"
          : "unavailable";

  // The recognizer itself. Recreated whenever it should start/stop or the
  // spoken language changes — the Web Speech API only reads `lang` at start().
  useEffect(() => {
    if (!transcribing || !micOn || !sttSupported || sttDenied) return;
    const Recognition = speechRecognitionCtor();
    if (!Recognition) return;

    const lang = SPEECH_LANG_TAGS[spokenLocale];
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = lang;

    let stopped = false;
    let restartTimer: ReturnType<typeof setTimeout> | null = null;
    let restartDelayMs = 0;
    let lastEndAt = 0;
    let lastInterimSentAt: number | null = null;

    function start() {
      try {
        recognition.start();
      } catch (err) {
        // start() throws if the recognizer is somehow already running; the end
        // handler will schedule another attempt.
        console.error("[captions] could not start speech recognition", err);
      }
    }

    function emitInterim(text: string) {
      const at = Date.now();
      if (!shouldSendInterim(lastInterimSentAt, at)) return;
      lastInterimSentAt = at;
      const msg = buildCaptionMessage({
        seq: seqRef.current,
        final: false,
        lang,
        text,
        name: displayNameRef.current,
      });
      addCaption(LOCAL_SENDER, msg);
      publishRef.current(msg);
    }

    function emitFinal(text: string) {
      const seq = seqRef.current;
      seqRef.current += 1;
      lastInterimSentAt = null;
      const name = displayNameRef.current;

      // Show and record our own line straight away; translating it for
      // ourselves would only delay the feedback we already understand.
      addCaption(LOCAL_SENDER, buildCaptionMessage({ seq, final: true, lang, text, name }));
      onFinalLineRef.current?.({ at: new Date(), name, lang, text });

      void (async () => {
        const targets = translationTargets(lang);
        const translated = await Promise.all(
          targets.map(async (target) => [target, await translateText(text, lang, target)] as const),
        );
        const tr: CaptionTranslations = {};
        for (const [target, out] of translated) {
          if (out) tr[target] = out;
        }
        // One send per sentence, carrying whatever translations arrived in time,
        // so receivers without the translator (phones) still read their own
        // language.
        publishRef.current(buildCaptionMessage({ seq, final: true, lang, text, name, tr }));
      })();
    }

    recognition.onresult = (event) => {
      restartDelayMs = 0; // the recognizer is clearly healthy
      let finalText = "";
      let interimText = "";
      // Results accumulate; only those from resultIndex on are new.
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const transcript = result[0]?.transcript ?? "";
        if (result.isFinal) finalText += transcript;
        else interimText += transcript;
      }
      const final = finalText.trim();
      const interim = interimText.trim();
      // A batch can contain the end of one sentence and the start of the next;
      // the interim will come again in the following event.
      if (final) emitFinal(final);
      else if (interim) emitInterim(interim);
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        console.error("[captions] speech recognition refused:", event.error);
        stopped = true;
        setSttDenied(true);
        recognition.abort();
        return;
      }
      // "no-speech", "aborted", "network" and friends are followed by onend,
      // which restarts us; only note the ones that are not routine silence.
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn("[captions] speech recognition error:", event.error);
      }
    };

    recognition.onend = () => {
      if (stopped) return;
      const at = Date.now();
      // Chrome ends the recognizer on every pause, which is normal and should
      // restart instantly. But an end that lands within a second of the last
      // one means it is failing to run at all, so back off instead of spinning.
      if (at - lastEndAt < 1000) {
        restartDelayMs = restartDelayMs === 0 ? 1000 : Math.min(restartDelayMs * 2, MAX_RESTART_DELAY_MS);
      } else {
        restartDelayMs = 0;
      }
      lastEndAt = at;
      restartTimer = setTimeout(() => {
        if (!stopped) start();
      }, restartDelayMs);
    };

    start();

    return () => {
      stopped = true;
      if (restartTimer) clearTimeout(restartTimer);
      recognition.onresult = null;
      recognition.onend = null;
      recognition.onerror = null;
      recognition.abort();
    };
  }, [transcribing, micOn, sttSupported, sttDenied, spokenLocale, addCaption]);

  // Models are per-room state; free them when the participant leaves.
  useEffect(() => () => destroyAllTranslators(), []);

  return { captions, ingest, sttSupported, sttDenied, translatorStatus };
}
