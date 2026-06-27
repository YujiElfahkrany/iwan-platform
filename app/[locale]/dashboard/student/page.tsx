import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { StudentProfile } from "@/models/StudentProfile";
import { User } from "@/models/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { CalendarDays, BookOpen, Video, Wallet } from "lucide-react";
import { format } from "date-fns";
import { getTranslations } from "next-intl/server";
import { TopUpDialog } from "@/components/student/TopUpDialog";

export default async function StudentOverviewPage() {
  const session = await auth();
  if (!session?.user) return null;

  const t = await getTranslations("dashboard");

  await connectDB();

  const [bookings, profile, userDoc] = await Promise.all([
    Booking.find({ studentId: session.user.id, status: "confirmed" }).sort({ createdAt: -1 }).limit(5).lean(),
    StudentProfile.findOne({ userId: session.user.id }).lean(),
    User.findById(session.user.id).select("balance").lean(),
  ]);

  const balance = userDoc?.balance ?? 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">{t("welcome", { name: session.user.name ?? "" })}</h1>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex-row items-center gap-3 pb-2">
            <div className="p-2 rounded-lg bg-primary/10"><CalendarDays className="h-4 w-4 text-primary" /></div>
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("upcoming")}</CardTitle>
          </CardHeader>
          <CardContent><p className="text-3xl font-bold">{bookings.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-3 pb-2">
            <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900"><BookOpen className="h-4 w-4 text-amber-500" /></div>
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("your_subjects")}</CardTitle>
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
        <Card className="border-2 border-[#c8973a]/40 bg-[#f2ede8]/60 dark:bg-[#2c1f12]/20">
          <CardHeader className="flex-row items-center gap-3 pb-2">
            <div className="p-2 rounded-lg bg-[#c8973a]/15"><Wallet className="h-4 w-4 text-[#c8973a]" /></div>
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("my_balance")}</CardTitle>
          </CardHeader>
          <CardContent>
            <TopUpDialog balance={balance} />
          </CardContent>
        </Card>
      </div>

      {/* Learning Profile summary */}
      {profile && (
        <Card>
          <CardHeader><CardTitle className="text-base">{t("learning_profile")}</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex gap-4">
              <span className="text-muted-foreground">{t("level")}:</span>
              <Badge variant="outline" className="capitalize">{profile.learningLevel}</Badge>
            </div>
            {profile.goals && (
              <div>
                <span className="text-muted-foreground block mb-1">{t("goals")}:</span>
                <p className="leading-relaxed">{profile.goals}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upcoming bookings */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">{t("upcoming")}</h2>
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard/student/teachers">{t("browse_teachers")}</Link>
          </Button>
        </div>
        {bookings.length === 0 ? (
          <Card><CardContent className="py-10 text-center text-muted-foreground">
            {t("no_upcoming")}.{" "}
            <Link href="/dashboard/student/teachers" className="text-primary hover:underline">{t("find_teacher")}</Link>
          </CardContent></Card>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => (
              <Card key={b._id.toString()}>
                <CardContent className="flex items-center justify-between py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Video className="h-4 w-4 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{b.type === "1on1" ? t("one_on_one") : t("group_class")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t("booking_ref", { id: b._id.toString().slice(-6) })} · {format(new Date(b.createdAt), "PPP")}
                      </p>
                    </div>
                  </div>
                  <Button size="sm" asChild>
                    <Link href={`/session/${b._id}`}><Video className="h-3.5 w-3.5 me-1.5" />{t("join")}</Link>
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
