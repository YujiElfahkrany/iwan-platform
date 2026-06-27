"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface Slot {
  _id: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  price: number;
  teacherId: string;
}

interface BookSlotSectionProps {
  slots: Slot[];
  teacherId: string;
  teacherName?: string;
}

export function BookSlotSection({ slots, teacherId }: BookSlotSectionProps) {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations("teacher_profile");
  const [bookingId, setBookingId] = useState<string | null>(null);

  async function handleBook(slot: Slot) {
    if (!session?.user) {
      router.push("/auth/login");
      return;
    }
    setBookingId(slot._id);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "1on1",
          slotId: slot._id,
          teacherId,
          useCredits: true,
          price: slot.price,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Booking failed");
      toast.success(`${slot.price} LE deducted from your balance.`);
      router.push("/dashboard/student/bookings");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Booking failed");
    } finally {
      setBookingId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          {t("available_slots")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {slots.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">{t("no_slots_available")}</p>
        ) : (
          <div className="space-y-3">
            {slots.map((slot) => (
              <div key={slot._id} className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-muted/40 transition-colors">
                <div className="space-y-0.5">
                  <p className="font-medium text-sm">{format(new Date(slot.startTime), "EEEE, MMMM d")}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {format(new Date(slot.startTime), "HH:mm")} – {format(new Date(slot.endTime), "HH:mm")} ({slot.durationMinutes} min)
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-semibold">{slot.price} LE</Badge>
                  <Button
                    size="sm"
                    onClick={() => handleBook(slot)}
                    disabled={bookingId === slot._id}
                  >
                    {bookingId === slot._id && <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" />}
                    {t("book_session")}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
