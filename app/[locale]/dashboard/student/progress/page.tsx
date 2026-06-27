"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, Clock, XCircle, Upload, BookOpen } from "lucide-react";
import { toast } from "sonner";

interface CurriculumItem {
  sessionNumber: number;
  assignmentTitle: string;
  description: string;
  maxMarks: number;
}

interface Submission {
  _id: string;
  sessionNumber: number;
  status: "pending" | "approved" | "rejected";
  mark?: number;
  feedback?: string;
}

interface EnrolledClass {
  _id: string;
  title: string;
  subject: string;
  totalSessions: number;
  curriculum: CurriculumItem[];
}

interface ClassProgress {
  cls: EnrolledClass;
  submissions: Submission[];
}

// SVG donut chart — segments drawn clockwise from 12 o'clock
function DonutChart({
  approved,
  pending,
  rejected,
  notSubmitted,
  size = 120,
}: {
  approved: number;
  pending: number;
  rejected: number;
  notSubmitted: number;
  size?: number;
}) {
  const r = 38;
  const C = 2 * Math.PI * r;
  const total = approved + pending + rejected + notSubmitted;
  if (total === 0) return null;

  const pct = Math.round((approved / total) * 100);

  const segments = [
    { count: approved, color: "#22c55e" },
    { count: pending, color: "#f59e0b" },
    { count: rejected, color: "#ef4444" },
    { count: notSubmitted, color: "#d1d5db" },
  ];

  // dashoffset = C*0.25 starts at 12 o'clock; each segment subtracts its arc
  let offset = C * 0.25;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} style={{ transform: "scale(1)" }}>
      {/* Track */}
      <circle cx="50" cy="50" r={r} fill="none" stroke="#e5e7eb" strokeWidth="14" />
      {segments
        .filter((s) => s.count > 0)
        .map((seg, i) => {
          const arc = (seg.count / total) * C;
          const dashOffset = C - offset;
          offset -= arc;
          return (
            <circle
              key={i}
              cx="50"
              cy="50"
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth="14"
              strokeDasharray={`${arc} ${C - arc}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="butt"
            />
          );
        })}
      {/* Center percentage */}
      <text
        x="50"
        y="47"
        textAnchor="middle"
        fontSize="18"
        fontWeight="700"
        fill="#2c1f12"
        fontFamily="system-ui"
      >
        {pct}%
      </text>
      <text
        x="50"
        y="60"
        textAnchor="middle"
        fontSize="8"
        fill="#78716c"
        fontFamily="system-ui"
      >
        مكتمل
      </text>
    </svg>
  );
}

function Legend({ label, color, count }: { label: string; color: string; count: number }) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span className="inline-block h-2.5 w-2.5 rounded-full shrink-0" style={{ background: color }} />
      {label}: {count}
    </div>
  );
}

export default function StudentProgressPage() {
  const t = useTranslations("progress");
  const [progresses, setProgresses] = useState<ClassProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/classes?enrolled=true");
      const rawData = await res.json();
      if (!res.ok) {
        console.error("[progress] API error:", rawData);
        return;
      }
      const classes: EnrolledClass[] = rawData;
      console.log("[progress] enrolled classes:", classes.length, classes.map((c) => ({ id: c._id, title: c.title, curriculum: c.curriculum?.length })));

      const withCurriculum = classes.filter((c) => c.curriculum?.length > 0);

      const results = await Promise.all(
        withCurriculum.map(async (cls) => {
          const subsRes = await fetch(`/api/assignments?classId=${cls._id}`);
          const submissions: Submission[] = subsRes.ok ? await subsRes.json() : [];
          return { cls, submissions };
        })
      );

      setProgresses(results.sort((a, b) => a.cls.title.localeCompare(b.cls.title)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function submit(classId: string, sessionNumber: number, file: File) {
    const key = `${classId}-${sessionNumber}`;
    setUploading(key);
    try {
      const form = new FormData();
      form.append("classId", classId);
      form.append("sessionNumber", String(sessionNumber));
      form.append("file", file);
      const res = await fetch("/api/assignments", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast.success(t("submitted_toast"));
      load();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("submit_error"));
    } finally {
      setUploading(null);
    }
  }

  function statusIcon(status: string | undefined) {
    if (status === "approved") return <CheckCircle className="h-4 w-4 text-green-600" />;
    if (status === "rejected") return <XCircle className="h-4 w-4 text-red-500" />;
    if (status === "pending") return <Clock className="h-4 w-4 text-amber-500" />;
    return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold">{t("page_title")}</h1>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : progresses.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t("no_courses")}</CardContent></Card>
      ) : (
        <div className="space-y-6">
          {progresses.map(({ cls, submissions }) => {
            const approved = submissions.filter((s) => s.status === "approved").length;
            const pending = submissions.filter((s) => s.status === "pending").length;
            const rejected = submissions.filter((s) => s.status === "rejected").length;
            const notSubmitted = cls.curriculum.length - approved - pending - rejected;

            const totalMarks = submissions
              .filter((s) => s.status === "approved" && s.mark !== undefined)
              .reduce((sum, s) => sum + (s.mark ?? 0), 0);
            const maxTotal = cls.curriculum.reduce((sum, c) => sum + c.maxMarks, 0);

            return (
              <Card key={cls._id} className="overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-primary to-[#f59e0b]" />

                {/* Header row: donut + info */}
                <div className="flex items-center gap-5 p-5 pb-3">
                  {/* Donut chart */}
                  <div className="shrink-0">
                    <DonutChart
                      approved={approved}
                      pending={pending}
                      rejected={rejected}
                      notSubmitted={notSubmitted}
                      size={160}
                    />
                  </div>

                  {/* Class info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-[#2c1f12] text-base leading-tight mb-1">{cls.title}</h3>
                    <Badge variant="outline" className="mb-3">{cls.subject}</Badge>

                    {/* Legend */}
                    <div className="space-y-1">
                      {approved > 0 && <Legend label={t("status_approved")} color="#22c55e" count={approved} />}
                      {pending > 0 && <Legend label={t("status_pending")} color="#f59e0b" count={pending} />}
                      {rejected > 0 && <Legend label={t("status_rejected")} color="#ef4444" count={rejected} />}
                      {notSubmitted > 0 && <Legend label={t("not_submitted")} color="#d1d5db" count={notSubmitted} />}
                    </div>

                    {/* Score + sessions */}
                    <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
                      <span className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        {t("sessions_count", { n: cls.totalSessions })}
                      </span>
                      {maxTotal > 0 && (
                        <span className="font-medium text-[#2c1f12]">
                          {t("score", { earned: totalMarks, total: maxTotal })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Assignment rows */}
                <CardContent className="pt-0 px-5 pb-4">
                  <div className="border-t pt-3 space-y-0">
                    {cls.curriculum
                      .sort((a, b) => a.sessionNumber - b.sessionNumber)
                      .map((item) => {
                        const sub = submissions.find((s) => s.sessionNumber === item.sessionNumber);
                        const key = `${cls._id}-${item.sessionNumber}`;
                        const isUploading = uploading === key;

                        return (
                          <div key={item.sessionNumber} className="flex items-center gap-3 py-2.5 border-b last:border-0">
                            {statusIcon(sub?.status)}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.assignmentTitle}</p>
                              <p className="text-xs text-muted-foreground">
                                {t("after_session", { n: item.sessionNumber })} · {t("worth", { n: item.maxMarks })}
                                {item.description && ` · ${item.description}`}
                              </p>
                              {sub?.feedback && (
                                <p className="text-xs text-muted-foreground italic mt-0.5">"{sub.feedback}"</p>
                              )}
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              {sub?.status === "approved" && sub.mark !== undefined && (
                                <span className="text-sm font-bold text-green-700">{sub.mark}/{item.maxMarks}</span>
                              )}
                              {sub?.status === "pending" && (
                                <Badge variant="secondary" className="text-xs">{t("status_pending")}</Badge>
                              )}
                              {(sub?.status === "rejected" || !sub) && (
                                <label className="cursor-pointer">
                                  <Button size="sm" variant="outline" asChild disabled={isUploading}>
                                    <span>
                                      {isUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 me-1" />}
                                      {sub?.status === "rejected" ? t("resubmit_btn") : t("upload_btn")}
                                    </span>
                                  </Button>
                                  <input
                                    type="file"
                                    className="hidden"
                                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) submit(cls._id, item.sessionNumber, file);
                                      e.target.value = "";
                                    }}
                                  />
                                </label>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
