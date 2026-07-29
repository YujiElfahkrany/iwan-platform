import { describe, expect, it } from "vitest";
import { classSessionOnDay, nearestClassSessionTime, sessionJoinInfo } from "@/lib/schedule";

// All instants are chosen at 10:00 UTC (13:00 in Africa/Cairo during summer,
// UTC+3), so the Cairo calendar day and weekday match the UTC ones and the
// tests do not depend on the machine's timezone.
// Weekday anchors: 2026-07-06 and 2026-08-03 are Mondays.
const d = (iso: string) => new Date(iso);

describe("nearestClassSessionTime", () => {
  it("returns startTime for a one-off class (no daysOfWeek), regardless of now", () => {
    const cls = { startTime: "2026-07-06T10:00:00.000Z" };
    expect(nearestClassSessionTime(cls, d("2026-07-20T18:00:00.000Z"))).toEqual(
      d("2026-07-06T10:00:00.000Z")
    );
    expect(nearestClassSessionTime({ ...cls, daysOfWeek: [] }, d("2026-06-01T00:00:00.000Z"))).toEqual(
      d("2026-07-06T10:00:00.000Z")
    );
  });

  it("returns the nearest past occurrence on a matching Cairo weekday, at start's time-of-day", () => {
    const cls = {
      startTime: "2026-07-06T10:30:00.000Z", // Monday
      daysOfWeek: ["monday", "wednesday"],
    };
    // now: Tuesday 2026-07-14 09:00 UTC. Mon Jul 13 10:30 is ~22.5h away,
    // Wed Jul 15 10:30 is ~25.5h away -> Monday wins.
    const result = nearestClassSessionTime(cls, d("2026-07-14T09:00:00.000Z"));
    expect(result).toEqual(d("2026-07-13T10:30:00.000Z"));
  });

  it("returns the nearest future occurrence when it is closer than the previous one", () => {
    const cls = {
      startTime: "2026-07-06T10:00:00.000Z", // Monday
      daysOfWeek: ["monday", "wednesday"],
    };
    // now: Tuesday 2026-07-14 20:00 UTC. Mon Jul 13 10:00 is 34h back,
    // Wed Jul 15 10:00 is 14h ahead -> Wednesday wins.
    const result = nearestClassSessionTime(cls, d("2026-07-14T20:00:00.000Z"));
    expect(result).toEqual(d("2026-07-15T10:00:00.000Z"));
  });

  it("returns the course startTime when now is more than a week before the course starts", () => {
    const cls = {
      startTime: "2026-08-03T10:00:00.000Z", // Monday
      daysOfWeek: ["monday"],
    };
    const result = nearestClassSessionTime(cls, d("2026-07-06T09:00:00.000Z"));
    expect(result).toEqual(d("2026-08-03T10:00:00.000Z"));
  });

  it("finds a session shortly after midnight from the evening before (reminder wraparound)", () => {
    const cls = {
      startTime: "2026-07-06T00:05:00.000Z", // Monday 00:05
      daysOfWeek: ["monday"],
    };
    // now: Sunday 2026-07-12 23:55 — the Monday 00:05 session is 10 minutes away.
    const result = nearestClassSessionTime(cls, d("2026-07-12T23:55:00.000Z"));
    expect(result).toEqual(d("2026-07-13T00:05:00.000Z"));
  });

  it("never returns an occurrence before the course start", () => {
    const cls = {
      startTime: "2026-08-03T10:00:00.000Z", // Monday
      daysOfWeek: ["monday"],
    };
    // now: Saturday 2026-08-01. Mon Jul 27 would be nearer but predates the
    // course start, so the first real session (the start itself) is returned.
    const result = nearestClassSessionTime(cls, d("2026-08-01T09:00:00.000Z"));
    expect(result).toEqual(d("2026-08-03T10:00:00.000Z"));
  });
});

describe("sessionJoinInfo", () => {
  const slot = {
    startTime: "2026-07-06T10:00:00.000Z",
    endTime: "2026-07-06T11:00:00.000Z",
  };

  it("marks a slot joinable from 10 minutes before start until its end", () => {
    const atLead = sessionJoinInfo(slot, null, d("2026-07-06T09:50:00.000Z"));
    expect(atLead.sessionTime).toEqual(d("2026-07-06T10:00:00.000Z"));
    expect(atLead.canJoin).toBe(true);

    const beforeEnd = sessionJoinInfo(slot, null, d("2026-07-06T10:59:00.000Z"));
    expect(beforeEnd.canJoin).toBe(true);
  });

  it("marks a slot not joinable outside the lead/end window", () => {
    const tooEarly = sessionJoinInfo(slot, null, d("2026-07-06T09:49:00.000Z"));
    expect(tooEarly.sessionTime).toEqual(d("2026-07-06T10:00:00.000Z"));
    expect(tooEarly.canJoin).toBe(false);

    const tooLate = sessionJoinInfo(slot, null, d("2026-07-06T11:01:00.000Z"));
    expect(tooLate.canJoin).toBe(false);
  });

  it("uses the nearest class session plus the class duration for class-based bookings", () => {
    const cls = {
      startTime: "2026-07-06T10:00:00.000Z", // Monday, 90-minute sessions
      endTime: "2026-07-06T11:30:00.000Z",
      daysOfWeek: ["monday"],
    };
    // now: Monday 2026-07-13, 5 minutes before that week's session.
    const joinable = sessionJoinInfo(null, cls, d("2026-07-13T09:55:00.000Z"));
    expect(joinable.sessionTime).toEqual(d("2026-07-13T10:00:00.000Z"));
    expect(joinable.canJoin).toBe(true);

    // Still within the session (ends 11:30).
    const during = sessionJoinInfo(undefined, cls, d("2026-07-13T11:29:00.000Z"));
    expect(during.canJoin).toBe(true);

    // One minute after the session ended.
    const after = sessionJoinInfo(null, cls, d("2026-07-13T11:31:00.000Z"));
    expect(after.sessionTime).toEqual(d("2026-07-13T10:00:00.000Z"));
    expect(after.canJoin).toBe(false);
  });

  it("returns canJoin false and a null sessionTime with neither slot nor class", () => {
    expect(sessionJoinInfo(null, null, d("2026-07-06T10:00:00.000Z"))).toEqual({
      sessionTime: null,
      canJoin: false,
    });
    expect(sessionJoinInfo(undefined, undefined, d("2026-07-06T10:00:00.000Z"))).toEqual({
      sessionTime: null,
      canJoin: false,
    });
  });
});

describe("classSessionOnDay", () => {
  it("returns the occurrence when the class recurs on the day's Cairo weekday", () => {
    const cls = {
      startTime: "2026-07-06T10:30:00.000Z", // Monday
      daysOfWeek: ["monday"],
    };
    // day: Monday 2026-07-20 08:00 UTC (11:00 Cairo)
    expect(classSessionOnDay(cls, d("2026-07-20T08:00:00.000Z"))).toEqual(
      d("2026-07-20T10:30:00.000Z")
    );
  });

  it("returns null when the class does not recur on the day's weekday", () => {
    const cls = {
      startTime: "2026-07-06T10:30:00.000Z",
      daysOfWeek: ["wednesday"],
    };
    // Monday 2026-07-20 — class only meets Wednesdays.
    expect(classSessionOnDay(cls, d("2026-07-20T08:00:00.000Z"))).toBeNull();
  });

  it("returns a one-off class only on its own Cairo day", () => {
    const cls = { startTime: "2026-07-20T10:00:00.000Z" };
    expect(classSessionOnDay(cls, d("2026-07-20T06:00:00.000Z"))).toEqual(
      d("2026-07-20T10:00:00.000Z")
    );
    expect(classSessionOnDay(cls, d("2026-07-21T06:00:00.000Z"))).toBeNull();
  });

  it("returns null on a matching weekday before the course has started", () => {
    const cls = {
      startTime: "2026-08-03T10:00:00.000Z", // course starts Monday Aug 3
      daysOfWeek: ["monday"],
    };
    // Monday July 20 is before the course begins.
    expect(classSessionOnDay(cls, d("2026-07-20T08:00:00.000Z"))).toBeNull();
  });

  it("finds a session whose UTC date differs from its Cairo day (midnight wraparound)", () => {
    // 22:30 UTC = 01:30 Cairo on the NEXT calendar day, so the occurrence's
    // UTC date is one day behind its Cairo date.
    const cls = {
      startTime: "2026-07-05T22:30:00.000Z", // Monday 01:30 Cairo (Jul 6)
      daysOfWeek: ["monday"],
    };
    // day: 23:00 UTC Sunday Jul 19 = 02:00 Cairo Monday Jul 20.
    expect(classSessionOnDay(cls, d("2026-07-19T23:00:00.000Z"))).toEqual(
      d("2026-07-19T22:30:00.000Z")
    );
  });
});
