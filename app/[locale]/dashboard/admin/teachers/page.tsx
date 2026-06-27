"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { DeleteButton } from "@/components/admin/DeleteButton";
import { useTranslations } from "next-intl";

interface TeacherRow {
  id: string;
  name: string;
  email: string;
  subjects: string[];
  hourlyRate: number | null;
  createdAt: string;
}

export default function AdminTeachersPage() {
  const t = useTranslations("admin");
  const [teachers, setTeachers] = useState<TeacherRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTeachers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/teachers");
      if (res.ok) setTeachers(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTeachers(); }, [fetchTeachers]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("teachers")}</h1>
        {!loading && <Badge variant="secondary">{t("total", { n: teachers.length })}</Badge>}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("all_teachers")}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-start py-2 font-medium">{t("name")}</th>
                    <th className="text-start py-2 font-medium">{t("email")}</th>
                    <th className="text-start py-2 font-medium">{t("subjects")}</th>
                    <th className="text-start py-2 font-medium">{t("rate")}</th>
                    <th className="text-start py-2 font-medium">{t("joined")}</th>
                    <th className="text-start py-2 font-medium">{t("actions_col")}</th>
                  </tr>
                </thead>
                <tbody>
                  {teachers.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">{t("no_teachers")}</td></tr>
                  ) : teachers.map((teacher) => (
                    <tr key={teacher.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 font-medium">{teacher.name}</td>
                      <td className="py-3 text-muted-foreground">{teacher.email}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {teacher.subjects?.slice(0, 3).map((s: string) => (
                            <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                          ))}
                          {!teacher.subjects?.length && <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="py-3">{teacher.hourlyRate ? `${teacher.hourlyRate} LE` : "—"}</td>
                      <td className="py-3 text-muted-foreground">{teacher.createdAt}</td>
                      <td className="py-3">
                        <DeleteButton type="user" id={teacher.id} onDeleted={fetchTeachers} confirmLabel={t("confirm_delete")} />
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
