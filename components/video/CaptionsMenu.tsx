"use client";

// Settings popover for live captions. Mount it inside a `relative` wrapper
// around the toolbar button that opens it — it positions itself above that
// button and aligns to the button's end edge (logical, so it flips in RTL).

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { PLATFORM_LOCALES, type PlatformLocale } from "@/lib/captions";
import type { TranslatorStatus } from "./useCaptions";

const SPOKEN_LOCALE_KEY = "captions.spokenLang";

/**
 * The spoken language the user last picked, for the parent's initial state.
 * Safe to call from a `useState` initializer; falls back when there is no
 * stored (or no valid) choice.
 */
export function readStoredSpokenLocale(fallback: PlatformLocale): PlatformLocale {
  if (typeof window === "undefined") return fallback;
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(SPOKEN_LOCALE_KEY);
  } catch (err) {
    // Storage can be blocked entirely (private mode, cookie settings).
    console.warn("[captions] could not read stored spoken language", err);
    return fallback;
  }
  return PLATFORM_LOCALES.find((locale) => locale === stored) ?? fallback;
}

function storeSpokenLocale(locale: PlatformLocale) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(SPOKEN_LOCALE_KEY, locale);
  } catch (err) {
    console.warn("[captions] could not store spoken language", err);
  }
}

export interface CaptionsMenuProps {
  open: boolean;
  onClose: () => void;
  showCaptions: boolean;
  onToggleShow: () => void;
  transcribing: boolean;
  onToggleTranscribe: () => void;
  spokenLocale: PlatformLocale;
  onSpokenLocaleChange: (locale: PlatformLocale) => void;
  sttSupported: boolean;
  sttDenied: boolean;
  translatorStatus: TranslatorStatus;
  /** Signaling is down, so no captions can be exchanged this session. */
  rtmFailed: boolean;
  /** Final captions are stored for AI session notes — disclosed in the consent. */
  transcriptSaved: boolean;
}

export function CaptionsMenu({
  open,
  onClose,
  showCaptions,
  onToggleShow,
  transcribing,
  onToggleTranscribe,
  spokenLocale,
  onSpokenLocaleChange,
  sttSupported,
  sttDenied,
  translatorStatus,
  rtmFailed,
  transcriptSaved,
}: CaptionsMenuProps) {
  const t = useTranslations("captions");
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    // "click" rather than "pointerdown": React's own handlers run first, so a
    // click on the trigger button closes the panel once instead of reopening it.
    const handleClick = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  function changeSpokenLocale(locale: PlatformLocale) {
    storeSpokenLocale(locale);
    onSpokenLocaleChange(locale);
  }

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label={t("title")}
      // Centred over the whole controls row rather than anchored to its button:
      // anchoring put most of the panel past the screen edge on a narrow phone,
      // because the button sits mid-toolbar. Width is capped to the viewport and
      // height to most of it, and every text block wraps, so the longer Russian
      // and Arabic strings cannot escape the panel in either reading direction.
      className="absolute bottom-full inset-x-0 mx-auto z-20 mb-2 w-80 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto space-y-3 rounded-xl bg-[#1e293b] p-3 text-start text-sm text-white shadow-xl ring-1 ring-white/10"
    >
      <p className="font-medium break-words">{t("title")}</p>

      <Switch checked={showCaptions} onToggle={onToggleShow} label={t("show")} />

      <div className="space-y-1">
        <Switch
          checked={transcribing}
          onToggle={onToggleTranscribe}
          label={t("transcribe")}
          disabled={!sttSupported || sttDenied}
        />
        <p className="text-xs leading-relaxed text-white/50 break-words">
          {t("consent")}
          {transcriptSaved ? ` ${t("consent_notes")}` : ""}
        </p>
        {!sttSupported && (
          <p className="text-xs leading-relaxed text-amber-400 break-words">{t("stt_unsupported")}</p>
        )}
        {sttSupported && sttDenied && (
          <p className="text-xs leading-relaxed text-amber-400 break-words">{t("stt_denied")}</p>
        )}
      </div>

      <div className="space-y-1">
        <label htmlFor="captions-spoken-lang" className="block break-words">
          {t("speaking")}
        </label>
        <select
          id="captions-spoken-lang"
          value={spokenLocale}
          onChange={(event) => changeSpokenLocale(event.target.value as PlatformLocale)}
          className="w-full max-w-full truncate rounded-md bg-white/10 px-2 py-1 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-white/40"
        >
          {PLATFORM_LOCALES.map((locale) => (
            // Native option lists use the OS palette, so force a readable pair.
            <option key={locale} value={locale} className="bg-[#1e293b] text-white">
              {t(`lang_${locale}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1 text-xs leading-relaxed text-white/50">
        <p className="break-words">{t("headphones")}</p>
        {translatorStatus === "preparing" && <p className="break-words">{t("preparing")}</p>}
        {translatorStatus === "unavailable" && (
          <p className="break-words">{t("translate_unavailable")}</p>
        )}
        {rtmFailed && <p className="break-words text-amber-400">{t("unavailable")}</p>}
      </div>
    </div>
  );
}

function Switch({
  checked,
  onToggle,
  label,
  disabled,
}: {
  checked: boolean;
  onToggle: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={onToggle}
      className="flex w-full items-start justify-between gap-3 text-start disabled:cursor-not-allowed disabled:opacity-50"
    >
      {/* The label wraps and shrinks; the toggle never gets pushed out. */}
      <span className="min-w-0 flex-1 break-words">{label}</span>
      <span
        className={`relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors ${
          checked ? "bg-emerald-500" : "bg-white/20"
        }`}
      >
        <span
          className={`absolute top-[2px] h-4 w-4 rounded-full bg-white transition-all ${
            checked ? "start-[18px]" : "start-[2px]"
          }`}
        />
      </span>
    </button>
  );
}
