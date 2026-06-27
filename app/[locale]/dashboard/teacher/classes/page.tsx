"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Loader2, Plus, Users, Clock, Trash2, BookOpen, ChevronRight, ChevronLeft } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface ClassItem {
  _id: string;
  title: string;
  subject: string;
  startTime: string;
  endTime: string;
  price: number;
  maxStudents: number;
  enrolledStudents: string[];
  status: string;
  totalSessions: number;
  curriculum: { sessionNumber: number; assignmentTitle: string; maxMarks: number }[];
}

interface CurriculumRow {
  sessionNumber: number;
  assignmentTitle: string;
  description: string;
  maxMarks: number;
}

const defaultForm = {
  title: "",
  subject: "",
  description: "",
  date: "",
  startTime: "",
  endTime: "",
  price: 15,
  maxStudents: 10,
};

export default function TeacherClassesPage() {
  const t = useTranslations("teacher");
  const ta = useTranslations("admin");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [form, setForm] = useState(defaultForm);
  const [totalSessions, setTotalSessions] = useState(1);
  const [curriculum, setCurriculum] = useState<CurriculumRow[]>([]);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/classes");
    setClasses(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  function update(k: string, v: string | number) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function addAssignment() {
    setCurriculum((c) => [
      ...c,
      { sessionNumber: 1, assignmentTitle: "", description: "", maxMarks: 10 },
    ]);
  }

  function updateAssignment(idx: number, key: keyof CurriculumRow, value: string | number) {
    setCurriculum((c) => c.map((row, i) => i === idx ? { ...row, [key]: value } : row));
  }

  function removeAssignment(idx: number) {
    setCurriculum((c) => c.filter((_, i) => i !== idx));
  }

  function resetWizard() {
    setStep(1);
    setForm(defaultForm);
    setTotalSessions(1);
    setCurriculum([]);
  }

  function handleOpenChange(val: boolean) {
    setOpen(val);
    if (!val) resetWizard();
  }

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const startTime = new Date(`${form.date}T${form.startTime}`).toISOString();
      const endTime = new Date(`${form.date}T${form.endTime}`).toISOString();
      const res = await fetch("/api/classes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          startTime,
          endTime,
          totalSessions,
          curriculum,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("class_created"));
      handleOpenChange(false);
      fetchClasses();
    } catch {
      toast.error(t("failed_create"));
    } finally {
      setSaving(false);
    }
  }

  const statusLabel = (s: string) => {
    if (s === "open") return ta("status_open");
    if (s === "full") return ta("status_full");
    if (s === "completed") return ta("status_completed");
    return ta("status_cancelled");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("my_classes_title")}</h1>
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogTrigger render={<Button />}>
            <Plus className="h-4 w-4 me-2" />{t("new_class")}
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{t("create_class_title")}</DialogTitle>
              <div className="flex items-center gap-2 mt-2">
                {[1, 2].map((s) => (
                  <div key={s} className="flex items-center gap-2">
                    <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold ${step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{s}</div>
                    {s < 2 && <div className={`h-0.5 w-8 ${step > s ? "bg-primary" : "bg-muted"}`} />}
                  </div>
                ))}
                <span className="text-xs text-muted-foreground ms-2">
                  {step === 1 ? t("wizard_step1_label") : t("wizard_step2_label")}
                </span>
              </div>
            </DialogHeader>

            {step === 1 && (
              <div className="space-y-4 mt-2">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 space-y-1"><Label>{t("title_field")}</Label><Input required value={form.title} onChange={(e) => update("title", e.target.value)} /></div>
                  <div className="space-y-1"><Label>{t("subject_field")}</Label><Input required value={form.subject} onChange={(e) => update("subject", e.target.value)} /></div>
                  <div className="space-y-1"><Label>{t("price_usd")}</Label><Input type="number" min={1} value={form.price} onChange={(e) => update("price", parseFloat(e.target.value))} /></div>
                  <div className="space-y-1"><Label>{t("date")}</Label><Input type="date" required value={form.date} onChange={(e) => update("date", e.target.value)} min={new Date().toISOString().split("T")[0]} /></div>
                  <div className="space-y-1"><Label>{t("max_students")}</Label><Input type="number" min={2} max={50} value={form.maxStudents} onChange={(e) => update("maxStudents", parseInt(e.target.value))} /></div>
                  <div className="space-y-1"><Label>{t("start_time")}</Label><Input type="time" required value={form.startTime} onChange={(e) => update("startTime", e.target.value)} /></div>
                  <div className="space-y-1"><Label>{t("end_time")}</Label><Input type="time" required value={form.endTime} onChange={(e) => update("endTime", e.target.value)} /></div>
                  <div className="col-span-2 space-y-1"><Label>{t("description")}</Label><Textarea value={form.description} onChange={(e) => update("description", e.target.value)} rows={3} /></div>
                </div>
                <Button
                  className="w-full"
                  onClick={() => {
                    if (!form.title || !form.subject || !form.date || !form.startTime || !form.endTime) {
                      toast.error(t("fill_required"));
                      return;
                    }
                    setStep(2);
                  }}
                >
                  {t("next_step")} <ChevronRight className="h-4 w-4 ms-2" />
                </Button>
              </div>
            )}

            {step === 2 && (
              <form onSubmit={createClass} className="space-y-5 mt-2">
                <div className="space-y-1">
                  <Label>{t("total_sessions")}</Label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={totalSessions}
                    onChange={(e) => setTotalSessions(parseInt(e.target.value) || 1)}
                    className="max-w-[140px]"
                  />
                  <p className="text-xs text-muted-foreground">{t("total_sessions_hint")}</p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>{t("assignments_label")}</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addAssignment}>
                      <Plus className="h-3.5 w-3.5 me-1.5" />{t("add_assignment")}
                    </Button>
                  </div>

                  {curriculum.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center border rounded-lg border-dashed">
                      {t("no_assignments_hint")}
                    </p>
                  )}

                  {curriculum.map((row, idx) => (
                    <div key={idx} className="border rounded-lg p-3 space-y-2 bg-muted/30">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-muted-foreground">{t("assignment_num", { n: idx + 1 })}</span>
                        <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeAssignment(idx)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1">
                          <Label className="text-xs">{t("after_session")}</Label>
                          <Input
                            type="number"
                            min={1}
                            max={totalSessions}
                            value={row.sessionNumber}
                            onChange={(e) => updateAssignment(idx, "sessionNumber", parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">{t("assignment_title")}</Label>
                          <Input
                            required
                            value={row.assignmentTitle}
                            onChange={(e) => updateAssignment(idx, "assignmentTitle", e.target.value)}
                            placeholder={t("assignment_title_placeholder")}
                          />
                        </div>
                        <div className="col-span-2 space-y-1">
                          <Label className="text-xs">{t("assignment_desc")}</Label>
                          <Input
                            value={row.description}
                            onChange={(e) => updateAssignment(idx, "description", e.target.value)}
                            placeholder={t("assignment_desc_placeholder")}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">{t("max_marks")}</Label>
                          <Input
                            type="number"
                            min={1}
                            value={row.maxMarks}
                            onChange={(e) => updateAssignment(idx, "maxMarks", parseInt(e.target.value) || 1)}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex gap-3">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>
                    <ChevronLeft className="h-4 w-4 me-1" />{t("back")}
                  </Button>
                  <Button type="submit" disabled={saving} className="flex-1">
                    {saving && <Loader2 className="h-4 w-4 animate-spin me-2" />}{t("create_class_btn")}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : classes.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t("no_classes")}</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {classes.map((cls) => (
            <Card key={cls._id} className="hover:shadow-md transition-shadow">
              <div className="h-1.5 bg-gradient-to-r from-primary to-[#f59e0b]" />
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-base">{cls.title}</CardTitle>
                  <Badge variant={cls.status === "open" ? "default" : "secondary"}>{statusLabel(cls.status)}</Badge>
                </div>
                <Badge variant="outline" className="w-fit">{cls.subject}</Badge>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p className="flex items-center gap-2"><Clock className="h-4 w-4" />{format(new Date(cls.startTime), "PPP")} · {format(new Date(cls.startTime), "HH:mm")} – {format(new Date(cls.endTime), "HH:mm")}</p>
                <p className="flex items-center gap-2"><Users className="h-4 w-4" />{t("students_count", { enrolled: cls.enrolledStudents.length, max: cls.maxStudents })} · {cls.price} LE{t("per_student")}</p>
                {cls.totalSessions > 0 && (
                  <p className="flex items-center gap-2"><BookOpen className="h-4 w-4" />{t("sessions_count", { n: cls.totalSessions })} · {cls.curriculum?.length ?? 0} {t("assignments_count")}</p>
                )}
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(cls.enrolledStudents.length / cls.maxStudents) * 100}%` }} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
