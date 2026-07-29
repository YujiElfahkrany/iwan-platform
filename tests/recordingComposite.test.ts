// Pure geometry of the recording canvas (components/video/recordingComposite.ts).
// The canvas, MediaRecorder and Web Audio parts of that module need a real
// browser and are covered by manual testing; only the layout maths is unit-
// testable, and it is where an off-by-one silently ruins every recording.
import { describe, expect, it } from "vitest";
import { containRect, gridDimensions } from "@/components/video/recordingComposite";

const TILE_W = 640;
const TILE_H = 360;

describe("gridDimensions", () => {
  it("gives a single tile the whole frame", () => {
    expect(gridDimensions(1)).toEqual({ cols: 1, rows: 1 });
  });

  it("puts two tiles side by side in one row", () => {
    expect(gridDimensions(2)).toEqual({ cols: 2, rows: 1 });
  });

  it("arranges four tiles as a 2x2 square", () => {
    expect(gridDimensions(4)).toEqual({ cols: 2, rows: 2 });
  });

  // Five is the boundary where the room UI switches to three columns.
  it("switches to three columns once there are more than four tiles", () => {
    expect(gridDimensions(5)).toEqual({ cols: 3, rows: 2 });
  });

  it("arranges nine tiles as a 3x3 square", () => {
    expect(gridDimensions(9)).toEqual({ cols: 3, rows: 3 });
  });

  it("always provides enough cells for every tile", () => {
    // A grid smaller than the tile count would drop participants from the
    // recording entirely, so this holds across every realistic room size.
    for (let count = 1; count <= 12; count += 1) {
      const { cols, rows } = gridDimensions(count);
      expect(cols * rows).toBeGreaterThanOrEqual(count);
    }
  });

  it("never returns an empty grid for an empty room", () => {
    expect(gridDimensions(0)).toEqual({ cols: 1, rows: 1 });
  });
});

describe("containRect", () => {
  it("letterboxes a source wider than its tile, centring it vertically", () => {
    // 32:9 ultrawide screen share in a 16:9 tile: full width, bars top+bottom.
    const rect = containRect(1280, 360, TILE_W, TILE_H);

    expect(rect.w).toBe(TILE_W);
    expect(rect.h).toBe(180);
    expect(rect.dx).toBe(0);
    expect(rect.dy).toBe((TILE_H - rect.h) / 2);
  });

  it("pillarboxes a source taller than its tile, centring it horizontally", () => {
    // Portrait phone camera in a landscape tile: full height, bars at the sides.
    const rect = containRect(360, 640, TILE_W, TILE_H);

    expect(rect.h).toBe(TILE_H);
    expect(rect.w).toBeCloseTo(202.5);
    expect(rect.dy).toBe(0);
    expect(rect.dx).toBeCloseTo((TILE_W - rect.w) / 2);
  });

  it("fills the tile exactly when the aspect ratios match", () => {
    const rect = containRect(1920, 1080, TILE_W, TILE_H);

    expect(rect).toEqual({ dx: 0, dy: 0, w: TILE_W, h: TILE_H });
  });

  it("keeps the fitted rectangle inside the tile bounds", () => {
    // Anything spilling over would be drawn into the neighbouring tile.
    const sources: Array<[number, number]> = [
      [1280, 720],
      [640, 480],
      [3840, 1080],
      [480, 1280],
      [1, 1000],
    ];
    for (const [srcW, srcH] of sources) {
      const rect = containRect(srcW, srcH, TILE_W, TILE_H);
      expect(rect.dx).toBeGreaterThanOrEqual(0);
      expect(rect.dy).toBeGreaterThanOrEqual(0);
      expect(rect.dx + rect.w).toBeLessThanOrEqual(TILE_W);
      expect(rect.dy + rect.h).toBeLessThanOrEqual(TILE_H);
    }
  });

  it("returns an empty rectangle for a video that has no frame yet", () => {
    // A freshly attached <video> reports 0x0 until the first frame decodes;
    // scaling from that must not produce NaN draw coordinates.
    expect(containRect(0, 0, TILE_W, TILE_H)).toEqual({ dx: 0, dy: 0, w: 0, h: 0 });
    expect(containRect(1280, 0, TILE_W, TILE_H)).toEqual({ dx: 0, dy: 0, w: 0, h: 0 });
  });
});
