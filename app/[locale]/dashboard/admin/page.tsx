import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Class } from "@/models/Class";
import { Booking } from "@/models/Booking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, BookOpen, CalendarDays } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { getTranslations } from "next-intl/server";

export default async function AdminOverviewPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;

  const t = await getTranslations("admin");

  await connectDB();
  const [students, teachers, classes, bookings] = await Promise.all([
    User.countDocuments({ role: "student" }),
    User.countDocuments({ role: "teacher" }),
    Class.countDocuments(),
    Booking.countDocuments({ status: "confirmed" }),
  ]);

  const stats = [
    { label: t("students"), value: students, icon: <GraduationCap className="h-5 w-5 text-blue-500" />, href: "/dashboard/admin/students", color: "bg-blue-50 dark:bg-blue-950" },
    { label: t("teachers"), value: teachers, icon: <Users className="h-5 w-5 text-purple-500" />, href: "/dashboard/admin/teachers", color: "bg-purple-50 dark:bg-purple-950" },
    { label: t("classes"), value: classes, icon: <BookOpen className="h-5 w-5 text-amber-500" />, href: "/dashboard/admin/classes", color: "bg-amber-50 dark:bg-amber-950" },
    { label: t("confirmed_bookings"), value: bookings, icon: <CalendarDays className="h-5 w-5 text-[#c8973a]" />, href: "/dashboard/admin/students", color: "bg-[#f2ede8] dark:bg-[#2c1f12]/20" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">{t("dashboard_title")}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className={`hover:shadow-md transition-shadow cursor-pointer ${s.color}`}>
              <CardHeader className="flex-row items-center gap-3 pb-2">
                <div className="p-2 rounded-lg bg-white/60 dark:bg-black/20">{s.icon}</div>
                <CardTitle className="text-sm font-medium text-muted-foreground">{s.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-3xl font-bold">{s.value}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <CardHeader><CardTitle>{t("quick_actions")}</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/dashboard/admin/students" className="text-sm text-primary hover:underline">{t("manage_students")}</Link>
          <Link href="/dashboard/admin/teachers" className="text-sm text-primary hover:underline">{t("view_teachers")}</Link>
          <Link href="/dashboard/admin/classes" className="text-sm text-primary hover:underline">{t("view_classes")}</Link>
        </CardContent>
      </Card>
    </div>
  );
}
