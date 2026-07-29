import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Recording, IRecording } from "@/models/Recording";
import {
  claimComplete,
  deleteExpiredDocs,
  findStaleRecordings,
  hasActiveRecording,
  listPlayableByChannel,
  markFailed,
  markFinalized,
  touchHeartbeat,
} from "@/lib/recordingStore";
import { ACTIVE_STALE_MS, recordingExpiry } from "@/lib/recording";

let mongod: MongoMemoryServer;

const now = new Date("2026-07-29T12:00:00Z");
const teacherId = new mongoose.Types.ObjectId();
const staleDate = new Date(now.getTime() - ACTIVE_STALE_MS - 1000);

function makeRecording(overrides: Partial<IRecording> = {}) {
  const startedAt = overrides.startedAt ?? new Date(now.getTime() - 10 * 60 * 1000);
  return Recording.create({
    channel: "iwan-1on1-abc12345",
    teacherId,
    status: "recording",
    objectKey: `recordings/test/${new mongoose.Types.ObjectId().toString()}.webm`,
    uploadId: "upload-1",
    startedAt,
    lastPartAt: startedAt,
    expiresAt: recordingExpiry(startedAt),
    ...overrides,
  });
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

describe("claimComplete", () => {
  it("completes an in-progress recording exactly once", async () => {
    const rec = await makeRecording();
    const first = await claimComplete(rec._id, teacherId.toString(), now);
    expect(first?.status).toBe("completed");
    expect(first?.endedAt).toEqual(now);

    const second = await claimComplete(rec._id, teacherId.toString(), now);
    expect(second).toBeNull();
  });

  it("refuses a different teacher's claim", async () => {
    const rec = await makeRecording();
    const other = new mongoose.Types.ObjectId().toString();
    expect(await claimComplete(rec._id, other, now)).toBeNull();
  });

  it("refuses recordings already in a terminal status", async () => {
    const rec = await makeRecording({ status: "failed" });
    expect(await claimComplete(rec._id, teacherId.toString(), now)).toBeNull();
  });
});

describe("touchHeartbeat", () => {
  it("bumps lastPartAt for the owning teacher's live recording", async () => {
    const rec = await makeRecording();
    const later = new Date(now.getTime() + 60_000);
    const updated = await touchHeartbeat(rec._id, teacherId.toString(), later);
    expect(updated?.lastPartAt).toEqual(later);
  });

  it("refuses when the recording is not live or not the teacher's", async () => {
    const done = await makeRecording({ status: "completed" });
    expect(await touchHeartbeat(done._id, teacherId.toString(), now)).toBeNull();

    const rec = await makeRecording();
    const other = new mongoose.Types.ObjectId().toString();
    expect(await touchHeartbeat(rec._id, other, now)).toBeNull();
  });
});

describe("findStaleRecordings", () => {
  it("returns only live recordings whose heartbeat crossed the staleness window", async () => {
    const stale = await makeRecording({ lastPartAt: staleDate });
    await makeRecording({ lastPartAt: now }); // fresh
    await makeRecording({ lastPartAt: staleDate, status: "completed" }); // terminal

    const found = await findStaleRecordings(now);
    expect(found.map((r) => r._id.toString())).toEqual([stale._id.toString()]);
  });
});

describe("markFinalized / markFailed", () => {
  it("finalizes a live recording with the given end time", async () => {
    const rec = await makeRecording({ lastPartAt: staleDate });
    const updated = await markFinalized(rec._id, staleDate);
    expect(updated?.status).toBe("finalized");
    expect(updated?.endedAt).toEqual(staleDate);
  });

  it("does not resurrect a terminal recording", async () => {
    const rec = await makeRecording({ status: "completed" });
    expect(await markFinalized(rec._id, now)).toBeNull();
    expect(await markFailed(rec._id, now)).toBeNull();
  });
});

describe("deleteExpiredDocs", () => {
  it("deletes only docs past their expiry, regardless of status", async () => {
    const expired = new Date(now.getTime() - 1000);
    await makeRecording({ status: "completed", expiresAt: expired });
    await makeRecording({ status: "failed", expiresAt: expired });
    const kept = await makeRecording(); // expires in 7 days

    expect(await deleteExpiredDocs(now)).toBe(2);
    const remaining = await Recording.find({}).lean();
    expect(remaining.map((r) => r._id.toString())).toEqual([kept._id.toString()]);
  });
});

describe("hasActiveRecording", () => {
  it("is true while a live recording's heartbeat is fresh", async () => {
    await makeRecording({ lastPartAt: now });
    expect(await hasActiveRecording("iwan-1on1-abc12345", now)).toBe(true);
  });

  it("is false once the heartbeat goes stale (dead teacher tab)", async () => {
    await makeRecording({ lastPartAt: staleDate });
    expect(await hasActiveRecording("iwan-1on1-abc12345", now)).toBe(false);
  });

  it("is false for completed recordings and other channels", async () => {
    await makeRecording({ status: "completed", lastPartAt: now });
    expect(await hasActiveRecording("iwan-1on1-abc12345", now)).toBe(false);
    await makeRecording({ channel: "iwan-class-zzz", lastPartAt: now });
    expect(await hasActiveRecording("iwan-1on1-abc12345", now)).toBe(false);
  });
});

describe("listPlayableByChannel", () => {
  it("lists completed and finalized unexpired recordings, newest first", async () => {
    const older = await makeRecording({
      status: "completed",
      startedAt: new Date("2026-07-28T10:00:00Z"),
    });
    const newer = await makeRecording({
      status: "finalized",
      startedAt: new Date("2026-07-29T10:00:00Z"),
    });
    await makeRecording({ status: "recording" }); // in progress
    await makeRecording({ status: "failed" });
    await makeRecording({ status: "completed", expiresAt: new Date(now.getTime() - 1) }); // expired
    await makeRecording({ status: "completed", channel: "iwan-class-other" });

    const list = await listPlayableByChannel("iwan-1on1-abc12345", now);
    expect(list.map((r) => r._id.toString())).toEqual([
      newer._id.toString(),
      older._id.toString(),
    ]);
  });
});
