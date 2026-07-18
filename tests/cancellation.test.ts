import { describe, expect, it } from "vitest";
import { computeCancellation, CANCELLATION_WINDOW_DAYS } from "@/lib/cancellation";

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-07-18T12:00:00Z");

describe("computeCancellation", () => {
  it("refunds 80% of the price paid when cancelled in time", () => {
    const sessionStart = new Date(now.getTime() + (CANCELLATION_WINDOW_DAYS + 1) * DAY);
    const decision = computeCancellation({ pricePaid: 100, wasCharged: true, sessionStart, now });
    expect(decision).toEqual({ allowed: true, refund: 80 });
  });

  it("rounds the refund to 2 decimals", () => {
    const decision = computeCancellation({ pricePaid: 33.33, wasCharged: true, sessionStart: null, now });
    expect(decision).toEqual({ allowed: true, refund: 26.66 });
  });

  it("rejects cancellation inside the window", () => {
    const sessionStart = new Date(now.getTime() + (CANCELLATION_WINDOW_DAYS - 1) * DAY);
    const decision = computeCancellation({ pricePaid: 100, wasCharged: true, sessionStart, now });
    expect(decision).toEqual({ allowed: false, reason: "too_late" });
  });

  it("rejects cancellation after the session started", () => {
    const sessionStart = new Date(now.getTime() - DAY);
    const decision = computeCancellation({ pricePaid: 100, wasCharged: true, sessionStart, now });
    expect(decision).toEqual({ allowed: false, reason: "too_late" });
  });

  it("allows cancellation exactly at the deadline", () => {
    const sessionStart = new Date(now.getTime() + CANCELLATION_WINDOW_DAYS * DAY);
    const decision = computeCancellation({ pricePaid: 100, wasCharged: true, sessionStart, now });
    expect(decision).toEqual({ allowed: true, refund: 80 });
  });

  it("allows cancellation with no session start (missing slot/class)", () => {
    const decision = computeCancellation({ pricePaid: 50, wasCharged: true, sessionStart: null, now });
    expect(decision).toEqual({ allowed: true, refund: 40 });
  });

  it("refunds nothing for uncharged (pending) bookings", () => {
    const decision = computeCancellation({ pricePaid: 100, wasCharged: false, sessionStart: null, now });
    expect(decision).toEqual({ allowed: true, refund: 0 });
  });

  it("refunds nothing when pricePaid is missing (legacy bookings)", () => {
    const decision = computeCancellation({ wasCharged: true, sessionStart: null, now });
    expect(decision).toEqual({ allowed: true, refund: 0 });
  });
});
