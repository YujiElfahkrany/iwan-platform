"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, CheckCircle, XCircle, FileText, ChevronDown } from "lucide-react";
import { toast } from "sonner";

interface Submission {
  _id: string;
  classId: string;
  studentName: string;
  sessionNumber: number;
  assignmentTitle: string;
  maxMarks: number;
  fileName: string;
  status: "pending" | "approved" | "rejected";
  mark?: number;
  feedback?: string;
  createdAt: string;
}

interface ClassGroup {
  classId: string;
  title: string;
  submissions: Submission[];
}

interface ClassItem {
  _id: string;
  title: string;
}

export default function TeacherAssignmentsPage() {
  const t = useTranslations("assignments");
  const [groups, setGroups] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [grading, setGrading] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [previewData, setPreviewData] = useState<{ fileData: string; fileName: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [markValues, setMarkValues] = useState<Record<string, number>>({});
  const [feedbackValues, setFeedbackValues] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    try {
      const classesRes = await fetch("/api/classes");
      const classes: ClassItem[] = await classesRes.json();

      const allGroups: ClassGroup[] = [];
      await Promise.all(
        classes.map(async (cls) => {
          const res = await fetch(`/api/assignments?classId=${cls._id}`);
          if (!res.ok) return;
          const subs: Submission[] = await res.json();
          if (subs.length > 0) {
            allGroups.push({ classId: cls._id, title: cls.title, submissions: subs });
          }
        })
      );
      setGroups(allGroups.sort((a, b) => a.title.localeCompare(b.title)));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSubmissions(); }, [fetchSubmissions]);

  async function grade(id: string, status: "approved" | "rejected") {
    setGrading(id);
    try {
      const res = await fetch(`/api/assignments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          mark: markValues[id] ?? 0,
          feedback: feedbackValues[id] ?? "",
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error);
      }
      toast.success(status === "approved" ? t("approved_toast") : t("rejected_toast"));
      fetchSubmissions();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : t("grade_error"));
    } finally {
      setGrading(null);
    }
  }

  async function openPreview(id: string) {
    setPreviewId(id);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/assignments/${id}`);
      if (!res.ok) throw new Error();
      setPreviewData(await res.json());
    } catch {
      toast.error(t("preview_error"));
      setPreviewId(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  const statusBadge = (s: string) => {
    if (s === "approved") return <Badge className="bg-green-100 text-green-700 border-green-200">{t("status_approved")}</Badge>;
    if (s === "rejected") return <Badge className="bg-red-100 text-red-700 border-red-200">{t("status_rejected")}</Badge>;
    return <Badge variant="secondary">{t("status_pending")}</Badge>;
  };

  const pendingTotal = groups.reduce((sum, g) => sum + g.submissions.filter((s) => s.status === "pending").length, 0);

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("page_title")}</h1>
        {pendingTotal > 0 && <Badge variant="destructive">{t("pending_count", { n: pendingTotal })}</Badge>}
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : groups.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t("no_submissions")}</CardContent></Card>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => {
            const isExpanded = expanded[group.classId] !== false;
            const pendingInGroup = group.submissions.filter((s) => s.status === "pending").length;
            return (
              <Card key={group.classId}>
                <CardHeader
                  className="cursor-pointer select-none pb-3"
                  onClick={() => setExpanded((e) => ({ ...e, [group.classId]: !isExpanded }))}
                >
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{group.title}</CardTitle>
                    <div className="flex items-center gap-2">
                      {pendingInGroup > 0 && <Badge variant="destructive" className="text-xs">{pendingInGroup} {t("pending_label")}</Badge>}
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                </CardHeader>
                {isExpanded && (
                  <CardContent className="space-y-3 pt-0">
                    {group.submissions.map((sub) => (
                      <div key={sub._id} className="border rounded-lg p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2 flex-wrap">
                          <div>
                            <p className="font-medium text-sm">{sub.assignmentTitle}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t("after_session", { n: sub.sessionNumber })} · {sub.studentName} · {t("max_marks", { n: sub.maxMarks })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {statusBadge(sub.status)}
                            {sub.status === "approved" && sub.mark !== undefined && (
                              <span className="text-sm font-bold text-green-700">{sub.mark}/{sub.maxMarks}</span>
                            )}
                          </div>
                        </div>

                        <Button variant="outline" size="sm" onClick={() => openPreview(sub._id)} className="gap-1.5">
                          <FileText className="h-3.5 w-3.5" />{sub.fileName}
                        </Button>

                        {sub.status === "pending" && (
                          <div className="space-y-2 pt-1 border-t">
                            <div className="flex gap-2">
                              <div className="w-24">
                                <Input
                                  type="number"
                                  min={0}
                                  max={sub.maxMarks}
                                  placeholder={t("mark_placeholder")}
                                  value={markValues[sub._id] ?? ""}
                                  onChange={(e) => setMarkValues((m) => ({ ...m, [sub._id]: parseFloat(e.target.value) }))}
                                />
                              </div>
                              <Textarea
                                placeholder={t("feedback_placeholder")}
                                rows={1}
                                className="flex-1 min-h-[36px] py-2"
                                value={feedbackValues[sub._id] ?? ""}
                                onChange={(e) => setFeedbackValues((f) => ({ ...f, [sub._id]: e.target.value }))}
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                className="gap-1.5 bg-green-600 hover:bg-green-700"
                                disabled={grading === sub._id}
                                onClick={() => grade(sub._id, "approved")}
                              >
                                {grading === sub._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle className="h-3.5 w-3.5" />}
                                {t("approve_btn")}
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                className="gap-1.5"
                                disabled={grading === sub._id}
                                onClick={() => grade(sub._id, "rejected")}
                              >
                                {grading === sub._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <XCircle className="h-3.5 w-3.5" />}
                                {t("reject_btn")}
                              </Button>
                            </div>
                          </div>
                        )}

                        {sub.status !== "pending" && sub.feedback && (
                          <p className="text-xs text-muted-foreground italic border-t pt-2">{sub.feedback}</p>
                        )}
                      </div>
                    ))}
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={!!previewId} onOpenChange={(v) => { if (!v) { setPreviewId(null); setPreviewData(null); } }}>
        <DialogContent className="max-w-3xl max-h-[90vh]">
          <DialogHeader><DialogTitle>{previewData?.fileName ?? t("preview_title")}</DialogTitle></DialogHeader>
          {previewLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
          ) : previewData ? (
            previewData.fileData.startsWith("data:image/") ? (
              <img src={previewData.fileData} alt={previewData.fileName} className="w-full object-contain max-h-[70vh] rounded" />
            ) : (
              <iframe src={previewData.fileData} className="w-full h-[70vh] rounded border" title={previewData.fileName} />
            )
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
