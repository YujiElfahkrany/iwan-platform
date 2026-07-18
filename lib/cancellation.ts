// Cancellation policy (see FAQ): a booking may be cancelled up to
// CANCELLATION_WINDOW_DAYS before the session starts, with a
// CANCELLATION_FEE_RATE deduction from the amount paid.
export const CANCELLATION_WINDOW_DAYS = 7;
export const CANCELLATION_FEE_RATE = 0.2;

const DAY_MS = 24 * 60 * 60 * 1000;

export type CancellationDecision =
  | { allowed: false; reason: "too_late" }
  | { allowed: true; refund: number };

export function computeCancellation(opts: {
  pricePaid?: number;
  /** true when the booking was actually paid for (status "confirmed") */
  wasCharged: boolean;
  sessionStart?: Date | null;
  now?: Date;
}): CancellationDecision {
  const now = opts.now ?? new Date();
  if (opts.sessionStart) {
    const deadline = opts.sessionStart.getTime() - CANCELLATION_WINDOW_DAYS * DAY_MS;
    if (now.getTime() > deadline) return { allowed: false, reason: "too_late" };
  }
  const paid = opts.wasCharged ? opts.pricePaid ?? 0 : 0;
  const refund = Math.round(paid * (1 - CANCELLATION_FEE_RATE) * 100) / 100;
  return { allowed: true, refund };
}
