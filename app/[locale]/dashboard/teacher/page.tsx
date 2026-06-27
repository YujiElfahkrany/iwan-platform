import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { TeacherProfile } from "@/models/TeacherProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Star, Clock } from "lucide-react";
import { format } from "date-fns";
import { TeacherProfileCard } from "@/components/teacher/ProfileCard";
import { getTranslations } from "next-intl/server";

export default async function TeacherOverviewPage() {
  const session = await auth();
  if (!session?.user) return null;
  const t = await getTranslations("teacher");

  await connectDB();
  const [bookings, profile] = await Promise.all([
    Booking.find({ teacherId: session.user.id, status: "confirmed" })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    TeacherProfile.findOne({ userId: session.user.id }).lean(),
  ]);

  const statusLabel = (s: string) => {
    if (s === "confirmed") return t("status_confirmed");
    if (s === "cancelled") return t("status_cancelled");
    return t("status_pending");
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">{t("overview_title", { name: session.user.name ?? "" })}</h1>

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
            <div className="p-2 rounded-lg bg-[#c8973a]/10"><Star className="h-4 w-4 text-[#c8973a]" /></div>
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("rating")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{profile?.rating?.toFixed(1) ?? "—"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex-row items-center gap-3 pb-2">
            <div className="p-2 rounded-lg bg-[#c8973a]/10"><Star className="h-4 w-4 text-[#c8973a]" /></div>
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("hourly_rate")}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#c8973a]">${profile?.hourlyRate ?? 0}/hr</p>
          </CardContent>
        </Card>
      </div>

      {/* Profile preview */}
      {profile && (
        <div>
          <h2 className="text-lg font-semibold mb-3">{t("public_profile")}</h2>
          <TeacherProfileCard
            name={session.user.name ?? ""}
            avatar={session.user.image ?? ""}
            profile={{
              subjects: profile.subjects,
              experienceYears: profile.experienceYears,
              qualifications: profile.qualifications,
              certifications: profile.certifications,
              bio: profile.bio,
              languages: profile.languages,
              hourlyRate: profile.hourlyRate,
              rating: profile.rating,
              totalReviews: profile.totalReviews,
            }}
          />
        </div>
      )}

      {/* Recent bookings */}
      <div>
        <h2 className="text-lg font-semibold mb-3">{t("recent_bookings")}</h2>
        {bookings.length === 0 ? (
          <Card><CardContent className="py-8 text-center text-muted-foreground">{t("no_bookings")}</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {bookings.map((b) => (
              <Card key={b._id.toString()}>
                <CardContent className="flex items-center justify-between py-3 px-4">
                  <div className="flex items-center gap-3">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">#{b._id.toString().slice(-6)}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(b.createdAt), "PPP")}</p>
                    </div>
                  </div>
                  <Badge variant={b.status === "confirmed" ? "default" : "secondary"}>{statusLabel(b.status)}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
