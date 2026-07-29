"use client";

// Records the composited session in the teacher's browser and streams it to R2
// while the class is still running, so nothing large has to be uploaded at the
// end. The upload machinery lives in a plain closure (createController) and the
// hook is only the thin React wrapper around it.

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { MAX_QUEUED_PARTS, MAX_RECORDING_MS, PART_URL_BATCH } from "@/lib/recording";
import {
  createPartAccumulator,
  type PartAccumulator,
  type PendingPart,
} from "@/lib/recordingChunker";
import { SessionComposite, type CompositeSources } from "./recordingComposite";

export type { CompositeSources };

const MIME_TYPE = "video/webm;codecs=vp8,opus";
const VIDEO_BITS_PER_SECOND = 1_100_000;
const AUDIO_BITS_PER_SECOND = 128_000;
/** Blob every second: an unexpected crash can then lose at most a second more
 *  than what is already buffered. */
const TIMESLICE_MS = 1000;
/** Waits before the 1st, 2nd and 3rd retry of a failed part upload. */
const RETRY_DELAYS_MS = [1000, 4000, 10_000];
/** Top the URL pool up before it runs dry; the same request is the heartbeat
 *  that tells the server this recording is still alive. */
const URL_POOL_LOW_WATER = 2;

export type RecorderState = "idle" | "starting" | "recording" | "stopping" | "error";

export interface SessionRecorder {
  state: RecorderState;
  start: () => void;
  stop: () => Promise<void>;
  supported: boolean;
  error: string | null;
}

interface PartUrl {
  partNumber: number;
  url: string;
}

interface StartResponse {
  recordingId: string;
  partUrls: PartUrl[];
}

interface PartsResponse {
  urls: PartUrl[];
}

/** Carries the HTTP status so a 403 (expired signature) can be handled. */
class UploadError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`part upload failed with status ${status}`);
    this.name = "UploadError";
    this.status = status;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function postJson<T>(url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    ...(body === undefined
      ? {}
      : { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }),
  });
  if (!res.ok) throw new Error(`POST ${url} failed with status ${res.status}`);
  return (await res.json()) as T;
}

async function putBlob(url: string, blob: Blob): Promise<void> {
  const res = await fetch(url, { method: "PUT", body: blob });
  // ETags are deliberately ignored: the server finalises the upload from S3's
  // own part listing, so no response header has to be readable here.
  if (!res.ok) throw new UploadError(res.status);
}

function stopRecorder(recorder: MediaRecorder): Promise<void> {
  if (recorder.state === "inactive") return Promise.resolve();
  return new Promise((resolve) => {
    // "stop" fires after the last dataavailable, so waiting for it guarantees
    // the tail of the recording is already in the accumulator.
    recorder.addEventListener("stop", () => resolve(), { once: true });
    recorder.stop();
  });
}

interface Session {
  recordingId: string;
  composite: SessionComposite;
  recorder: MediaRecorder;
  accumulator: PartAccumulator;
  /** Presigned PUT URLs not used yet, lowest part number first. */
  urlPool: PartUrl[];
  highestIssued: number;
  queue: PendingPart[];
  /** Serialises uploads: exactly one PUT is ever in flight. */
  chain: Promise<void>;
  fatal: boolean;
  completed: boolean;
  autoStopTimer: ReturnType<typeof setTimeout> | null;
  onPageHide: (() => void) | null;
  stopPromise: Promise<void> | null;
}

interface ControllerDeps {
  getOptions: () => { bookingId: string; getSources: () => CompositeSources };
  setState: (state: RecorderState) => void;
  setError: (error: string | null) => void;
}

interface Controller {
  start: () => void;
  stop: () => Promise<void>;
  dispose: () => void;
}

function createController(deps: ControllerDeps): Controller {
  let session: Session | null = null;
  let starting = false;

  function addUrls(s: Session, urls: PartUrl[]): void {
    for (const entry of urls) {
      s.urlPool.push(entry);
      s.highestIssued = Math.max(s.highestIssued, entry.partNumber);
    }
  }

  async function requestUrls(s: Session, fromPart: number, count: number): Promise<PartUrl[]> {
    const data = await postJson<PartsResponse>(`/api/recordings/${s.recordingId}/parts`, {
      fromPart,
      count,
    });
    return data.urls;
  }

  async function takeUrl(s: Session, partNumber: number): Promise<string> {
    if (s.urlPool.length < URL_POOL_LOW_WATER) {
      addUrls(s, await requestUrls(s, s.highestIssued + 1, PART_URL_BATCH));
    }
    const index = s.urlPool.findIndex((entry) => entry.partNumber === partNumber);
    if (index === -1) return refreshUrl(s, partNumber);
    const [entry] = s.urlPool.splice(index, 1);
    return entry.url;
  }

  async function refreshUrl(s: Session, partNumber: number): Promise<string> {
    const urls = await requestUrls(s, partNumber, 1);
    const match = urls.find((entry) => entry.partNumber === partNumber);
    if (!match) throw new Error(`server did not return a URL for part ${partNumber}`);
    return match.url;
  }

  async function uploadPart(s: Session, part: PendingPart): Promise<void> {
    let url: string | null = null;
    for (let attempt = 0; ; attempt += 1) {
      try {
        // Getting the URL is part of the attempt, so a hiccup while asking the
        // server for one gets the same backoff as a failed upload.
        if (url === null) url = await takeUrl(s, part.partNumber);
        await putBlob(url, part.blob);
        return;
      } catch (err) {
        if (attempt >= RETRY_DELAYS_MS.length) throw err;
        console.error(`recording: retrying part ${part.partNumber}`, err);
        // 403 means the signature expired rather than the upload being
        // rejected, so the next attempt has to sign a fresh URL. This part's
        // URL is no longer in the pool, so takeUrl re-signs it.
        if (err instanceof UploadError && err.status === 403) url = null;
        await sleep(RETRY_DELAYS_MS[attempt]);
      }
    }
  }

  async function drainQueue(s: Session): Promise<void> {
    while (s.queue.length > 0 && !s.fatal) {
      const part = s.queue[0];
      try {
        await uploadPart(s, part);
      } catch (err) {
        console.error(`recording: gave up on part ${part.partNumber}`, err);
        await fail(s, "Upload failed — recording stopped");
        return;
      }
      s.queue.shift();
    }
  }

  function enqueue(s: Session, parts: PendingPart[]): void {
    if (s.fatal || parts.length === 0) return;
    s.queue.push(...parts);
    if (s.queue.length > MAX_QUEUED_PARTS) {
      // Every queued part is a multi-megabyte blob on the heap, so an upload
      // that cannot keep up has to end the recording instead of the tab.
      void fail(s, "Recording stopped — the connection could not keep up");
      return;
    }
    s.chain = s.chain.then(() => drainQueue(s));
  }

  async function complete(s: Session): Promise<void> {
    if (s.completed) return;
    s.completed = true;
    try {
      await postJson<{ status: string }>(`/api/recordings/${s.recordingId}/complete`);
    } catch (err) {
      console.error("recording: could not finalise the upload", err);
    }
  }

  /** Releases browser resources; leaves the queue and the server alone. */
  function teardown(s: Session): void {
    if (s.autoStopTimer !== null) clearTimeout(s.autoStopTimer);
    s.autoStopTimer = null;
    if (s.onPageHide) window.removeEventListener("pagehide", s.onPageHide);
    s.onPageHide = null;
    if (s.recorder.state !== "inactive") s.recorder.stop();
    s.composite.stop();
  }

  async function fail(s: Session, message: string): Promise<void> {
    if (s.fatal) return;
    s.fatal = true;
    teardown(s);
    if (session === s) session = null;
    deps.setError(message);
    deps.setState("error");
    // Finalising anyway keeps the parts that did upload playable.
    await complete(s);
  }

  async function runStop(s: Session): Promise<void> {
    deps.setState("stopping");
    if (s.autoStopTimer !== null) clearTimeout(s.autoStopTimer);
    s.autoStopTimer = null;
    if (s.onPageHide) window.removeEventListener("pagehide", s.onPageHide);
    s.onPageHide = null;

    await stopRecorder(s.recorder);
    s.composite.stop();
    enqueue(s, [s.accumulator.flush()].filter((part): part is PendingPart => part !== null));
    await s.chain;
    if (s.fatal) return;
    await complete(s);
    if (session === s) session = null;
    deps.setState("idle");
  }

  async function begin(): Promise<void> {
    let composite: SessionComposite | null = null;
    let recordingId: string | null = null;
    let created: Session | null = null;
    try {
      const init = await postJson<StartResponse>("/api/recordings", {
        bookingId: deps.getOptions().bookingId,
      });
      recordingId = init.recordingId;
      // Read through the options getter on every sync pass so the composite
      // always sees the room's current tracks, not the ones from start time.
      composite = new SessionComposite(() => deps.getOptions().getSources());
      const stream = composite.start();
      const recorder = new MediaRecorder(stream, {
        mimeType: MIME_TYPE,
        videoBitsPerSecond: VIDEO_BITS_PER_SECOND,
        audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
      });
      const s: Session = {
        recordingId: init.recordingId,
        composite,
        recorder,
        accumulator: createPartAccumulator(),
        urlPool: [],
        highestIssued: 0,
        queue: [],
        chain: Promise.resolve(),
        fatal: false,
        completed: false,
        autoStopTimer: null,
        onPageHide: null,
        stopPromise: null,
      };
      created = s;
      addUrls(s, init.partUrls);

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size === 0) return;
        enqueue(s, s.accumulator.push(event.data));
      };
      recorder.onerror = (event: Event) => {
        console.error("recording: MediaRecorder error", event);
        void fail(s, "Recording stopped — the browser recorder failed");
      };

      s.onPageHide = () => {
        // Best effort on a dying tab: the beacon can only ask the server to
        // finalise what already arrived, never carry the unsent tail (up to one
        // part, i.e. roughly 35 s). If even the beacon is lost, the server's
        // cron sweep finalises recordings whose tab disappeared.
        navigator.sendBeacon(`/api/recordings/${s.recordingId}/complete`);
        s.completed = true;
      };
      window.addEventListener("pagehide", s.onPageHide);
      s.autoStopTimer = setTimeout(() => {
        void stop();
      }, MAX_RECORDING_MS);

      recorder.start(TIMESLICE_MS);
      session = s;
      deps.setError(null);
      deps.setState("recording");
    } catch (err) {
      console.error("recording: could not start", err);
      // Undo whatever the half-finished start already registered.
      if (created) teardown(created);
      composite?.stop();
      if (recordingId) {
        // Close the server-side record straight away, otherwise other
        // participants keep seeing a "Recording" badge until the sweep runs.
        try {
          await postJson<{ status: string }>(`/api/recordings/${recordingId}/complete`);
        } catch (completeErr) {
          console.error("recording: could not finalise the failed start", completeErr);
        }
      }
      deps.setError("Recording could not be started");
      deps.setState("error");
    } finally {
      starting = false;
    }
  }

  function start(): void {
    if (session || starting) return;
    starting = true;
    deps.setError(null);
    deps.setState("starting");
    void begin();
  }

  async function stop(): Promise<void> {
    const s = session;
    if (!s) return;
    if (!s.stopPromise) {
      s.stopPromise = runStop(s).catch((err) => {
        console.error("recording: stop failed", err);
        deps.setError("Recording could not be finished cleanly");
        deps.setState("error");
      });
    }
    await s.stopPromise;
  }

  function dispose(): void {
    // The tab lives on (client-side navigation), so the pending tail can still
    // finish uploading in the background after the component is gone.
    void stop();
  }

  return { start, stop, dispose };
}

export function useSessionRecorder(opts: {
  bookingId: string;
  getSources: () => CompositeSources;
}): SessionRecorder {
  const [state, setState] = useState<RecorderState>("idle");
  const [error, setError] = useState<string | null>(null);
  const optionsRef = useRef(opts);
  useEffect(() => {
    optionsRef.current = opts;
  });

  const controllerRef = useRef<Controller | null>(null);
  useEffect(() => {
    const controller = createController({
      getOptions: () => optionsRef.current,
      setState,
      setError,
    });
    controllerRef.current = controller;
    return () => {
      controllerRef.current = null;
      controller.dispose();
    };
  }, []);

  const start = useCallback(() => {
    controllerRef.current?.start();
  }, []);
  const stop = useCallback(async () => {
    await controllerRef.current?.stop();
  }, []);

  // Read through a store rather than during render: MediaRecorder does not
  // exist on the server, and answering "false" there keeps hydration in step.
  const supported = useSyncExternalStore(subscribeNothing, isSupported, serverUnsupported);

  return { state, start, stop, supported, error };
}

/** Recording support never changes at runtime, so there is nothing to watch. */
function subscribeNothing(): () => void {
  return () => {};
}

function isSupported(): boolean {
  return typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(MIME_TYPE);
}

function serverUnsupported(): boolean {
  return false;
}
