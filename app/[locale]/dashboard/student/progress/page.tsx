"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  function progressPercent(submissions: Submission[], curriculum: CurriculumItem[]) {
    if (!curriculum.length) return 0;
    const approved = submissions.filter((s) => s.status === "approved").length;
    return Math.round((approved / curriculum.length) * 100);
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
            const pct = progressPercent(submissions, cls.curriculum);
            const totalMarks = submissions
              .filter((s) => s.status === "approved" && s.mark !== undefined)
              .reduce((sum, s) => sum + (s.mark ?? 0), 0);
            const maxTotal = cls.curriculum.reduce((sum, c) => sum + c.maxMarks, 0);

            return (
              <Card key={cls._id}>
                <div className="h-1.5 bg-gradient-to-r from-primary to-[#f59e0b]" />
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <CardTitle className="text-base">{cls.title}</CardTitle>
                      <Badge variant="outline" className="mt-1">{cls.subject}</Badge>
                    </div>
                    <div className="text-end">
                      <p className="text-2xl font-bold text-primary">{pct}%</p>
                      <p className="text-xs text-muted-foreground">{t("complete")}</p>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden mt-2">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                    <span className="flex items-center gap-1"><BookOpen className="h-3.5 w-3.5" />{t("sessions_count", { n: cls.totalSessions })}</span>
                    {maxTotal > 0 && <span>{t("score", { earned: totalMarks, total: maxTotal })}</span>}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {cls.curriculum
                    .sort((a, b) => a.sessionNumber - b.sessionNumber)
                    .map((item) => {
                      const sub = submissions.find((s) => s.sessionNumber === item.sessionNumber);
                      const key = `${cls._id}-${item.sessionNumber}`;
                      const isUploading = uploading === key;

                      return (
                        <div key={item.sessionNumber} className="flex items-center gap-3 py-2 border-b last:border-0">
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
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
