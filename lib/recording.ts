// Pure decisions for the session-recording lifecycle. The R2 client, Mongo
// model, and browser recorder all consume these; none of them are imported
// here, which keeps every rule below unit-testable.

/** S3 multipart minimum for every part except the last. */
export const MIN_PART_BYTES = 5 * 1024 * 1024;
/**
 * Size ceiling for one uploaded part: comfortably above the ~5 MiB the recorder
 * targets, far below R2's own 5 GiB per-part limit.
 *
 * A presigned upload URL cannot say "at most this many bytes" — the only size
 * condition it can carry is an exact byte count, and part sizes aren't known
 * when the URLs are signed ahead of time in batches (see presignUploadPart in
 * lib/r2.ts). So the cap is checked when the upload is finalized instead, by
 * both finalize paths — the complete route and the cron sweep. A part over the
 * cap means the recorder is broken or someone is abusing the URLs, so the
 * upload is thrown away rather than assembled into an object we pay to store.
 */
export const MAX_PART_BYTES = 32 * 1024 * 1024;
/** Presigned part URLs handed to the client per batch request. */
export const PART_URL_BATCH = 5;
/** S3 hard cap is 10,000; at ~33 s/part, 1,000 is already ~9 h of video. */
export const MAX_PARTS = 1000;
/** Client stops recording on its own after this long. */
export const MAX_RECORDING_MS = 4 * 60 * 60 * 1000;
/**
 * A recording whose last part-URL request (heartbeat) is older than this is
 * considered abandoned. Batches are requested about every 2.7 min at the
 * configured bitrate, so 8 min is a 2x margin.
 */
export const ACTIVE_STALE_MS = 8 * 60 * 1000;
/** Recordings auto-delete after this many days (R2 lifecycle mirrors it). */
export const RETENTION_DAYS = 7;
/** TTL for presigned playback GET URLs. */
export const GET_URL_TTL_S = 3600;
/** TTL for presigned part-upload PUT URLs. */
export const PART_URL_TTL_S = 3600;
/** Client-side memory bound: max parts queued for upload (~60 MiB). */
export const MAX_QUEUED_PARTS = 12;

const DAY_MS = 24 * 60 * 60 * 1000;

export type RecordingStatus = "recording" | "completed" | "finalized" | "failed";

/**
 * R2 object key for one recording. ":" and "." are replaced because they
 * complicate URL signing/canonicalization in some S3 tooling.
 */
export function buildObjectKey(channel: string, startedAt: Date, recordingId: string): string {
  const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
  return `recordings/${channel}/${stamp}-${recordingId}.webm`;
}

export function recordingExpiry(startedAt: Date): Date {
  return new Date(startedAt.getTime() + RETENTION_DAYS * DAY_MS);
}

export function isStale(lastPartAt: Date, now: Date): boolean {
  return now.getTime() - lastPartAt.getTime() > ACTIVE_STALE_MS;
}

/**
 * Whether one part is over the cap. Both finalize paths ask this question but
 * know different things — the complete route holds every part, the sweep only
 * the largest one — so the boundary itself lives here once, and a part sitting
 * exactly on the cap is allowed.
 */
export function exceedsPartCap(sizeBytes: number): boolean {
  return sizeBytes > MAX_PART_BYTES;
}

/** The first part that exceeds the per-part cap, or null when all are within it. */
export function oversizedPart(parts: { PartNumber: number; Size: number }[]): number | null {
  // Report the lowest part number rather than the first listed one, so the log
  // line is the same no matter what order R2 paged the parts back in.
  const offenders = parts.filter((part) => exceedsPartCap(part.Size));
  if (offenders.length === 0) return null;
  return Math.min(...offenders.map((part) => part.PartNumber));
}

export type SweepAction = "finalize" | "fail" | "skip";

/** What the cron sweep should do with one recording doc. */
export function sweepDecision(opts: {
  status: RecordingStatus;
  lastPartAt: Date;
  partCount: number;
  now: Date;
}): SweepAction {
  if (opts.status !== "recording") return "skip";
  if (!isStale(opts.lastPartAt, opts.now)) return "skip";
  return opts.partCount > 0 ? "finalize" : "fail";
}

export function isPlayable(
  rec: { status: RecordingStatus; expiresAt: Date },
  now: Date,
): boolean {
  return (
    (rec.status === "completed" || rec.status === "finalized") &&
    rec.expiresAt.getTime() > now.getTime()
  );
}

/**
 * Elapsed recording time as digits only ("4:07", "1:02:33") — the same in every
 * language, so it needs no translated message.
 */
export function formatRecordingDuration(startedAt: Date, endedAt: Date): string {
  const totalSeconds = Math.max(0, Math.round((endedAt.getTime() - startedAt.getTime()) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/**
 * Filename offered when a recording is downloaded. Plain ASCII so it survives
 * every filesystem and the HTTP header it travels in; the timestamp is UTC,
 * which keeps two recordings of the same lesson distinguishable.
 */
export function downloadFileName(startedAt: Date): string {
  const [date, time] = startedAt.toISOString().split("T");
  return `iwan-recording-${date}-${time.slice(0, 5).replace(":", "")}.webm`;
}

export type PartRequest =
  | { ok: true; fromPart: number; count: number }
  | { ok: false; error: string };

/** Validate a client's request for a batch of presigned part URLs. */
export function validatePartRequest(fromPart: unknown, count: unknown): PartRequest {
  if (typeof fromPart !== "number" || !Number.isInteger(fromPart)) {
    return { ok: false, error: "fromPart must be an integer" };
  }
  if (typeof count !== "number" || !Number.isInteger(count)) {
    return { ok: false, error: "count must be an integer" };
  }
  if (count < 1 || count > 10) return { ok: false, error: "count must be between 1 and 10" };
  if (fromPart < 1) return { ok: false, error: "fromPart must be at least 1" };
  if (fromPart + count - 1 > MAX_PARTS) {
    return { ok: false, error: `part numbers must not exceed ${MAX_PARTS}` };
  }
  return { ok: true, fromPart, count };
}
