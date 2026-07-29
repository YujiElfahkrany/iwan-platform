import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { User } from "@/models/User";
import { Slot } from "@/models/Slot";
import { Class } from "@/models/Class";
import { channelsWithRecordings } from "@/lib/recordingStore";
import { sessionJoinInfo } from "@/lib/schedule";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RecordingsLink } from "@/components/dashboard/RecordingsLink";
import { Link } from "@/i18n/navigation";
import { format } from "date-fns";
import { Video, User as UserIcon } from "lucide-react";
import { getTranslations } from "next-intl/server";

export default async function TeacherBookingsPage() {
  const session = await auth();
  if (!session?.user) return null;
  const t = await getTranslations("teacher");
  const tSession = await getTranslations("session");

  await connectDB();

  const bookings = await Booking.find({ teacherId: session.user.id })
    .sort({ createdAt: -1 })
    .lean();

  const studentIds = [...new Set(bookings.map((b) => b.studentId.toString()))];
  const students = await User.find({ _id: { $in: studentIds } }).lean();
  const studentMap = Object.fromEntries(students.map((s) => [s._id.toString(), s.name]));

  const slotIds = bookings.filter((b) => b.slotId).map((b) => b.slotId!.toString());
  const slots = await Slot.find({ _id: { $in: slotIds } }).lean();
  const slotMap = Object.fromEntries(slots.map((s) => [s._id.toString(), s]));

  const classIds = bookings.filter((b) => b.classId).map((b) => b.classId!.toString());
  const classDocs = await Class.find({ _id: { $in: classIds } }, { startTime: 1, endTime: 1, daysOfWeek: 1 }).lean();
  const classMap = Object.fromEntries(classDocs.map((c) => [c._id.toString(), c]));

  const now = new Date();

  // Recordings are keyed by room, not by booking, so one query covers
  // every card on the page.
  // Only rooms from a booking that was actually paid for: a free pending
  // booking must not reveal that a class has recordings.
  const recordedRooms = await channelsWithRecordings(
    bookings
      .filter((b) => b.status === "confirmed" || b.status === "completed")
      .map((b) => b.meetingRoomName),
    now
  );

  const statusLabel = (s: string) => {
    if (s === "confirmed") return t("status_confirmed");
    if (s === "cancelled") return t("status_cancelled");
    return t("status_pending");
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">{t("all_bookings")}</h1>
      {bookings.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t("no_bookings")}</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const slot = b.slotId ? slotMap[b.slotId.toString()] : null;
            const cls = b.classId ? classMap[b.classId.toString()] : null;
            const { sessionTime, canJoin } = sessionJoinInfo(slot, cls, now);

            return (
              <Card key={b._id.toString()} className="hover:shadow-sm transition-shadow">
                <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 px-4">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <UserIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{studentMap[b.studentId.toString()] ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.type === "1on1" ? t("one_on_one") : t("group_class")}
                        {sessionTime && ` · ${format(sessionTime, "PPp")}`}
                        {!sessionTime && ` · ${t("created_on")} ${format(new Date(b.createdAt), "PPP")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
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
                        <Button size="sm" disabled>
                          <Video className="h-3.5 w-3.5 me-1.5" />{t("join")}
                        </Button>
                      )
                    )}
                    {recordedRooms.has(b.meetingRoomName) && (
                      <RecordingsLink bookingId={b._id.toString()} label={tSession("view_recordings")} />
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
