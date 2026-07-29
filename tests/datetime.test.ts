import { describe, expect, it } from "vitest";
import { formatSessionDate, PLATFORM_TIMEZONE } from "@/lib/datetime";

// 2026-07-20T18:00:00Z is 21:00 in Cairo (UTC+3, EEST) on Monday 20 July 2026.
const ISO = "2026-07-20T18:00:00.000Z";

describe("formatSessionDate", () => {
  it("formats in the given timezone (Cairo)", () => {
    const s = formatSessionDate(ISO, "en", PLATFORM_TIMEZONE);
    expect(s).toContain("Mon");
    expect(s).toContain("20");
    expect(s).toContain("Jul");
    expect(s).toContain("21:00");
  });

  it("formats in UTC when asked", () => {
    const s = formatSessionDate(ISO, "en", "UTC");
    expect(s).toContain("18:00");
  });

  it("is independent of the machine timezone when timeZone is given", () => {
    expect(formatSessionDate(ISO, "en", "America/New_York")).toContain("14:00");
  });

  it("uses Arabic locale formatting for ar", () => {
    const s = formatSessionDate(ISO, "ar", PLATFORM_TIMEZONE);
    expect(s).toContain("يوليو");
  });

  it("uses Russian locale formatting for ru", () => {
    const s = formatSessionDate(ISO, "ru", PLATFORM_TIMEZONE);
    expect(s).toContain("июл");
  });

  it("falls back to English formatting for unknown locales", () => {
    // Guards the fallback path: an unmapped locale must never throw or
    // silently switch language based on server environment.
    const s = formatSessionDate(ISO, "fr", PLATFORM_TIMEZONE);
    expect(s).toContain("Jul");
  });
});
