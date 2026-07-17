"use client";

import { useSyncExternalStore } from "react";
import { formatSessionDate, PLATFORM_TIMEZONE } from "@/lib/datetime";

const subscribe = () => () => {};

/**
 * Renders a session time in the viewer's browser timezone.
 * The server snapshot uses the platform timezone so SSR output is
 * deterministic; after hydration React swaps in the browser-timezone
 * value, matching what the dashboard pages show.
 */
export function LocalDate({ iso, locale }: { iso: string; locale: string }) {
  const text = useSyncExternalStore(
    subscribe,
    () => formatSessionDate(iso, locale, Intl.DateTimeFormat().resolvedOptions().timeZone),
    () => formatSessionDate(iso, locale, PLATFORM_TIMEZONE)
  );

  return <time dateTime={iso}>{text}</time>;
}
