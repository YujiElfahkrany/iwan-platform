"use client";

import { useCallback, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ChevronDown, FileText, Loader2 } from "lucide-react";

interface SessionNoteItem {
  dateKey: string;
  status: "pending" | "done" | "failed";
  /** The summary already picked for the viewer's language by the API. */
  note: string | null;
}

/** Same locale → BCP 47 mapping the platform uses elsewhere for dates. */
const DATE_FORMAT_LOCALES: Record<string, string> = {
  ar: "ar-EG",
  ru: "ru-RU",
  en: "en-GB",
};

/**
 * A dateKey is a bare calendar day (already resolved in the platform timezone),
 * so it must be formatted at UTC: reading it in the viewer's timezone would
 * shift the day for anyone west of Cairo.
 */
function formatDateKey(dateKey: string, locale: string): string {
  return new Date(`${dateKey}T00:00:00Z`).toLocaleDateString(
    DATE_FORMAT_LOCALES[locale] ?? "en-GB",
    { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }
  );
}

/**
 * Collapsible list of AI session notes for one group class. The notes are
 * model-generated from what participants said, so the text is rendered as plain
 * React nodes only — never as HTML.
 */
export function ClassSessionNotes({ classId }: { classId: string }) {
  const t = useTranslations("notes");
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [sessions, setSessions] = useState<SessionNoteItem[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [failedToLoad, setFailedToLoad] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setFailedToLoad(false);
    try {
      const res = await fetch(`/api/classes/${classId}/notes?locale=${locale}`);
      if (!res.ok) throw new Error(`Session notes request failed: ${res.status}`);
      const data = await res.json();
      setSessions(data.sessions);
    } catch (err) {
      console.error(err);
      setFailedToLoad(true);
    } finally {
      setLoading(false);
    }
  }, [classId, locale]);

  // Fetched on first expand only: a class list renders many of these cards.
  function toggle() {
    const next = !open;
    setOpen(next);
    if (next && sessions === null && !loading) load();
  }

  return (
    <div className="border-t pt-3">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full items-start gap-2 text-start text-sm font-medium text-foreground transition-colors hover:text-primary"
      >
        <FileText className="mt-0.5 h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 break-words leading-relaxed">{t("title")}</span>
        <ChevronDown
          className={`mt-0.5 h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div className="mt-3 space-y-2">
          {loading ? (
            <div className="flex justify-center py-2">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : failedToLoad ? (
            <p className="break-words text-sm leading-relaxed text-destructive">{t("load_error")}</p>
          ) : sessions?.length === 0 ? (
            <p className="break-words text-sm leading-relaxed text-muted-foreground">{t("none")}</p>
          ) : (
            sessions?.map((s) => (
              <div key={s.dateKey} className="rounded-lg border bg-muted/30 p-3">
                <p className="break-words text-xs font-medium leading-relaxed text-muted-foreground">
                  {t("generated_on", { date: formatDateKey(s.dateKey, locale) })}
                </p>
                {s.status === "done" && s.note ? (
                  <div
                    dir="auto"
                    className="mt-1.5 space-y-1.5 break-words text-sm leading-relaxed text-foreground"
                  >
                    {s.note
                      .split("\n")
                      .filter((line) => line.trim() !== "")
                      .map((line, i) => (
                        <p key={i}>{line}</p>
                      ))}
                  </div>
                ) : (
                  <p className="mt-1.5 break-words text-sm leading-relaxed text-muted-foreground">
                    {s.status === "pending" ? t("pending") : t("failed")}
                  </p>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
