// DB helpers for Recording docs. Status transitions use atomic
// findOneAndUpdate guards (repo convention) so a beacon and a click racing on
// "complete", or two sweep runs, can never double-apply.
import mongoose from "mongoose";
import { Recording, IRecording } from "@/models/Recording";
import { ACTIVE_STALE_MS } from "@/lib/recording";

type RecordingId = mongoose.Types.ObjectId | string;

/** Transition recording → completed; null when already terminal or not the teacher's. */
export function claimComplete(
  recordingId: RecordingId,
  teacherId: string,
  now: Date
): Promise<IRecording | null> {
  return Recording.findOneAndUpdate(
    { _id: recordingId, teacherId, status: "recording" },
    { status: "completed", endedAt: now },
    { returnDocument: "after" }
  ).lean<IRecording>();
}

/** Bump the heartbeat; doubles as the teacher-ownership + status check. */
export function touchHeartbeat(
  recordingId: RecordingId,
  teacherId: string,
  now: Date
): Promise<IRecording | null> {
  return Recording.findOneAndUpdate(
    { _id: recordingId, teacherId, status: "recording" },
    { lastPartAt: now },
    { returnDocument: "after" }
  ).lean<IRecording>();
}

/** Sweep transition recording → finalized (endedAt = last heartbeat). */
export function markFinalized(recordingId: RecordingId, endedAt: Date): Promise<IRecording | null> {
  return Recording.findOneAndUpdate(
    { _id: recordingId, status: "recording" },
    { status: "finalized", endedAt },
    { returnDocument: "after" }
  ).lean<IRecording>();
}

/** Transition recording → failed (no parts ever made it to storage). */
export function markFailed(recordingId: RecordingId, endedAt: Date): Promise<IRecording | null> {
  return Recording.findOneAndUpdate(
    { _id: recordingId, status: "recording" },
    { status: "failed", endedAt },
    { returnDocument: "after" }
  ).lean<IRecording>();
}

export function findStaleRecordings(now: Date): Promise<IRecording[]> {
  return Recording.find({
    status: "recording",
    lastPartAt: { $lt: new Date(now.getTime() - ACTIVE_STALE_MS) },
  }).lean<IRecording[]>();
}

/** Remove docs past retention (objects are already gone via R2 lifecycle). */
export async function deleteExpiredDocs(now: Date): Promise<number> {
  const result = await Recording.deleteMany({ expiresAt: { $lte: now } });
  return result.deletedCount;
}

/** Is someone recording this room right now? (Fresh heartbeat required, so a
 * dead teacher tab stops signalling within the staleness window.) */
export async function hasActiveRecording(channel: string, now: Date): Promise<boolean> {
  const active = await Recording.exists({
    channel,
    status: "recording",
    lastPartAt: { $gte: new Date(now.getTime() - ACTIVE_STALE_MS) },
  });
  return active !== null;
}

/**
 * Which of these rooms have something watchable — one query for a whole page of
 * bookings, since recordings are keyed by room rather than by booking.
 */
export async function channelsWithRecordings(
  channels: string[],
  now: Date
): Promise<Set<string>> {
  if (channels.length === 0) return new Set();
  const found = await Recording.find(
    {
      channel: { $in: channels },
      status: { $in: ["completed", "finalized"] },
      expiresAt: { $gt: now },
    },
    { channel: 1 }
  ).lean<{ channel: string }[]>();
  return new Set(found.map((rec) => rec.channel));
}

/** Watchable recordings for a room, newest first. */
export function listPlayableByChannel(channel: string, now: Date): Promise<IRecording[]> {
  return Recording.find({
    channel,
    status: { $in: ["completed", "finalized"] },
    expiresAt: { $gt: now },
  })
    .sort({ startedAt: -1 })
    .lean<IRecording[]>();
}
