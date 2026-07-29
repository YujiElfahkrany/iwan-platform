import { PLATFORM_TIMEZONE as TIMEZONE } from "@/lib/datetime";

function weekdayInTz(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "long" })
    .format(date)
    .toLowerCase();
}

function sameDayInTz(a: Date, b: Date): boolean {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(a) === fmt.format(b);
}

/**
 * The class session occurrence that falls on the same platform-timezone
 * calendar day as `day`, or null if the class has no session that day.
 * Follows the same occurrence convention as nearestClassSessionTime:
 * recurring classes repeat on daysOfWeek at startTime's time-of-day.
 */
export function classSessionOnDay(
  cls: { startTime: Date | string; daysOfWeek?: string[] },
  day: Date
): Date | null {
  const start = new Date(cls.startTime);
  const days = cls.daysOfWeek ?? [];
  if (days.length === 0) {
    return sameDayInTz(start, day) ? start : null;
  }

  // An occurrence keeps startTime's UTC time-of-day, so the occurrence on
  // `day`'s local calendar day can sit on the UTC date before or after it
  // (a session at 01:30 local has the previous day's UTC date). Checking
  // the three surrounding UTC dates covers every alignment.
  for (let i = -1; i <= 1; i++) {
    const candidate = new Date(day);
    candidate.setUTCDate(candidate.getUTCDate() + i);
    candidate.setUTCHours(start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), 0);
    if (candidate.getTime() < start.getTime()) continue; // course hasn't started yet
    if (!days.includes(weekdayInTz(candidate))) continue;
    if (sameDayInTz(candidate, day)) return candidate;
  }
  return null;
}

/**
 * The class session occurrence nearest to `now`.
 * One-off classes use their startTime; recurring classes repeat on daysOfWeek
 * at startTime's time-of-day. Returns null if no session applies.
 */
export function nearestClassSessionTime(
  cls: { startTime: Date | string; daysOfWeek?: string[] },
  now: Date = new Date()
): Date | null {
  const start = new Date(cls.startTime);
  const days = cls.daysOfWeek ?? [];
  if (days.length === 0) return start;

  let best: Date | null = null;
  for (let i = -1; i <= 7; i++) {
    const candidate = new Date(now);
    candidate.setUTCDate(candidate.getUTCDate() + i);
    candidate.setUTCHours(start.getUTCHours(), start.getUTCMinutes(), start.getUTCSeconds(), 0);
    if (candidate.getTime() < start.getTime()) continue; // course hasn't started yet
    if (!days.includes(weekdayInTz(candidate))) continue;
    if (!best || Math.abs(candidate.getTime() - now.getTime()) < Math.abs(best.getTime() - now.getTime())) {
      best = candidate;
    }
  }
  return best ?? (start.getTime() >= now.getTime() ? start : null);
}

const JOIN_LEAD_MS = 10 * 60 * 1000;

/**
 * Resolves a booking's session time and whether it is joinable now.
 * Joinable from 10 minutes before the session starts until it ends.
 */
export function sessionJoinInfo(
  slot: { startTime: Date | string; endTime: Date | string } | null | undefined,
  cls: { startTime: Date | string; endTime: Date | string; daysOfWeek?: string[] } | null | undefined,
  now: Date = new Date()
): { sessionTime: Date | null; canJoin: boolean } {
  let sessionTime: Date | null = null;
  let sessionEnd: Date | null = null;

  if (slot) {
    sessionTime = new Date(slot.startTime);
    sessionEnd = new Date(slot.endTime);
  } else if (cls) {
    sessionTime = nearestClassSessionTime(cls, now);
    if (sessionTime) {
      const durationMs = new Date(cls.endTime).getTime() - new Date(cls.startTime).getTime();
      sessionEnd = new Date(sessionTime.getTime() + Math.max(durationMs, 0));
    }
  }

  const canJoin =
    !!sessionTime &&
    !!sessionEnd &&
    now.getTime() >= sessionTime.getTime() - JOIN_LEAD_MS &&
    now.getTime() <= sessionEnd.getTime();

  return { sessionTime, canJoin };
}
