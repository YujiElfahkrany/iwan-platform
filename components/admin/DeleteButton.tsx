"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface DeleteButtonProps {
  type: "class" | "user";
  id: string;
  label?: string;
  onDeleted: () => void;
  confirmLabel?: string;
}

export function DeleteButton({ type, id, onDeleted, confirmLabel }: DeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function doDelete() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/delete", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error);
      }
      toast.success("Deleted successfully");
      onDeleted();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setLoading(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button size="sm" variant="destructive" disabled={loading} onClick={doDelete} className="h-7 px-2 text-xs">
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : confirmLabel ?? "Confirm"}
        </Button>
        <Button size="sm" variant="ghost" disabled={loading} onClick={() => setConfirming(false)} className="h-7 px-2 text-xs">
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={() => setConfirming(true)}>
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
