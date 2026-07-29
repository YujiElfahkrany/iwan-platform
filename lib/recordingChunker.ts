// Accumulates small MediaRecorder blobs into S3-legal multipart parts.
// Pure aside from Blob (available in Node 18+ and browsers), so it is
// unit-tested directly.
import { MIN_PART_BYTES } from "@/lib/recording";

export interface PendingPart {
  partNumber: number;
  blob: Blob;
}

export interface PartAccumulator {
  /** Add a recorded blob; returns any part that became ready to upload. */
  push(blob: Blob): PendingPart[];
  /** Drain the remainder (allowed below the minimum only as the last part). */
  flush(): PendingPart | null;
  bufferedBytes(): number;
}

export function createPartAccumulator(minPartBytes: number = MIN_PART_BYTES): PartAccumulator {
  let buffer: Blob[] = [];
  let buffered = 0;
  let nextPartNumber = 1;

  function emit(): PendingPart {
    const part: PendingPart = { partNumber: nextPartNumber, blob: new Blob(buffer) };
    nextPartNumber += 1;
    buffer = [];
    buffered = 0;
    return part;
  }

  return {
    push(blob: Blob): PendingPart[] {
      buffer.push(blob);
      buffered += blob.size;
      // Emit the whole buffer as one part; parts may exceed the minimum,
      // which S3 allows (the minimum only binds non-final parts from below).
      return buffered >= minPartBytes ? [emit()] : [];
    },
    flush(): PendingPart | null {
      return buffered > 0 ? emit() : null;
    },
    bufferedBytes(): number {
      return buffered;
    },
  };
}
