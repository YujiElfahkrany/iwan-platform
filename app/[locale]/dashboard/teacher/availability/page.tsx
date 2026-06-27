"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Trash2, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface Slot {
  _id: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  price: number;
  status: string;
}

export default function AvailabilityPage() {
  const t = useTranslations("teacher");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ date: "", startTime: "", durationMinutes: 60, price: 20 });

  const fetchSlots = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/slots");
    const data = await res.json();
    setSlots(data);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSlots(); }, [fetchSlots]);

  async function addSlot(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const startTime = new Date(`${form.date}T${form.startTime}`);
      const endTime = new Date(startTime.getTime() + form.durationMinutes * 60000);
      const res = await fetch("/api/slots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          durationMinutes: form.durationMinutes,
          price: form.price,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(t("slot_added"));
      setForm({ date: "", startTime: "", durationMinutes: 60, price: 20 });
      fetchSlots();
    } catch {
      toast.error(t("failed_slot"));
    } finally {
      setSaving(false);
    }
  }

  async function deleteSlot(id: string) {
    await fetch(`/api/slots?id=${id}`, { method: "DELETE" });
    toast.success(t("slot_removed"));
    fetchSlots();
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold flex items-center gap-2">
        <CalendarDays className="h-6 w-6 text-primary" />
        {t("availability_title")}
      </h1>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("add_slot")}</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={addSlot} className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <Label>{t("date")}</Label>
              <Input type="date" required value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} min={new Date().toISOString().split("T")[0]} />
            </div>
            <div className="space-y-1">
              <Label>{t("start_time")}</Label>
              <Input type="time" required value={form.startTime} onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("duration")}</Label>
              <Input type="number" min={15} step={15} value={form.durationMinutes} onChange={(e) => setForm((f) => ({ ...f, durationMinutes: parseInt(e.target.value) }))} />
            </div>
            <div className="space-y-1">
              <Label>{t("price_usd")}</Label>
              <Input type="number" min={1} value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: parseFloat(e.target.value) }))} />
            </div>
            <Button type="submit" disabled={saving} className="col-span-2 md:col-span-4">
              {saving ? <Loader2 className="h-4 w-4 animate-spin me-2" /> : <Plus className="h-4 w-4 me-2" />}
              {t("add_slot_btn")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">{t("upcoming_slots")}</CardTitle></CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : slots.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">{t("no_slots")}</p>
          ) : (
            <div className="space-y-2">
              {slots.map((slot) => (
                <div key={slot._id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors">
                  <div>
                    <p className="font-medium text-sm">{format(new Date(slot.startTime), "EEE, MMM d yyyy")}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(slot.startTime), "HH:mm")} — {format(new Date(slot.endTime), "HH:mm")} · {slot.durationMinutes} min · ${slot.price}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={slot.status === "available" ? "default" : "secondary"}>{slot.status}</Badge>
                    {slot.status === "available" && (
                      <Button size="icon" variant="ghost" className="text-destructive hover:text-destructive h-7 w-7" onClick={() => deleteSlot(slot._id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
