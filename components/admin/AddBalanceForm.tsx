"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";

interface AddBalanceFormProps {
  userId: string;
  userName: string;
  currentBalance: number;
  onSuccess: (newBalance: number) => void;
}

export function AddBalanceForm({ userId, userName, currentBalance, onSuccess }: AddBalanceFormProps) {
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const n = Number(amount);
    if (!n || n <= 0) { toast.error("Enter a valid amount"); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/admin/balance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, amount: n }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(`Added ${n} LE to ${userName}'s account`);
      onSuccess(data.balance);
      setAmount("");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to add balance");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <span className="text-sm font-medium tabular-nums min-w-[80px]">{currentBalance.toLocaleString()} LE</span>
      <Input
        type="number"
        min="1"
        placeholder="Amount"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        className="w-24 h-8 text-sm"
      />
      <Button type="submit" size="sm" className="h-8" disabled={loading}>
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
        Add LE
      </Button>
    </form>
  );
}
