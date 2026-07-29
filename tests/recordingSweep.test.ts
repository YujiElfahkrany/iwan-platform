// Sweep tests run against a real in-memory Mongo and an in-memory fake of the
// injected R2 operations (repo convention: dependency injection, no vi.mock).
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Recording, IRecording } from "@/models/Recording";
import { sweepRecordings, SweepR2Ops } from "@/lib/recordingSweep";
import { ACTIVE_STALE_MS, MAX_PART_BYTES, recordingExpiry } from "@/lib/recording";

let mongod: MongoMemoryServer;

const now = new Date("2026-07-29T12:00:00Z");
const staleDate = new Date(now.getTime() - ACTIVE_STALE_MS - 1000);

function makeRecording(overrides: Partial<IRecording> = {}) {
  const startedAt = overrides.startedAt ?? new Date(now.getTime() - 30 * 60 * 1000);
  return Recording.create({
    channel: "iwan-1on1-abc12345",
    teacherId: new mongoose.Types.ObjectId(),
    status: "recording",
    objectKey: `recordings/test/${new mongoose.Types.ObjectId().toString()}.webm`,
    uploadId: "upload-1",
    startedAt,
    lastPartAt: staleDate,
    expiresAt: recordingExpiry(startedAt),
    ...overrides,
  });
}

type ListedParts = { count: number; maxPartBytes: number };

/** Parts as R2 reports them: how many, and the largest one — well under the cap
 * unless a test says otherwise. */
function uploaded(count: number, maxPartBytes = 5 * 1024 * 1024): ListedParts {
  return { count, maxPartBytes };
}

/** In-memory R2 fake: parts per uploadId key, plus a set of existing objects. */
function makeFakeR2(state: {
  parts?: Record<string, ListedParts | null>;
  objects?: string[];
  completeError?: Error;
}) {
  const calls = { complete: [] as string[], abort: [] as string[] };
  const ops: SweepR2Ops = {
    async listParts(key) {
      // null is a meaningful value here ("upload gone"), so no ?? fallback.
      const value = state.parts?.[key];
      return value === undefined ? uploaded(0, 0) : value;
    },
    async completeUpload(key) {
      if (state.completeError) throw state.completeError;
      calls.complete.push(key);
    },
    async abortUpload(key) {
      calls.abort.push(key);
    },
    async objectExists(key) {
      return state.objects?.includes(key) ?? false;
    },
  };
  return { ops, calls };
}

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Recording.deleteMany({});
});

describe("sweepRecordings", () => {
  it("finalizes a stale recording that has uploaded parts", async () => {
    const rec = await makeRecording();
    const { ops, calls } = makeFakeR2({ parts: { [rec.objectKey]: uploaded(4) } });

    const result = await sweepRecordings(ops, now);

    expect(result).toMatchObject({ finalized: 1, failed: 0 });
    expect(calls.complete).toEqual([rec.objectKey]);
    const updated = await Recording.findById(rec._id).lean();
    expect(updated?.status).toBe("finalized");
    expect(updated?.endedAt).toEqual(staleDate); // last heartbeat, not sweep time
  });

  it("aborts and fails a stale recording with no uploaded parts", async () => {
    const rec = await makeRecording();
    const { ops, calls } = makeFakeR2({ parts: { [rec.objectKey]: uploaded(0, 0) } });

    const result = await sweepRecordings(ops, now);

    expect(result).toMatchObject({ finalized: 0, failed: 1 });
    expect(calls.abort).toEqual([rec.objectKey]);
    expect((await Recording.findById(rec._id).lean())?.status).toBe("failed");
  });

  it("aborts and fails a stale recording whose largest part is over the cap", async () => {
    // Presigned URLs cannot cap a part's size, so the sweep is the last chance to
    // refuse an abusive upload — it must never be assembled into an object.
    const rec = await makeRecording();
    const { ops, calls } = makeFakeR2({
      parts: { [rec.objectKey]: uploaded(4, MAX_PART_BYTES + 1) },
    });

    const result = await sweepRecordings(ops, now);

    expect(result).toMatchObject({ finalized: 0, failed: 1 });
    expect(calls.abort).toEqual([rec.objectKey]);
    expect(calls.complete).toEqual([]);
    expect((await Recording.findById(rec._id).lean())?.status).toBe("failed");
  });

  it("finalizes a stale recording whose largest part sits exactly on the cap", async () => {
    const rec = await makeRecording();
    const { ops, calls } = makeFakeR2({
      parts: { [rec.objectKey]: uploaded(4, MAX_PART_BYTES) },
    });

    const result = await sweepRecordings(ops, now);

    expect(result).toMatchObject({ finalized: 1, failed: 0 });
    expect(calls.complete).toEqual([rec.objectKey]);
    expect(calls.abort).toEqual([]);
    expect((await Recording.findById(rec._id).lean())?.status).toBe("finalized");
  });

  it("leaves fresh recordings untouched without any R2 calls", async () => {
    await makeRecording({ lastPartAt: now });
    const { ops, calls } = makeFakeR2({});

    const result = await sweepRecordings(ops, now);

    expect(result).toMatchObject({ finalized: 0, failed: 0 });
    expect(calls.complete).toEqual([]);
    expect(calls.abort).toEqual([]);
  });

  it("finalizes without completing when the upload is gone but the object exists", async () => {
    // Covers the crash window between a successful R2 complete and the doc write.
    const rec = await makeRecording();
    const { ops, calls } = makeFakeR2({
      parts: { [rec.objectKey]: null },
      objects: [rec.objectKey],
    });

    const result = await sweepRecordings(ops, now);

    expect(result).toMatchObject({ finalized: 1, failed: 0 });
    expect(calls.complete).toEqual([]);
    expect((await Recording.findById(rec._id).lean())?.status).toBe("finalized");
  });

  it("fails the recording when both the upload and the object are gone", async () => {
    const rec = await makeRecording();
    const { ops } = makeFakeR2({ parts: { [rec.objectKey]: null } });

    const result = await sweepRecordings(ops, now);

    expect(result).toMatchObject({ finalized: 0, failed: 1 });
    expect((await Recording.findById(rec._id).lean())?.status).toBe("failed");
  });

  it("keeps a recording for the next sweep when its R2 complete throws", async () => {
    const broken = await makeRecording();
    const { ops } = makeFakeR2({
      parts: { [broken.objectKey]: uploaded(2) },
      completeError: new Error("r2 down"),
    });

    const result = await sweepRecordings(ops, now);

    expect(result).toMatchObject({ finalized: 0, failed: 0 });
    expect((await Recording.findById(broken._id).lean())?.status).toBe("recording");
  });

  it("deletes expired docs and reports the count", async () => {
    await makeRecording({ status: "completed", expiresAt: new Date(now.getTime() - 1) });
    await makeRecording({ status: "completed" }); // unexpired, kept
    const { ops } = makeFakeR2({});

    const result = await sweepRecordings(ops, now);

    expect(result.deleted).toBe(1);
    expect(await Recording.countDocuments({})).toBe(1);
  });
});
