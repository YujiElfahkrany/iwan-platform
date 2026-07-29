import { pickDisplayText, type CaptionEntry, type PlatformLocale } from "@/lib/captions";

export interface CaptionsOverlayProps {
  /** Lines to show, oldest first — already filtered by the captions hook. */
  captions: CaptionEntry[];
  viewerLocale: PlatformLocale;
}

/**
 * The caption strip. Pin it inside a `relative` container (the video grid or a
 * single tile). Purely presentational: text only, never HTML.
 */
export function CaptionsOverlay({ captions, viewerLocale }: CaptionsOverlayProps) {
  if (captions.length === 0) return null;

  return (
    <div className="absolute inset-x-0 bottom-2 flex flex-col items-center gap-1 px-4 pointer-events-none">
      {captions.map((entry) => (
        <p
          key={`${entry.sender}-${entry.seq}`}
          className={`max-w-[80%] rounded bg-black/70 px-3 py-1 text-sm break-words ${
            entry.final ? "text-white" : "italic text-white/80"
          }`}
        >
          <span className="text-white/70">{entry.name}: </span>
          {/* The spoken language decides this text's direction, which can differ
              from the page direction (Arabic speech on an English UI). */}
          <span dir="auto">{pickDisplayText(entry, viewerLocale)}</span>
        </p>
      ))}
    </div>
  );
}
