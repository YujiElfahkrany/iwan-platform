// The single gate in front of every cron route. It lives here because the naive
// version — comparing against `Bearer ${process.env.CRON_SECRET}` — lets an
// anonymous caller in with the literal string "Bearer undefined" whenever the
// variable is not set, and that mistake is easy to repeat per route.
import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";

/**
 * Compare in constant time. timingSafeEqual throws on different lengths, so the
 * length is checked first — which does leak the secret's length, and nothing
 * more.
 */
function matches(presented: string | null, secret: string): boolean {
  if (presented === null) return false;
  const a = Buffer.from(presented, "utf8");
  const b = Buffer.from(secret, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

const BEARER_PREFIX = "Bearer ";

/**
 * Does either presented credential match the configured cron secret? An unset
 * or empty secret authorizes nobody: a misconfigured deployment must lock the
 * cron routes, never open them.
 */
export function matchesCronSecret(
  presentedHeader: string | null,
  presentedBearer: string | null,
  secret: string | undefined = process.env.CRON_SECRET
): boolean {
  if (!secret) return false;
  const fromBearer = presentedBearer?.startsWith(BEARER_PREFIX)
    ? presentedBearer.slice(BEARER_PREFIX.length)
    : null;
  return matches(presentedHeader, secret) || matches(fromBearer, secret);
}

/** Either `x-cron-secret: <secret>` or `authorization: Bearer <secret>`. */
export function isAuthorizedCronRequest(req: NextRequest): boolean {
  return matchesCronSecret(req.headers.get("x-cron-secret"), req.headers.get("authorization"));
}
