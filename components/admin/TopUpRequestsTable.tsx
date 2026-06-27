"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface TopUpRequestRow {
  id: string;
  amount: number;
  receiptData: string;
  status: string;
  createdAt: string;
  user: { id: string; name: string; email: string };
}

export function TopUpRequestsTable({ requests: initial }: { requests: TopUpRequestRow[] }) {
  const t = useTranslations("admin");
  const [requests, setRequests] = useState(initial);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [preview, setPreview] = useState<string | null>(null);

  async function handleAction(id: string, action: "approve" | "reject") {
    setLoading((l) => ({ ...l, [id]: true }));
    try {
      const res = await fetch("/api/admin/topup", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(action === "approve" ? t("approved_toast") : t("rejected_toast"));
      setRequests((r) => r.filter((req) => req.id !== id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading((l) => ({ ...l, [id]: false }));
    }
  }

  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground py-4">{t("no_topup")}</p>;
  }

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="text-start py-2 font-medium">{t("student_col")}</th>
              <th className="text-start py-2 font-medium">{t("amount_col")}</th>
              <th className="text-start py-2 font-medium">{t("date_col")}</th>
              <th className="text-start py-2 font-medium">{t("receipt_col")}</th>
              <th className="text-start py-2 font-medium">{t("actions_col")}</th>
            </tr>
          </thead>
          <tbody>
            {requests.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-muted/30">
                <td className="py-3">
                  <p className="font-medium">{r.user.name}</p>
                  <p className="text-xs text-muted-foreground">{r.user.email}</p>
                </td>
                <td className="py-3 font-semibold tabular-nums">{r.amount.toLocaleString()} LE</td>
                <td className="py-3 text-muted-foreground">{format(new Date(r.createdAt), "dd/MM/yyyy HH:mm")}</td>
                <td className="py-3">
                  <button
                    onClick={() => setPreview(r.receiptData)}
                    className="text-primary hover:underline text-xs"
                  >
                    {t("view_receipt")}
                  </button>
                </td>
                <td className="py-3">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="h-7 bg-gradient-to-b from-[#d4a843] to-[#a67c2e] hover:from-[#c8973a] hover:to-[#96712a] text-white border-0 gap-1"
                      disabled={loading[r.id]}
                      onClick={() => handleAction(r.id, "approve")}
                    >
                      {loading[r.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
                      {t("approve")}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 border-destructive text-destructive hover:bg-destructive/10 gap-1"
                      disabled={loading[r.id]}
                      onClick={() => handleAction(r.id, "reject")}
                    >
                      {loading[r.id] ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                      {t("reject")}
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Receipt lightbox */}
      {preview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreview(null)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="receipt"
            className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </>
  );
}
