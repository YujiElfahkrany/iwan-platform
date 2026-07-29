// Pure tests for the caption protocol and display logic (lib/captions.ts).
// Coverage ceiling: SpeechRecognition, the Chrome Translator API, and the
// Agora RTM SDK are browser/network APIs unavailable in vitest, and this repo
// does not mock — the hooks/components built on top of this module are
// covered by the manual QA checklist in the feature doc instead.
import { describe, expect, it } from "vitest";
import {
  applyCaption,
  buildCaptionMessage,
  CAPTION_TTL_MS,
  INTERIM_INTERVAL_MS,
  MAX_CAPTIONS,
  normalizeLang,
  parseRoomMessage,
  pickDisplayText,
  shouldSendInterim,
  translationTargets,
  visibleCaptions,
  type CaptionEntry,
  type CaptionMessage,
} from "@/lib/captions";

function captionMsg(overrides: Partial<CaptionMessage> = {}): CaptionMessage {
  return {
    v: 1,
    type: "caption",
    seq: 1,
    final: false,
    lang: "en-US",
    text: "hello",
    name: "Teacher",
    ...overrides,
  };
}

describe("parseRoomMessage", () => {
  it("accepts a valid caption message", () => {
    const msg = captionMsg({ final: true, tr: { ar: "مرحبا" } });
    expect(parseRoomMessage(JSON.stringify(msg))).toEqual(msg);
  });

  it("accepts a valid recording message", () => {
    const msg = { v: 1, type: "recording", active: true };
    expect(parseRoomMessage(JSON.stringify(msg))).toEqual(msg);
  });

  it("returns null for non-JSON input", () => {
    expect(parseRoomMessage("not json {")).toBeNull();
  });

  it("returns null for an unsupported protocol version", () => {
    expect(parseRoomMessage(JSON.stringify(captionMsg({ v: 2 as never })))).toBeNull();
  });

  it("returns null for an unknown message type (forward compatibility)", () => {
    expect(parseRoomMessage(JSON.stringify({ v: 1, type: "poll", question: "?" }))).toBeNull();
  });

  it.each([
    ["missing text", { ...captionMsg(), text: undefined }],
    ["missing seq", { ...captionMsg(), seq: undefined }],
    ["text not a string", { ...captionMsg(), text: 42 }],
    ["seq not a number", { ...captionMsg(), seq: "1" }],
    ["final not a boolean", { ...captionMsg(), final: "yes" }],
    ["name not a string", { ...captionMsg(), name: null }],
    ["recording active not a boolean", { v: 1, type: "recording", active: "on" }],
  ])("returns null when a required field is invalid (%s)", (_label, bad) => {
    expect(parseRoomMessage(JSON.stringify(bad))).toBeNull();
  });

  it("returns null for non-string input", () => {
    expect(parseRoomMessage(42)).toBeNull();
    expect(parseRoomMessage(null)).toBeNull();
  });
});

describe("buildCaptionMessage", () => {
  it("stamps protocol version 1 and echoes the fields", () => {
    const msg = buildCaptionMessage({
      seq: 3,
      final: true,
      lang: "ar-SA",
      text: "مرحبا",
      name: "Ahmed",
      tr: { en: "hello" },
    });
    expect(msg).toEqual({
      v: 1,
      type: "caption",
      seq: 3,
      final: true,
      lang: "ar-SA",
      text: "مرحبا",
      name: "Ahmed",
      tr: { en: "hello" },
    });
  });

  it("omits tr when no translations are supplied", () => {
    const msg = buildCaptionMessage({ seq: 1, final: false, lang: "en-US", text: "hi", name: "T" });
    expect("tr" in msg).toBe(false);
  });

  it("omits tr when the supplied translations object is empty", () => {
    const msg = buildCaptionMessage({ seq: 1, final: true, lang: "en-US", text: "hi", name: "T", tr: {} });
    expect("tr" in msg).toBe(false);
  });
});

describe("normalizeLang", () => {
  it("strips the region subtag and lowercases", () => {
    expect(normalizeLang("en-US")).toBe("en");
    expect(normalizeLang("ar-SA")).toBe("ar");
    expect(normalizeLang("RU")).toBe("ru");
  });

  it("passes a bare language code through", () => {
    expect(normalizeLang("ru")).toBe("ru");
  });
});

describe("translationTargets", () => {
  it("excludes the speaker's own base language", () => {
    expect(translationTargets("ar-SA")).toEqual(["en", "ru"]);
  });

  it("returns the two other platform locales for each locale", () => {
    expect(translationTargets("en-US")).toEqual(["ar", "ru"]);
    expect(translationTargets("ru-RU")).toEqual(["en", "ar"]);
  });

  it("returns all platform locales for a language outside the platform", () => {
    expect(translationTargets("fr-FR")).toEqual(["en", "ar", "ru"]);
  });
});

describe("shouldSendInterim", () => {
  it("suppresses an interim sent within the throttle interval", () => {
    expect(shouldSendInterim(1000, 1000 + INTERIM_INTERVAL_MS - 1)).toBe(false);
  });

  it("allows an interim once the interval has elapsed", () => {
    expect(shouldSendInterim(1000, 1000 + INTERIM_INTERVAL_MS)).toBe(true);
  });

  it("allows the first interim (no previous send)", () => {
    expect(shouldSendInterim(null, 5)).toBe(true);
  });
});

describe("applyCaption", () => {
  const now = 10_000;

  it("appends a new caption entry", () => {
    const list = applyCaption([], "u1", captionMsg(), now);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ sender: "u1", seq: 1, text: "hello", updatedAt: now });
  });

  it("replaces an interim with its final in place", () => {
    let list = applyCaption([], "u1", captionMsg({ text: "hel" }), now);
    list = applyCaption(list, "u2", captionMsg({ seq: 9 }), now);
    list = applyCaption(list, "u1", captionMsg({ final: true, text: "hello" }), now + 500);
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({ sender: "u1", final: true, text: "hello", updatedAt: now + 500 });
  });

  it("ignores an interim that arrives after its final", () => {
    let list = applyCaption([], "u1", captionMsg({ final: true, text: "done" }), now);
    list = applyCaption(list, "u1", captionMsg({ text: "don" }), now + 100);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ final: true, text: "done", updatedAt: now });
  });

  it("dedupes duplicate finals with the same sender and seq", () => {
    let list = applyCaption([], "u1", captionMsg({ final: true }), now);
    list = applyCaption(list, "u1", captionMsg({ final: true }), now + 100);
    expect(list).toHaveLength(1);
  });

  it("keeps the same seq from different senders as independent entries", () => {
    let list = applyCaption([], "u1", captionMsg(), now);
    list = applyCaption(list, "u2", captionMsg(), now);
    expect(list).toHaveLength(2);
  });

  it("caps the list and drops the oldest entry beyond the cap", () => {
    let list: CaptionEntry[] = [];
    for (let seq = 1; seq <= MAX_CAPTIONS + 1; seq++) {
      list = applyCaption(list, "u1", captionMsg({ seq, final: true }), now + seq);
    }
    expect(list).toHaveLength(MAX_CAPTIONS);
    expect(list[0].seq).toBe(2);
  });
});

describe("visibleCaptions", () => {
  it("hides entries not updated within the caption TTL", () => {
    const base = 10_000;
    let list = applyCaption([], "u1", captionMsg({ seq: 1, final: true }), base);
    list = applyCaption(list, "u1", captionMsg({ seq: 2, final: true }), base + CAPTION_TTL_MS);
    const visible = visibleCaptions(list, base + CAPTION_TTL_MS + 1);
    expect(visible.map((c) => c.seq)).toEqual([2]);
  });

  it("keeps an entry updated exactly at the TTL boundary", () => {
    const base = 10_000;
    const list = applyCaption([], "u1", captionMsg(), base);
    expect(visibleCaptions(list, base + CAPTION_TTL_MS)).toHaveLength(1);
  });
});

describe("pickDisplayText", () => {
  it("prefers the translation matching the viewer locale", () => {
    const entry = { lang: "ar-SA", text: "مرحبا", tr: { en: "hello", ru: "привет" } };
    expect(pickDisplayText(entry, "en")).toBe("hello");
  });

  it("returns the original when the speaker already speaks the viewer's language", () => {
    const entry = { lang: "en-US", text: "hello", tr: { ar: "مرحبا" } };
    expect(pickDisplayText(entry, "en")).toBe("hello");
  });

  it("falls back to the original when no translation exists (receiver without translator)", () => {
    const entry = { lang: "ar-SA", text: "مرحبا" };
    expect(pickDisplayText(entry, "ru")).toBe("مرحبا");
  });
});
