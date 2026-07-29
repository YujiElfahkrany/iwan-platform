// Builds one recordable audio+video stream out of the live session: every
// participant tile is painted onto an offscreen canvas and every audio track is
// summed into a single mix. No React here on purpose — the class owns raw DOM
// and Web Audio objects whose lifetime does not follow render cycles.

/** Everything the composite needs to know about the room right now. */
export type CompositeSources = {
  /** One entry per tile, in display order. A null track draws an empty tile. */
  video: Array<{ track: MediaStreamTrack | null; label: string }>;
  audio: MediaStreamTrack[];
};

const WIDTH = 1280;
const HEIGHT = 720;
const FPS = 15;
/** How often we re-read the room and add/remove tiles and audio inputs. */
const SYNC_INTERVAL_MS = 500;
/** Same slate as the room UI, so recordings look like what people saw. */
const EMPTY_TILE_COLOR = "#1e293b";
const LABEL_FONT = "16px system-ui, sans-serif";
const LABEL_BOX_HEIGHT = 22;
const LABEL_MARGIN = 8;
const LABEL_PADDING_X = 6;

interface Tile {
  video: HTMLVideoElement | null;
  label: string;
}

interface AudioInput {
  source: MediaStreamAudioSourceNode;
  gain: GainNode;
}

export interface Grid {
  cols: number;
  rows: number;
}

export interface FittedRect {
  /** Offset of the drawn image inside its tile. */
  dx: number;
  dy: number;
  w: number;
  h: number;
}

/** Same rule as the room's CSS grid: 1 tile fills the frame, 2-4 use two
 *  columns, anything larger uses three. */
export function gridDimensions(count: number): Grid {
  const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3;
  return { cols, rows: Math.max(1, Math.ceil(count / cols)) };
}

/** Largest centred rectangle of the given aspect ratio that fits in the box. */
export function containRect(
  srcW: number,
  srcH: number,
  boxW: number,
  boxH: number,
): FittedRect {
  // A video that has not produced a frame yet reports 0x0; dividing by that
  // would yield NaN coordinates, so report "nothing to draw" instead.
  if (srcW <= 0 || srcH <= 0) return { dx: 0, dy: 0, w: 0, h: 0 };
  const scale = Math.min(boxW / srcW, boxH / srcH);
  const w = srcW * scale;
  const h = srcH * scale;
  return { dx: (boxW - w) / 2, dy: (boxH - h) / 2, w, h };
}

export class SessionComposite {
  private readonly getSources: () => CompositeSources;
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private canvasStream: MediaStream | null = null;
  private output: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private mixBus: MediaStreamAudioDestinationNode | null = null;
  /** Keyed by MediaStreamTrack.id — the only stable identity a track has. */
  private readonly videoElements = new Map<string, HTMLVideoElement>();
  private readonly audioInputs = new Map<string, AudioInput>();
  private tiles: Tile[] = [];
  private drawTimer: ReturnType<typeof setInterval> | null = null;
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private stopped = false;

  constructor(getSources: () => CompositeSources) {
    this.getSources = getSources;
  }

  start(): MediaStream {
    if (this.output) return this.output;
    if (this.stopped) throw new Error("SessionComposite cannot be restarted");

    const canvas = document.createElement("canvas");
    canvas.width = WIDTH;
    canvas.height = HEIGHT;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas context unavailable");
    this.canvas = canvas;
    this.ctx = ctx;

    this.audioCtx = new AudioContext();
    this.mixBus = this.audioCtx.createMediaStreamDestination();
    // start() runs from the teacher's click, so resuming is permitted here.
    void this.audioCtx.resume().catch((err) => {
      console.error("recording: could not resume audio context", err);
    });

    this.sync();
    this.syncTimer = setInterval(() => this.sync(), SYNC_INTERVAL_MS);

    this.draw();
    // A timer, not requestAnimationFrame: rAF stops completely once the tab is
    // in the background, which would freeze the recording whenever the teacher
    // switches windows.
    this.drawTimer = setInterval(() => this.draw(), 1000 / FPS);

    this.canvasStream = canvas.captureStream(FPS);
    this.output = new MediaStream([
      ...this.canvasStream.getVideoTracks(),
      ...this.mixBus.stream.getAudioTracks(),
    ]);
    return this.output;
  }

  stop(): void {
    if (this.stopped) return;
    this.stopped = true;

    if (this.syncTimer !== null) clearInterval(this.syncTimer);
    if (this.drawTimer !== null) clearInterval(this.drawTimer);
    this.syncTimer = null;
    this.drawTimer = null;

    for (const el of this.videoElements.values()) detachVideo(el);
    this.videoElements.clear();
    this.tiles = [];

    for (const input of this.audioInputs.values()) disconnectAudio(input);
    this.audioInputs.clear();

    this.canvasStream?.getTracks().forEach((track) => track.stop());
    this.canvasStream = null;
    this.output = null;

    const audioCtx = this.audioCtx;
    this.mixBus = null;
    this.audioCtx = null;
    void audioCtx?.close().catch((err) => {
      console.error("recording: could not close audio context", err);
    });

    this.canvas = null;
    this.ctx = null;
  }

  /**
   * Re-reads the room and reconciles it with what is currently attached.
   * Polling a getter (instead of reacting to individual events) is what makes
   * every kind of mid-session change work the same way: someone joins or
   * leaves, a remote track only shows up once we finish subscribing to it, a
   * screen share takes the camera's place, or the microphone track is rebuilt
   * when the teacher unmutes.
   */
  private sync(): void {
    if (this.stopped) return;
    const sources = this.getSources();

    const liveVideoIds = new Set<string>();
    this.tiles = sources.video.map(({ track, label }) => {
      if (!track) return { video: null, label };
      liveVideoIds.add(track.id);
      let el = this.videoElements.get(track.id);
      if (!el) {
        el = attachVideo(track);
        this.videoElements.set(track.id, el);
      }
      return { video: el, label };
    });
    for (const [id, el] of this.videoElements) {
      if (liveVideoIds.has(id)) continue;
      detachVideo(el);
      this.videoElements.delete(id);
    }

    const audioCtx = this.audioCtx;
    const mixBus = this.mixBus;
    if (!audioCtx || !mixBus) return;
    const liveAudioIds = new Set<string>();
    for (const track of sources.audio) {
      liveAudioIds.add(track.id);
      if (this.audioInputs.has(track.id)) continue;
      const source = audioCtx.createMediaStreamSource(new MediaStream([track]));
      const gain = audioCtx.createGain();
      gain.gain.value = 1;
      source.connect(gain);
      gain.connect(mixBus);
      this.audioInputs.set(track.id, { source, gain });
    }
    for (const [id, input] of this.audioInputs) {
      if (liveAudioIds.has(id)) continue;
      disconnectAudio(input);
      this.audioInputs.delete(id);
    }
  }

  private draw(): void {
    const ctx = this.ctx;
    if (!ctx || this.stopped) return;

    // One background fill covers empty tiles and the letterbox bars around
    // videos that do not match their tile's shape.
    ctx.fillStyle = EMPTY_TILE_COLOR;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const tiles = this.tiles;
    if (tiles.length === 0) return;

    const { cols, rows } = gridDimensions(tiles.length);
    const tileW = WIDTH / cols;
    const tileH = HEIGHT / rows;

    tiles.forEach((tile, index) => {
      const x = (index % cols) * tileW;
      const y = Math.floor(index / cols) * tileH;
      ctx.save();
      // Clipping keeps an oversized label or a rounding overshoot from
      // bleeding into the neighbouring tile.
      ctx.beginPath();
      ctx.rect(x, y, tileW, tileH);
      ctx.clip();
      const video = tile.video;
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        const fit = containRect(video.videoWidth, video.videoHeight, tileW, tileH);
        ctx.drawImage(video, x + fit.dx, y + fit.dy, fit.w, fit.h);
      }
      drawLabel(ctx, tile.label, x, y + tileH);
      ctx.restore();
    });
  }
}

function attachVideo(track: MediaStreamTrack): HTMLVideoElement {
  const el = document.createElement("video");
  el.muted = true;
  el.autoplay = true;
  el.playsInline = true;
  el.srcObject = new MediaStream([track]);
  // Never added to the document: it exists only as a frame source for
  // drawImage. Playback can still be refused (e.g. the track ended in the same
  // tick), which must not break the sync pass.
  void el.play().catch((err) => {
    console.error("recording: video source failed to play", err);
  });
  return el;
}

function detachVideo(el: HTMLVideoElement): void {
  el.pause();
  el.srcObject = null;
}

function disconnectAudio(input: AudioInput): void {
  input.source.disconnect();
  input.gain.disconnect();
}

function drawLabel(
  ctx: CanvasRenderingContext2D,
  label: string,
  tileX: number,
  tileBottom: number,
): void {
  if (!label) return;
  ctx.font = LABEL_FONT;
  ctx.textBaseline = "alphabetic";
  const width = ctx.measureText(label).width + LABEL_PADDING_X * 2;
  const boxY = tileBottom - LABEL_MARGIN - LABEL_BOX_HEIGHT;
  ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
  ctx.fillRect(tileX + LABEL_MARGIN, boxY, width, LABEL_BOX_HEIGHT);
  ctx.fillStyle = "#ffffff";
  ctx.fillText(label, tileX + LABEL_MARGIN + LABEL_PADDING_X, boxY + LABEL_BOX_HEIGHT - 6);
}
