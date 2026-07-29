"use client";

// The "Recording" badge everyone in the room sees. The teacher who is recording
// knows locally; everyone else has to ask the server, because a recording can
// start at any moment after they joined.

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

const POLL_INTERVAL_MS = 20_000;

export interface RecordingIndicatorProps {
  bookingId: string;
  /** True when this browser is the one doing the recording. */
  localActive: boolean;
  /** Ask the server periodically — set for everyone except that browser. */
  poll: boolean;
}

export default function RecordingIndicator({
  bookingId,
  localActive,
  poll,
}: RecordingIndicatorProps) {
  const t = useTranslations("session");
  const [polledActive, setPolledActive] = useState(false);

  useEffect(() => {
    if (!poll) return;
    let cancelled = false;

    async function check(): Promise<void> {
      // Nobody is looking at a hidden tab, so skip the request entirely.
      if (document.hidden) return;
      try {
        const res = await fetch(
          `/api/recordings/active?bookingId=${encodeURIComponent(bookingId)}`,
        );
        if (!res.ok) throw new Error(`active check failed with status ${res.status}`);
        const data = (await res.json()) as { active: boolean };
        if (!cancelled) setPolledActive(data.active);
      } catch (err) {
        // Keep the last known answer and wait for the next tick rather than
        // retrying immediately — a failing endpoint must not be hammered.
        console.error(err);
      }
    }

    void check();
    const timer = setInterval(() => {
      void check();
    }, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [bookingId, poll]);

  // Polled state is ignored while polling is off, so it never has to be reset.
  if (!localActive && !(poll && polledActive)) return null;

  return (
    // A full-width row that centres its child: no transform is involved, so
    // this is centred in Arabic exactly as it is in English. The pill grows
    // with its label (Arabic and Russian read longer) but stays inside the
    // video area on a narrow phone.
    <div className="absolute top-2 inset-x-0 flex justify-center px-4 pointer-events-none">
      <div className="flex max-w-[90%] items-center gap-2 rounded-full bg-black/60 px-3 py-1 text-xs text-white">
        <span className="h-2 w-2 shrink-0 rounded-full bg-red-500 animate-pulse" />
        <span className="min-w-0 truncate whitespace-nowrap">{t("recording_badge")}</span>
      </div>
    </div>
  );
}
