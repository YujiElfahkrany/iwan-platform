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
import { Video, User as UserIcon } from "lucide-react";

export default async function TeacherBookingsPage() {
  const session = await auth();
  if (!session?.user) return null;
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

  const now = new Date();

  return (
    <div className="space-y-6 max-w-4xl">
      <h1 className="text-2xl font-bold">All Bookings</h1>
      {bookings.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No bookings yet.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            const slot = b.slotId ? slotMap[b.slotId.toString()] : null;
            const sessionTime = slot ? new Date(slot.startTime) : null;
            const canJoin = sessionTime
              ? Math.abs(now.getTime() - sessionTime.getTime()) < 10 * 60 * 1000
              : false;

            return (
              <Card key={b._id.toString()} className="hover:shadow-sm transition-shadow">
                <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-4 px-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <UserIcon className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{studentMap[b.studentId.toString()] ?? "Student"}</p>
                      <p className="text-xs text-muted-foreground">
                        {b.type === "1on1" ? "1-on-1 Session" : "Group Class"}
                        {sessionTime && ` · ${format(sessionTime, "PPp")}`}
                        {!sessionTime && ` · Created ${format(new Date(b.createdAt), "PPP")}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={b.status === "confirmed" ? "default" : b.status === "cancelled" ? "destructive" : "secondary"}>
                      {b.status}
                    </Badge>
                    {b.status === "confirmed" && (
                      canJoin ? (
                        <Button size="sm" asChild>
                          <Link href={`/session/${b._id}`}>
                            <Video className="h-3.5 w-3.5 me-1.5" />Join
                          </Link>
                        </Button>
                      ) : (
                        <Button size="sm" disabled>
                          <Video className="h-3.5 w-3.5 me-1.5" />Join
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
