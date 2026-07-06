"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { AddBalanceForm } from "./AddBalanceForm";
import { DeleteButton } from "./DeleteButton";
import { ApprovalActions } from "./ApprovalActions";

interface Student {
  id: string;
  name: string;
  email: string;
  balance: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export function StudentsBalanceTable({ students: initial, onRefresh }: { students: Student[]; onRefresh?: () => void }) {
  const t = useTranslations("admin");
  const [students, setStudents] = useState(initial);
  const [balances, setBalances] = useState<Record<string, number>>(
    Object.fromEntries(initial.map((s) => [s.id, s.balance]))
  );

  function removeStudent(id: string) {
    setStudents((prev) => prev.filter((s) => s.id !== id));
    if (onRefresh) onRefresh();
  }

  function updateStatus(id: string, status: "approved" | "rejected") {
    setStudents((prev) => prev.map((s) => (s.id === id ? { ...s, status } : s)));
  }

  const statusBadge = (status: Student["status"]) => {
    if (status === "pending") return <Badge className="bg-amber-100 text-amber-800 border-0">{t("status_pending")}</Badge>;
    if (status === "rejected") return <Badge variant="destructive">{t("status_rejected")}</Badge>;
    return <Badge className="bg-green-100 text-green-800 border-0">{t("status_approved")}</Badge>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="text-start py-2 font-medium">{t("name")}</th>
            <th className="text-start py-2 font-medium">{t("email")}</th>
            <th className="text-start py-2 font-medium">{t("status_col")}</th>
            <th className="text-start py-2 font-medium">{t("joined")}</th>
            <th className="text-start py-2 font-medium">{t("balance_col")}</th>
            <th className="text-start py-2 font-medium">{t("actions_col")}</th>
          </tr>
        </thead>
        <tbody>
          {students.length === 0 ? (
            <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">{t("no_students")}</td></tr>
          ) : students.map((s) => (
            <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="py-3 font-medium">{s.name}</td>
              <td className="py-3 text-muted-foreground">{s.email}</td>
              <td className="py-3">{statusBadge(s.status)}</td>
              <td className="py-3 text-muted-foreground">{s.createdAt}</td>
              <td className="py-3">
                <AddBalanceForm
                  userId={s.id}
                  userName={s.name}
                  currentBalance={balances[s.id]}
                  onSuccess={(newBal) => setBalances((prev) => ({ ...prev, [s.id]: newBal }))}
                />
              </td>
              <td className="py-3">
                <div className="flex items-center gap-1.5">
                  {s.status === "pending" && (
                    <ApprovalActions id={s.id} onUpdated={(status) => updateStatus(s.id, status)} />
                  )}
                  <DeleteButton type="user" id={s.id} onDeleted={() => removeStudent(s.id)} confirmLabel={t("confirm_delete")} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
