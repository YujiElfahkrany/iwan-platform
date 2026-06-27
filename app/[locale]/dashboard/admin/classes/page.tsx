"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { format } from "date-fns";
import { useTranslations } from "next-intl";

interface ClassRow {
  _id: string;
  title: string;
  subject: string;
  teacherName: string;
  startTime: string;
  enrolledStudents: number;
  maxStudents: number;
  price: number;
  status: string;
  totalSessions: number;
  curriculumCount: number;
}

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-700",
  full: "bg-amber-100 text-amber-700",
  completed: "bg-gray-100 text-gray-600",
  cancelled: "bg-red-100 text-red-600",
};

export default function AdminClassesPage() {
  const t = useTranslations("admin");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchClasses = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/classes");
      if (res.ok) setClasses(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  const statusLabel = (s: string) => {
    const map: Record<string, string> = {
      open: t("status_open"),
      full: t("status_full"),
      completed: t("status_completed"),
      cancelled: t("status_cancelled"),
    };
    return map[s] ?? s;
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("classes")}</h1>
        {!loading && <Badge variant="secondary">{t("total", { n: classes.length })}</Badge>}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("all_classes")}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-start py-2 font-medium">{t("title_col")}</th>
                    <th className="text-start py-2 font-medium">{t("subject_col")}</th>
                    <th className="text-start py-2 font-medium">{t("teacher_col")}</th>
                    <th className="text-start py-2 font-medium">{t("date_col")}</th>
                    <th className="text-start py-2 font-medium">{t("students_col")}</th>
                    <th className="text-start py-2 font-medium">{t("price_col")}</th>
                    <th className="text-start py-2 font-medium">{t("status_col")}</th>
                    <th className="text-start py-2 font-medium">{t("actions_col")}</th>
                  </tr>
                </thead>
                <tbody>
                  {classes.length === 0 ? (
                    <tr><td colSpan={8} className="py-8 text-center text-muted-foreground">{t("no_classes")}</td></tr>
                  ) : classes.map((c) => (
                    <tr key={c._id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 font-medium max-w-[160px] truncate">{c.title}</td>
                      <td className="py-3"><Badge variant="outline" className="text-xs">{c.subject}</Badge></td>
                      <td className="py-3 text-muted-foreground">{c.teacherName ?? "—"}</td>
                      <td className="py-3 text-muted-foreground whitespace-nowrap">{format(new Date(c.startTime), "dd/MM/yyyy")}</td>
                      <td className="py-3">{c.enrolledStudents}/{c.maxStudents}</td>
                      <td className="py-3">{c.price} LE</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[c.status] ?? ""}`}>
                          {statusLabel(c.status)}
                        </span>
                      </td>
                      <td className="py-3">
                        <DeleteButton type="class" id={c._id} onDeleted={fetchClasses} confirmLabel={t("confirm_delete")} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
