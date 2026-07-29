// Cron sweep: finalize recordings whose teacher tab died mid-session (so the
// already-uploaded parts become a playable object) and clean up expired docs.
// R2 operations are injected so the sweep is testable against an in-memory
// fake without mocking (repo convention).
import {
  deleteExpiredDocs,
  findStaleRecordings,
  markFailed,
  markFinalized,
} from "@/lib/recordingStore";
import { exceedsPartCap, sweepDecision } from "@/lib/recording";

export interface SweepR2Ops {
  /**
   * Uploaded parts, or null when the multipart upload no longer exists.
   * `maxPartBytes` is the largest part seen (0 when there are none) — the sweep
   * needs it to apply the per-part size cap, which no presigned URL can.
   */
  listParts(
    key: string,
    uploadId: string
  ): Promise<{ count: number; maxPartBytes: number } | null>;
  /** ListParts + CompleteMultipartUpload. */
  completeUpload(key: string, uploadId: string): Promise<void>;
  abortUpload(key: string, uploadId: string): Promise<void>;
  objectExists(key: string): Promise<boolean>;
}

export interface SweepResult {
  finalized: number;
  failed: number;
  deleted: number;
}

export async function sweepRecordings(ops: SweepR2Ops, now: Date): Promise<SweepResult> {
  const stale = await findStaleRecordings(now);
  let finalized = 0;
  let failed = 0;

  for (const rec of stale) {
    // One broken recording must not block the rest: log and leave it in
    // "recording" so the next sweep retries it.
    try {
      const listed = await ops.listParts(rec.objectKey, rec.uploadId);

      if (listed === null) {
        // Upload id gone. Either a complete succeeded but the doc write was
        // lost (object exists) or the upload was aborted (object missing).
        if (await ops.objectExists(rec.objectKey)) {
          await markFinalized(rec._id, rec.lastPartAt);
          finalized += 1;
        } else {
          await markFailed(rec._id, rec.lastPartAt);
          failed += 1;
        }
        continue;
      }

      let action = sweepDecision({
        status: rec.status,
        lastPartAt: rec.lastPartAt,
        partCount: listed.count,
        now,
      });
      // An over-sized part means a broken recorder or an abused upload URL, and
      // an abandoned recording is only ever finalized here — so turn the
      // finalize into a failure and let the bytes go instead of assembling them
      // into an object we pay to keep.
      if (action === "finalize" && exceedsPartCap(listed.maxPartBytes)) {
        console.error(
          `recording ${rec._id.toString()} has a part of ${listed.maxPartBytes} bytes, over the per-part cap`
        );
        action = "fail";
      }

      if (action === "finalize") {
        await ops.completeUpload(rec.objectKey, rec.uploadId);
        await markFinalized(rec._id, rec.lastPartAt);
        finalized += 1;
      } else if (action === "fail") {
        await ops.abortUpload(rec.objectKey, rec.uploadId);
        await markFailed(rec._id, rec.lastPartAt);
        failed += 1;
      }
    } catch (err) {
      console.error(`recording sweep failed for ${rec._id.toString()}`, err);
    }
  }

  const deleted = await deleteExpiredDocs(now);
  return { finalized, failed, deleted };
}
