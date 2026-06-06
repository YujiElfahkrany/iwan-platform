import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { StudentProfile } from "@/models/StudentProfile";
import { User } from "@/models/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { CalendarDays, BookOpen, Video, Wallet, MessageCircle } from "lucide-react";
import { format } from "date-fns";

const WHATSAPP_URL = "https://wa.me/819082272250?text=Hi%2C%20I%20would%20like%20to%20top%20up%20my%20Iwan%20Academy%20balance.";

export default async function StudentOverviewPage() {
  const session = await auth();
  if (!session?.user) return null;
  await connectDB();

  const [bookings, profile, userDoc] = await Promise.all([
    Booking.find({ studentId: session.user.id, status: "confirmed" }).sort({ createdAt: -1 }).limit(5).lean(),
    StudentProfile.findOne({ userId: session.user.id }).lean(),
    User.findById(session.user.id).select("balance").lean(),
  ]);

  const balance = userDoc?.balance ?? 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">Welcome back, {session.user.name}</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex-row items-center gap-3 pb-2">
            <div className="p-2 rounded-lg bg-primary/10"><CalendarDays className="h-4 w-4 text-primary" /></div>
            <CardTitle className="text-sm font-medium text-muted-foreground">Upcoming Sessions</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{bookings.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-3 pb-2">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900"><BookOpen className="h-4 w-4 text-amber-500" /></div>
            <CardTitle className="text-sm font-medium text-muted-foreground">Your Subjects</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1 mt-1">
              {profile?.subjects.length ? profile.subjects.map((s: string) => (
                <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
              )) : <p className="text-muted-foreground text-sm">—</p>}
            </div>
          </CardContent>
        </Card>
        {/* Balance card */}
        <Card className="border-2 border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/20">
          <CardHeader className="flex-row items-center gap-3 pb-2">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900"><Wallet className="h-4 w-4 text-emerald-600" /></div>
            <CardTitle className="text-sm font-medium text-muted-foreground">My Balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{balance.toLocaleString()} LE</p>
            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">
              <Button size="sm" className="w-full bg-green-500 hover:bg-green-600 text-white gap-2">
                <MessageCircle className="h-3.5 w-3.5" />
                Top Up Balance
              </Button>
            </a>
          </CardContent>
        </Card>
      </div>

      {/* Learning Profile summary */}
      {profile && (
        <Card>
          <CardHeader><CardTitle className="text-base">My Learning Profile</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex gap-4">
              <span className="text-muted-foreground">Level:</span>
              <Badge variant="outline" className="capitalize">{profile.learningLevel}</Badge>
            </div>
            {profile.goals && (
              <div>
                <span className="text-muted-foreground block mb-1">Goals:</span>
                <p className="leading-relaxed">{profile.goals}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upcoming bookings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">Upcoming Sessions</h2>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/student/teachers">Browse Teachers</Link>
          </Button>
        </div>
        {bookings.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            No upcoming sessions.{" "}
            <Link href="/dashboard/student/teachers" className="text-primary hover:underline">Find a teacher</Link>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => (
              <Card key={b._id.toString()}>
                <CardContent className="flex items-center justify-between py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Video className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{b.type === "1on1" ? "1-on-1 Session" : "Group Class"}</p>
                      <p className="text-xs text-muted-foreground">Booking #{b._id.toString().slice(-6)} · {format(new Date(b.createdAt), "PPP")}</p>
                    </div>
                  </div>
                  <Button size="sm" asChild>
                    <Link href={`/session/${b._id}`}><Video className="h-3.5 w-3.5 me-1.5" />Join</Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
