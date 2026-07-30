// Server-only boundary to Cloudflare R2 (S3-compatible API). Everything here is
// I/O against R2, so it carries no decisions of its own — the rules live in
// lib/recording.ts and the sweep logic in lib/recordingSweep.ts. Keep it thin:
// this file is not unit-testable without a real bucket.
import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListPartsCommand,
  S3Client,
  UploadPartCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { PART_URL_TTL_S } from "@/lib/recording";
import type { SweepR2Ops } from "@/lib/recordingSweep";

/** One uploaded multipart part as R2 reports it, including its byte size. */
export interface UploadedPart {
  PartNumber: number;
  ETag: string;
  Size: number;
}

export interface PresignedPart {
  partNumber: number;
  url: string;
}

const RECORDING_CONTENT_TYPE = "video/webm";

export function isR2Configured(): boolean {
  return Boolean(
    process.env.R2_ACCOUNT_ID &&
      process.env.R2_ACCESS_KEY_ID &&
      process.env.R2_SECRET_ACCESS_KEY &&
      process.env.R2_BUCKET_NAME
  );
}

let cached: { client: S3Client; bucket: string } | null = null;

function r2(): { client: S3Client; bucket: string } {
  if (cached) return cached;
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET_NAME;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error(
      "R2 is not configured: set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET_NAME"
    );
  }
  cached = {
    client: new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId, secretAccessKey },
    }),
    bucket,
  };
  return cached;
}

function errorName(err: unknown): string | undefined {
  return err instanceof Error ? err.name : undefined;
}

function httpStatus(err: unknown): number | undefined {
  return (err as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
}

/** The multipart upload is gone — already completed or aborted by someone else. */
export function isNoSuchUpload(err: unknown): boolean {
  return errorName(err) === "NoSuchUpload";
}

export async function createMultipartUpload(key: string): Promise<string> {
  const { client, bucket } = r2();
  const out = await client.send(
    new CreateMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      ContentType: RECORDING_CONTENT_TYPE,
    })
  );
  if (!out.UploadId) throw new Error(`R2 returned no upload id for ${key}`);
  return out.UploadId;
}

/**
 * A presigned PUT carries no size limit, and SigV4 has no way to express one:
 * the only size condition available is an exact `ContentLength`, which becomes a
 * signed header the uploader must match byte for byte. Parts are presigned in
 * batches before their blobs exist (see PART_URL_BATCH), so their exact sizes
 * are unknown here. Whoever holds one of these URLs can therefore PUT up to R2's
 * own 5 GiB per-part limit until it expires; shortening PART_URL_TTL_S is the
 * lever that limits that window. MAX_PART_BYTES is instead enforced when the
 * upload is finalized: an over-sized part makes the whole upload fail, so the
 * bytes are never assembled into an object we pay to keep.
 */
export function presignUploadPart(
  key: string,
  uploadId: string,
  partNumber: number
): Promise<string> {
  const { client, bucket } = r2();
  return getSignedUrl(
    client,
    new UploadPartCommand({ Bucket: bucket, Key: key, UploadId: uploadId, PartNumber: partNumber }),
    { expiresIn: PART_URL_TTL_S }
  );
}

/** Presign `count` consecutive part uploads starting at `fromPart`. */
export function presignPartBatch(
  key: string,
  uploadId: string,
  fromPart: number,
  count: number
): Promise<PresignedPart[]> {
  return Promise.all(
    Array.from({ length: count }, (_, i) => fromPart + i).map(async (partNumber) => ({
      partNumber,
      url: await presignUploadPart(key, uploadId, partNumber),
    }))
  );
}

/** Every part uploaded so far; ListParts pages at 1,000 entries. */
export async function listAllParts(key: string, uploadId: string): Promise<UploadedPart[]> {
  const { client, bucket } = r2();
  const parts: UploadedPart[] = [];
  let marker: string | undefined;
  do {
    const out = await client.send(
      new ListPartsCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        PartNumberMarker: marker,
      })
    );
    for (const part of out.Parts ?? []) {
      // A missing size would silently let the per-part cap pass, so treat it as
      // hard a failure as a missing number or ETag.
      if (part.PartNumber === undefined || !part.ETag || part.Size === undefined) {
        throw new Error(`R2 listed a part without a number, ETag or size for ${key}`);
      }
      parts.push({ PartNumber: part.PartNumber, ETag: part.ETag, Size: part.Size });
    }
    marker = out.IsTruncated ? out.NextPartNumberMarker : undefined;
  } while (marker);
  return parts;
}

export async function completeMultipartUpload(
  key: string,
  uploadId: string,
  parts: UploadedPart[]
): Promise<void> {
  const { client, bucket } = r2();
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: bucket,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: {
        // Size is informational from ListParts and is not a CompletedPart
        // member, so send only what R2 accepts here.
        Parts: [...parts]
          .sort((a, b) => a.PartNumber - b.PartNumber)
          .map(({ PartNumber, ETag }) => ({ PartNumber, ETag })),
      },
    })
  );
}

export async function abortMultipartUpload(key: string, uploadId: string): Promise<void> {
  const { client, bucket } = r2();
  await client.send(
    new AbortMultipartUploadCommand({ Bucket: bucket, Key: key, UploadId: uploadId })
  );
}

export function presignGetObject(key: string, ttlSeconds: number): Promise<string> {
  const { client, bucket } = r2();
  return getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), {
    expiresIn: ttlSeconds,
  });
}

/**
 * A link that saves the object under `filename` instead of playing it.
 *
 * The filename has to be set on the signed request rather than with HTML's
 * `download` attribute, which browsers ignore for a cross-origin link — without
 * it the file would land as the storage key's random-looking name.
 */
export function presignDownloadObject(
  key: string,
  ttlSeconds: number,
  filename: string
): Promise<string> {
  const { client, bucket } = r2();
  return getSignedUrl(
    client,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ResponseContentDisposition: `attachment; filename="${filename}"`,
    }),
    { expiresIn: ttlSeconds }
  );
}

export async function objectExists(key: string): Promise<boolean> {
  const { client, bucket } = r2();
  try {
    await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch (err) {
    const name = errorName(err);
    if (name === "NotFound" || name === "NoSuchKey" || httpStatus(err) === 404) return false;
    // Anything else (auth, network, throttling) must surface: treating it as
    // "missing" would make the sweep mark good recordings as failed.
    throw err;
  }
}

/** Adapter handed to sweepRecordings. */
export const sweepOps: SweepR2Ops = {
  async listParts(key, uploadId) {
    try {
      const parts = await listAllParts(key, uploadId);
      return {
        count: parts.length,
        maxPartBytes: parts.reduce((largest, part) => Math.max(largest, part.Size), 0),
      };
    } catch (err) {
      if (isNoSuchUpload(err)) return null;
      throw err;
    }
  },
  async completeUpload(key, uploadId) {
    await completeMultipartUpload(key, uploadId, await listAllParts(key, uploadId));
  },
  abortUpload: abortMultipartUpload,
  objectExists,
};
