import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { matchesCronSecret } from "@/lib/cronAuth";

const SECRET = "s3cr3t-cron-value";

describe("matchesCronSecret", () => {
  // The helper falls back to process.env.CRON_SECRET, which is what the cron
  // routes rely on, so these cases set it explicitly and put it back after.
  const original = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
  });

  afterEach(() => {
    if (original === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = original;
  });

  it("accepts the secret in the x-cron-secret header", () => {
    expect(matchesCronSecret(SECRET, null)).toBe(true);
  });

  it("accepts the secret as a bearer token", () => {
    expect(matchesCronSecret(null, `Bearer ${SECRET}`)).toBe(true);
  });

  it("rejects a wrong value in either place", () => {
    expect(matchesCronSecret("nope", null)).toBe(false);
    expect(matchesCronSecret(null, "Bearer nope")).toBe(false);
  });

  it("rejects a caller presenting nothing", () => {
    expect(matchesCronSecret(null, null)).toBe(false);
  });

  it("rejects an empty presented value", () => {
    expect(matchesCronSecret("", null)).toBe(false);
    expect(matchesCronSecret(null, "Bearer ")).toBe(false);
  });

  it("rejects the right secret without the Bearer scheme", () => {
    expect(matchesCronSecret(null, SECRET)).toBe(false);
  });

  it("rejects everything when no secret is configured", () => {
    // The bug this guards: comparing against `Bearer ${undefined}` let any
    // anonymous caller in with the literal string below.
    delete process.env.CRON_SECRET;

    expect(matchesCronSecret(null, "Bearer undefined")).toBe(false);
    expect(matchesCronSecret("undefined", null)).toBe(false);
    expect(matchesCronSecret(null, null)).toBe(false);
  });

  it("rejects everything when the configured secret is empty", () => {
    // An empty variable is a misconfiguration, not a password everyone knows.
    process.env.CRON_SECRET = "";

    expect(matchesCronSecret("", null)).toBe(false);
    expect(matchesCronSecret(null, "Bearer ")).toBe(false);
  });

  it("uses the secret passed in over the environment", () => {
    expect(matchesCronSecret("other", null, "other")).toBe(true);
    expect(matchesCronSecret(SECRET, null, "other")).toBe(false);
  });
});
