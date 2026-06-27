import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { User } from "@/models/User";
import { Slot } from "@/models/Slot";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { format } from "date-fns";
import { Video, BookOpen } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function StudentBookingsPage() {
  const session = await auth();
  if (!session?.user) return null;

  const t = await getTranslations("student_bookings");

  await connectDB();

  const bookings = await Booking.find({ studentId: session.user.id }).sort({ createdAt: -1 }).lean();

  const teacherIds = [...new Set(bookings.map((b) => b.teacherId.toString()))];
  const teachers = await User.find({ _id: { $in: teacherIds } }).lean();
  const teacherMap = Object.fromEntries(teachers.map((tc) => [tc._id.toString(), tc.name]));

  const slotIds = bookings.filter((b) => b.slotId).map((b) => b.slotId!.toString());
  const slots = await Slot.find({ _id: { $in: slotIds } }).lean();
  const slotMap = Object.fromEntries(slots.map((s) => [s._id.toString(), s]));

  const now = new Date();

  const statusLabel = (s: string) => {
    if (s === "confirmed") return t("status_confirmed");
    if (s === "pending") return t("status_pending");
    if (s === "cancelled") return t("status_cancelled");
    return t("status_completed");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">{t("title")}</h1>
      {bookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {t("no_bookings")}{" "}
            <Link href="/dashboard/student/teachers" className="text-primary hover:underline">{t("book_session")}</Link>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const slot = b.slotId ? slotMap[b.slotId.toString()] : null;
            const sessionTime = slot ? new Date(slot.startTime) : null;
            const canJoin = b.status === "confirmed" && sessionTime
              ? Math.abs(now.getTime() - sessionTime.getTime()) < 10 * 60 * 1000
              : false;

            return (
              <Card key={b._id.toString()} className="hover:shadow-sm transition-shadow">
                <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <BookOpen className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">
                        {b.type === "1on1" ? t("one_on_one") : t("group_class")} {t("with_teacher", { name: teacherMap[b.teacherId.toString()] ?? "—" })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {sessionTime ? format(sessionTime, "PPp") : format(new Date(b.createdAt), "PPP")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={b.status === "confirmed" ? "default" : b.status === "cancelled" ? "destructive" : "secondary"}>
                      {statusLabel(b.status)}
                    </Badge>
                    {b.status === "confirmed" && (
                      canJoin ? (
                        <Button size="sm" asChild>
                          <Link href={`/session/${b._id}`}>
                            <Video className="h-3.5 w-3.5 me-1.5" />{t("join")}
                          </Link>
                        </Button>
                      ) : (
                        <Button size="sm" disabled className="opacity-50">
                          <Video className="h-3.5 w-3.5 me-1.5" />{t("join")}
                        </Button>
                      )
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
