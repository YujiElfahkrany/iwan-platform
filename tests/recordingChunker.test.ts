// Pure tests for the upload part accumulator (lib/recordingChunker.ts).
// Blob is available natively in Node 18+, so no browser environment is needed.
import { describe, expect, it } from "vitest";
import { createPartAccumulator } from "@/lib/recordingChunker";

function blobOfSize(bytes: number, fill = "a"): Blob {
  return new Blob([fill.repeat(bytes)]);
}

// A small threshold keeps tests fast; the accumulator is size-agnostic.
const MIN = 10;

describe("createPartAccumulator", () => {
  it("emits nothing while the buffer is below the minimum part size", () => {
    const acc = createPartAccumulator(MIN);
    expect(acc.push(blobOfSize(4))).toEqual([]);
    expect(acc.push(blobOfSize(5))).toEqual([]);
    expect(acc.bufferedBytes()).toBe(9);
  });

  it("emits exactly one part when the buffer crosses the threshold", () => {
    const acc = createPartAccumulator(MIN);
    acc.push(blobOfSize(6));
    const parts = acc.push(blobOfSize(6));
    expect(parts).toHaveLength(1);
    expect(parts[0].partNumber).toBe(1);
    expect(parts[0].blob.size).toBe(12); // whole buffer, may exceed the minimum
    expect(acc.bufferedBytes()).toBe(0);
  });

  it("numbers parts sequentially across multiple emissions", () => {
    const acc = createPartAccumulator(MIN);
    const first = acc.push(blobOfSize(MIN));
    const second = acc.push(blobOfSize(MIN));
    expect(first[0].partNumber).toBe(1);
    expect(second[0].partNumber).toBe(2);
  });

  it("flushes the sub-minimum remainder as a final part", () => {
    const acc = createPartAccumulator(MIN);
    acc.push(blobOfSize(MIN)); // part 1
    acc.push(blobOfSize(3));
    const tail = acc.flush();
    expect(tail).not.toBeNull();
    expect(tail?.partNumber).toBe(2);
    expect(tail?.blob.size).toBe(3);
  });

  it("returns null when flushing an empty buffer", () => {
    const acc = createPartAccumulator(MIN);
    expect(acc.flush()).toBeNull();
  });

  it("preserves the recorded bytes exactly across emission boundaries", async () => {
    const acc = createPartAccumulator(MIN);
    const inputs = ["abcdef", "ghijkl", "mn"];
    const emitted = inputs.flatMap((s) => acc.push(new Blob([s])));
    const tail = acc.flush();
    const all = [...emitted, ...(tail ? [tail] : [])];
    const texts = await Promise.all(all.map((p) => p.blob.text()));
    expect(texts.join("")).toBe(inputs.join(""));
  });
});
