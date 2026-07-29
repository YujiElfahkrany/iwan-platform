import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Recording, IRecording } from "@/models/Recording";
import { oversizedPart, type RecordingStatus } from "@/lib/recording";
import { claimComplete, markFailed } from "@/lib/recordingStore";
import {
  abortMultipartUpload,
  completeMultipartUpload,
  isNoSuchUpload,
  listAllParts,
  objectExists,
} from "@/lib/r2";

/**
 * Claim the recording as completed and report the status that actually stuck —
 * a concurrent sweep may have finalized it first.
 */
async function statusAfterClaim(
  recordingId: mongoose.Types.ObjectId,
  teacherId: string,
  now: Date
): Promise<RecordingStatus> {
  const claimed = await claimComplete(recordingId, teacherId, now);
  if (claimed) return claimed.status;
  const current = await Recording.findById(recordingId).lean<IRecording>();
  if (!current) throw new Error(`recording ${recordingId.toString()} vanished while completing`);
  return current.status;
}

// Closes the multipart upload so the object becomes playable. Called both from a
// button and from navigator.sendBeacon on tab close, so the body is never read
// (beacon payloads are opaque here — cookies carry the auth) and the whole
// handler is idempotent.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ recordingId: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { recordingId } = await params;
    if (!mongoose.Types.ObjectId.isValid(recordingId)) {
      return NextResponse.json({ error: "Invalid recording" }, { status: 400 });
    }

    await connectDB();
    const recording = await Recording.findById(recordingId).lean<IRecording>();
    if (!recording) return NextResponse.json({ error: "Recording not found" }, { status: 404 });
    if (recording.teacherId.toString() !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Already terminal: nothing left to do, report what it settled on.
    if (recording.status !== "recording") {
      return NextResponse.json({ status: recording.status });
    }

    const now = new Date();
    try {
      const parts = await listAllParts(recording.objectKey, recording.uploadId);
      if (parts.length === 0) {
        // Nothing ever reached R2 (e.g. the first part failed) — no object can
        // be assembled, so drop the upload instead of leaving it billable.
        await abortMultipartUpload(recording.objectKey, recording.uploadId);
        await markFailed(recording._id, now);
        return NextResponse.json({ status: "failed" });
      }
      const tooBig = oversizedPart(parts);
      if (tooBig !== null) {
        // A part above the cap means a broken recorder or someone abusing the
        // presigned URLs (which cannot carry a size limit themselves) — drop the
        // upload so the bytes are never assembled into a billable object.
        console.error(
          `recording ${recording._id.toString()} part ${tooBig} exceeds the per-part size cap`
        );
        await abortMultipartUpload(recording.objectKey, recording.uploadId);
        await markFailed(recording._id, now);
        return NextResponse.json({ status: "failed" });
      }
      await completeMultipartUpload(recording.objectKey, recording.uploadId, parts);
      const status = await statusAfterClaim(recording._id, session.user.id, now);
      return NextResponse.json({ status });
    } catch (err) {
      if (!isNoSuchUpload(err)) throw err;
      // Race: a second beacon or the sweep already finished this upload. The
      // object either exists (completed) or was aborted (nothing to serve).
      if (await objectExists(recording.objectKey)) {
        const status = await statusAfterClaim(recording._id, session.user.id, now);
        return NextResponse.json({ status });
      }
      await markFailed(recording._id, now);
      return NextResponse.json({ status: "failed" });
    }
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
