"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { AddBalanceForm } from "./AddBalanceForm";
import { DeleteButton } from "./DeleteButton";

interface Student {
  id: string;
  name: string;
  email: string;
  balance: number;
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

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="text-start py-2 font-medium">{t("name")}</th>
            <th className="text-start py-2 font-medium">{t("email")}</th>
            <th className="text-start py-2 font-medium">{t("joined")}</th>
            <th className="text-start py-2 font-medium">{t("balance_col")}</th>
            <th className="text-start py-2 font-medium">{t("actions_col")}</th>
          </tr>
        </thead>
        <tbody>
          {students.length === 0 ? (
            <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">{t("no_students")}</td></tr>
          ) : students.map((s) => (
            <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
              <td className="py-3 font-medium">{s.name}</td>
              <td className="py-3 text-muted-foreground">{s.email}</td>
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
                <DeleteButton type="user" id={s.id} onDeleted={() => removeStudent(s.id)} confirmLabel={t("confirm_delete")} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
