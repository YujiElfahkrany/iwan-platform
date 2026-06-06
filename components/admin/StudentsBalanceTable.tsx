"use client";

import { useState } from "react";
import { AddBalanceForm } from "./AddBalanceForm";

interface Student {
  id: string;
  name: string;
  email: string;
  balance: number;
  createdAt: string;
}

export function StudentsBalanceTable({ students }: { students: Student[] }) {
  const [balances, setBalances] = useState<Record<string, number>>(
    Object.fromEntries(students.map((s) => [s.id, s.balance]))
  );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-muted-foreground">
            <th className="text-start py-2 font-medium">Name</th>
            <th className="text-start py-2 font-medium">Email</th>
            <th className="text-start py-2 font-medium">Joined</th>
            <th className="text-start py-2 font-medium">Balance / Add</th>
          </tr>
        </thead>
        <tbody>
          {students.length === 0 ? (
            <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">No students yet.</td></tr>
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
