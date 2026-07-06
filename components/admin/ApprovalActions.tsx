"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

interface ApprovalActionsProps {
  id: string;
  onUpdated: (status: "approved" | "rejected") => void;
}

export function ApprovalActions({ id, onUpdated }: ApprovalActionsProps) {
  const t = useTranslations("admin");
  const [loading, setLoading] = useState<"approved" | "rejected" | null>(null);

  async function setStatus(status: "approved" | "rejected") {
    setLoading(status);
    try {
      const res = await fetch("/api/admin/approve", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status }),
      });
      if (!res.ok) throw new Error();
      toast.success(status === "approved" ? t("approved_success") : t("rejected_success"));
      onUpdated(status);
    } catch {
      toast.error(t("approval_failed"));
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex items-center gap-1.5">
      <Button
        size="sm"
        className="h-7 px-2 text-xs bg-green-600 hover:bg-green-700 text-white"
        disabled={loading !== null}
        onClick={() => setStatus("approved")}
      >
        {loading === "approved" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        {t("approve")}
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 px-2 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
        disabled={loading !== null}
        onClick={() => setStatus("rejected")}
      >
        {loading === "rejected" ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
        {t("reject")}
      </Button>
    </div>
  );
}
