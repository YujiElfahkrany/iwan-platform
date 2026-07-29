/** Canonical platform timezone (also used by lib/schedule.ts session math). */
export const PLATFORM_TIMEZONE = "Africa/Cairo";

/**
 * Formats a session date/time for display or emails.
 * Always pass an explicit timeZone so the output never depends on the
 * server's timezone (prod servers run in UTC, dev machines may not).
 */
/** Maps a platform locale to the BCP 47 tag used for date formatting. */
const DATE_FORMAT_LOCALES: Record<string, string> = {
  ar: "ar-EG",
  ru: "ru-RU",
  en: "en-GB",
};

export function formatSessionDate(
  iso: string | Date,
  locale: string,
  timeZone: string
): string {
  return new Date(iso).toLocaleDateString(DATE_FORMAT_LOCALES[locale] ?? "en-GB", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  });
}
