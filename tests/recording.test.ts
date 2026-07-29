// Pure tests for recording lifecycle decisions (lib/recording.ts).
import { describe, expect, it } from "vitest";
import {
  ACTIVE_STALE_MS,
  buildObjectKey,
  formatRecordingDuration,
  isPlayable,
  isStale,
  MAX_PART_BYTES,
  MAX_PARTS,
  oversizedPart,
  recordingExpiry,
  RETENTION_DAYS,
  sweepDecision,
  validatePartRequest,
} from "@/lib/recording";

const now = new Date("2026-07-29T12:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

describe("buildObjectKey", () => {
  it("builds a URL-safe key under the channel prefix", () => {
    const key = buildObjectKey("iwan-1on1-a1b2c3d4", new Date("2026-07-29T09:30:15.250Z"), "6889aa");
    expect(key).toBe("recordings/iwan-1on1-a1b2c3d4/2026-07-29T09-30-15-250Z-6889aa.webm");
    // ":" and "." break presigned-URL canonicalization in some S3 tooling — keep keys plain.
    expect(key).not.toMatch(/[:.](?!webm$)/);
  });

  it("produces distinct keys for recordings started at different times", () => {
    const a = buildObjectKey("c", new Date("2026-07-29T09:00:00Z"), "id1");
    const b = buildObjectKey("c", new Date("2026-07-29T10:00:00Z"), "id1");
    expect(a).not.toBe(b);
  });
});

describe("staleness and expiry", () => {
  it("treats a heartbeat older than the staleness window as stale", () => {
    expect(isStale(new Date(now.getTime() - ACTIVE_STALE_MS - 1), now)).toBe(true);
  });

  it("treats a heartbeat exactly at the staleness boundary as fresh", () => {
    expect(isStale(new Date(now.getTime() - ACTIVE_STALE_MS), now)).toBe(false);
  });

  it("expires a recording RETENTION_DAYS after it started", () => {
    expect(recordingExpiry(now)).toEqual(new Date(now.getTime() + RETENTION_DAYS * DAY_MS));
  });
});

describe("sweepDecision", () => {
  const stale = new Date(now.getTime() - ACTIVE_STALE_MS - 1);
  const fresh = new Date(now.getTime() - 1000);

  it("skips a recording whose heartbeat is still fresh", () => {
    expect(sweepDecision({ status: "recording", lastPartAt: fresh, partCount: 3, now })).toBe("skip");
  });

  it("finalizes a stale recording that has uploaded parts", () => {
    expect(sweepDecision({ status: "recording", lastPartAt: stale, partCount: 3, now })).toBe("finalize");
  });

  it("fails a stale recording with no uploaded parts", () => {
    expect(sweepDecision({ status: "recording", lastPartAt: stale, partCount: 0, now })).toBe("fail");
  });

  it("skips recordings already in a terminal status", () => {
    for (const status of ["completed", "finalized", "failed"] as const) {
      expect(sweepDecision({ status, lastPartAt: stale, partCount: 3, now })).toBe("skip");
    }
  });
});

describe("oversizedPart", () => {
  it("returns null when every part is within the cap", () => {
    expect(
      oversizedPart([
        { PartNumber: 1, Size: 5 * 1024 * 1024 },
        { PartNumber: 2, Size: 12 * 1024 * 1024 },
      ])
    ).toBeNull();
  });

  it("allows a part sitting exactly on the cap", () => {
    // The cap is a ceiling the recorder is allowed to reach, not to pass.
    expect(oversizedPart([{ PartNumber: 1, Size: MAX_PART_BYTES }])).toBeNull();
  });

  it("reports a part one byte over the cap", () => {
    expect(oversizedPart([{ PartNumber: 3, Size: MAX_PART_BYTES + 1 }])).toBe(3);
  });

  it("reports the first offender when several parts are over the cap", () => {
    expect(
      oversizedPart([
        { PartNumber: 1, Size: 1024 },
        { PartNumber: 2, Size: MAX_PART_BYTES * 2 },
        { PartNumber: 3, Size: MAX_PART_BYTES + 1 },
      ])
    ).toBe(2);
  });

  it("returns null for an empty part list", () => {
    // No parts means nothing to reject here; the empty case is a separate rule.
    expect(oversizedPart([])).toBeNull();
  });
});

describe("isPlayable", () => {
  const future = new Date(now.getTime() + DAY_MS);
  const past = new Date(now.getTime() - 1);

  it("allows completed and finalized recordings before expiry", () => {
    expect(isPlayable({ status: "completed", expiresAt: future }, now)).toBe(true);
    expect(isPlayable({ status: "finalized", expiresAt: future }, now)).toBe(true);
  });

  it("rejects expired recordings even when completed", () => {
    expect(isPlayable({ status: "completed", expiresAt: past }, now)).toBe(false);
  });

  it("rejects in-progress and failed recordings", () => {
    expect(isPlayable({ status: "recording", expiresAt: future }, now)).toBe(false);
    expect(isPlayable({ status: "failed", expiresAt: future }, now)).toBe(false);
  });
});

describe("formatRecordingDuration", () => {
  const start = new Date("2026-07-29T10:00:00Z");
  const after = (seconds: number) => new Date(start.getTime() + seconds * 1000);

  it("shows minutes and seconds for a recording under an hour", () => {
    expect(formatRecordingDuration(start, after(4 * 60 + 7))).toBe("4:07");
  });

  it("adds an hours field once the recording passes an hour", () => {
    expect(formatRecordingDuration(start, after(3600 + 2 * 60 + 33))).toBe("1:02:33");
  });

  it("pads minutes to two digits when hours are shown", () => {
    expect(formatRecordingDuration(start, after(2 * 3600 + 5))).toBe("2:00:05");
  });

  it("reports zero for an instant recording", () => {
    expect(formatRecordingDuration(start, start)).toBe("0:00");
  });

  it("clamps a negative span to zero rather than printing a negative time", () => {
    // Clock skew between the client's stop and the server's start must not
    // render as "-1:-30".
    expect(formatRecordingDuration(start, after(-90))).toBe("0:00");
  });
});

describe("validatePartRequest", () => {
  it("accepts an in-range integer request", () => {
    expect(validatePartRequest(7, 5)).toEqual({ ok: true, fromPart: 7, count: 5 });
  });

  it("rejects non-integer inputs", () => {
    expect(validatePartRequest(1.5, 5).ok).toBe(false);
    expect(validatePartRequest("1", 5).ok).toBe(false);
    expect(validatePartRequest(1, null).ok).toBe(false);
  });

  it("rejects counts outside 1..10", () => {
    expect(validatePartRequest(1, 0).ok).toBe(false);
    expect(validatePartRequest(1, 11).ok).toBe(false);
  });

  it("rejects part numbers below 1", () => {
    expect(validatePartRequest(0, 5).ok).toBe(false);
  });

  it("rejects a batch that would exceed the maximum part count", () => {
    expect(validatePartRequest(MAX_PARTS - 3, 5).ok).toBe(false);
    expect(validatePartRequest(MAX_PARTS - 4, 5).ok).toBe(true);
  });
});
