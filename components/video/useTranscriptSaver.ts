"use client";

import { useCallback, useEffect, useRef } from "react";
import { MAX_LINES_PER_REQUEST, MAX_LINE_CHARS } from "@/lib/sessionNotes";

/** How often buffered lines are sent, so a lesson costs a few requests, not one per phrase. */
const FLUSH_INTERVAL_MS = 15_000;
/** Ceiling on unsent lines, so a long outage cannot grow the buffer without bound. */
const MAX_BUFFERED_LINES = 200;

export interface SpokenLine {
  at: Date;
  name: string;
  lang: string;
  text: string;
}

interface WireLine {
  at: string;
  name: string;
  lang: string;
  text: string;
}

/**
 * Collects the local speaker's final captions and posts them as the session
 * transcript that AI notes are generated from. Only group classes keep a
 * transcript, so `enabled` is false for one-to-one lessons and the lines are
 * simply dropped.
 */
export function useTranscriptSaver(opts: { bookingId: string; enabled: boolean }) {
  const { bookingId, enabled } = opts;
  const buffer = useRef<WireLine[]>([]);

  const recordLine = useCallback(
    (line: SpokenLine) => {
      if (!enabled) return;
      const text = line.text.trim();
      if (!text) return;
      buffer.current.push({
        at: line.at.toISOString(),
        name: line.name,
        lang: line.lang,
        // The server rejects an over-long line and with it the whole batch, so
        // a rare very long phrase is trimmed rather than losing the batch.
        text: text.slice(0, MAX_LINE_CHARS),
      });
      if (buffer.current.length > MAX_BUFFERED_LINES) {
        buffer.current = buffer.current.slice(-MAX_BUFFERED_LINES);
      }
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) return;

    async function flush() {
      const lines = buffer.current.splice(0, MAX_LINES_PER_REQUEST);
      if (lines.length === 0) return;
      try {
        const res = await fetch("/api/transcripts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bookingId, lines }),
        });
        if (!res.ok) {
          // Put them back for the next tick, but only transport-level failures
          // deserve a retry: a rejected batch would fail again forever.
          if (res.status >= 500) buffer.current.unshift(...lines);
          console.error(`transcript flush failed with ${res.status}`);
        }
      } catch (err) {
        buffer.current.unshift(...lines);
        console.error("transcript flush failed", err);
      }
    }

    const timer = setInterval(flush, FLUSH_INTERVAL_MS);
    return () => {
      clearInterval(timer);
      // Last words of the lesson: a beacon still goes out while the page is
      // being torn down, and it carries the session cookie.
      const lines = buffer.current.splice(0, MAX_LINES_PER_REQUEST);
      if (lines.length === 0) return;
      const payload = JSON.stringify({ bookingId, lines });
      if (typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon("/api/transcripts", new Blob([payload], { type: "application/json" }));
        return;
      }
      void fetch("/api/transcripts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: payload,
        keepalive: true,
      }).catch((err) => console.error("transcript final flush failed", err));
    };
  }, [bookingId, enabled]);

  return { recordLine };
}
