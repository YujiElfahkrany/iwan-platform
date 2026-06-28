"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Wallet, Upload, X, Clock, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface TopUpRequest {
  id: string;
  amount: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

interface TopUpDialogProps {
  balance: number;
}

export function TopUpDialog({ balance: initialBalance }: TopUpDialogProps) {
  const t = useTranslations("topup");
  const td = useTranslations("dashboard");
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState<TopUpRequest[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) fetchRequests();
  }, [open]);

  async function fetchRequests() {
    try {
      const res = await fetch("/api/topup");
      if (res.ok) setRequests(await res.json());
    } catch {}
  }

  function handleFile(f: File | null) {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2 MB");
      return;
    }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount || !file) return;
    setLoading(true);
    try {
      const form = new FormData();
      form.append("amount", amount);
      form.append("receipt", file);
      const res = await fetch("/api/topup", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(t("success"));
      setAmount("");
      setFile(null);
      setPreview(null);
      await fetchRequests();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  const statusIcon = (s: string) =>
    s === "approved" ? <CheckCircle className="h-3.5 w-3.5 text-[#c8973a]" /> :
    s === "rejected" ? <XCircle className="h-3.5 w-3.5 text-destructive" /> :
    <Clock className="h-3.5 w-3.5 text-[#c8973a]" />;

  const statusLabel = (s: string) =>
    s === "approved" ? t("approved") : s === "rejected" ? t("rejected") : t("pending");

  return (
    <>
      {/* Balance card content */}
      <p className="text-3xl font-bold text-[#c8973a]">
        {initialBalance.toLocaleString()} LE
      </p>
      <Button
        size="sm"
        className="w-full bg-gradient-to-b from-[#d4a843] to-[#a67c2e] hover:from-[#c8973a] hover:to-[#96712a] text-white gap-2 mt-3 border-0 shadow-sm shadow-[#c8973a]/30"
        onClick={() => setOpen(true)}
      >
        <Wallet className="h-3.5 w-3.5" />
        {td("top_up")}
      </Button>

      {/* Dialog overlay */}
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="bg-card text-foreground rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="font-semibold text-lg text-[#2c1f12] dark:text-foreground">{t("title")}</h2>
              <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <p className="text-sm text-[#6b5c4c] dark:text-muted-foreground leading-relaxed">{t("instapay_note")}</p>

              {/* InstaPay number */}
              <div className="flex items-center justify-between bg-[#c8973a]/10 border border-[#c8973a]/30 rounded-lg px-4 py-3">
                <span className="text-xs text-[#8a6420] font-medium">InstaPay</span>
                <span className="text-xl font-bold tracking-widest text-[#8a6420] font-mono" dir="ltr">
                  {t("instapay_number")}
                </span>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <Label>{t("amount")}</Label>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    placeholder={t("amount_placeholder")}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>{t("receipt")}</Label>
                  <p className="text-xs text-muted-foreground">{t("receipt_note")}</p>
                  {preview ? (
                    <div className="relative rounded-lg overflow-hidden border border-border">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={preview} alt="receipt" className="w-full object-contain max-h-52" />
                      <button
                        type="button"
                        onClick={() => { setFile(null); setPreview(null); }}
                        className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileRef.current?.click()}
                      className="w-full border-2 border-dashed border-[#c8973a]/30 rounded-lg py-8 flex flex-col items-center gap-2 text-[#6b5c4c] hover:border-[#c8973a] hover:text-[#8a6420] transition-colors"
                    >
                      <Upload className="h-6 w-6" />
                      <span className="text-sm">Click to upload</span>
                    </button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-to-b from-[#d4a843] to-[#a67c2e] hover:from-[#c8973a] hover:to-[#96712a] text-white border-0 shadow-sm shadow-[#c8973a]/30"
                  disabled={loading || !amount || !file}
                >
                  {loading ? t("submitting") : t("submit")}
                </Button>
              </form>

              {/* Request history */}
              <div className="border-t pt-4 space-y-2">
                <p className="text-sm font-medium text-[#2c1f12] dark:text-foreground">{t("history")}</p>
                {requests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("no_requests")}</p>
                ) : (
                  <div className="space-y-2">
                    {requests.map((r) => (
                      <div key={r.id} className="flex items-center justify-between text-sm py-1.5 border-b last:border-0">
                        <span className="font-medium text-[#2c1f12] dark:text-foreground">{r.amount.toLocaleString()} LE</span>
                        <span className="text-muted-foreground text-xs">
                          {format(new Date(r.createdAt), "dd/MM/yyyy")}
                        </span>
                        <Badge
                          variant="secondary"
                          className={`gap-1 text-xs ${
                            r.status === "approved" ? "text-[#c8973a]" :
                            r.status === "rejected" ? "text-destructive" : "text-[#8a6420]"
                          }`}
                        >
                          {statusIcon(r.status)}
                          {statusLabel(r.status)}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
