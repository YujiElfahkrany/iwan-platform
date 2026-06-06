import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Class } from "@/models/Class";
import { Booking } from "@/models/Booking";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, GraduationCap, BookOpen, CalendarDays } from "lucide-react";
import { Link } from "@/i18n/navigation";

export default async function AdminOverviewPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;

  await connectDB();
  const [students, teachers, classes, bookings] = await Promise.all([
    User.countDocuments({ role: "student" }),
    User.countDocuments({ role: "teacher" }),
    Class.countDocuments(),
    Booking.countDocuments({ status: "confirmed" }),
  ]);

  const stats = [
    { label: "Students", value: students, icon: <GraduationCap className="h-5 w-5 text-blue-500" />, href: "/dashboard/admin/students", color: "bg-blue-50 dark:bg-blue-950" },
    { label: "Teachers", value: teachers, icon: <Users className="h-5 w-5 text-purple-500" />, href: "/dashboard/admin/teachers", color: "bg-purple-50 dark:bg-purple-950" },
    { label: "Classes", value: classes, icon: <BookOpen className="h-5 w-5 text-amber-500" />, href: "/dashboard/admin/classes", color: "bg-amber-50 dark:bg-amber-950" },
    { label: "Confirmed Bookings", value: bookings, icon: <CalendarDays className="h-5 w-5 text-emerald-500" />, href: "/dashboard/admin/students", color: "bg-emerald-50 dark:bg-emerald-950" },
  ];

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">Admin Dashboard</h1>
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
        <CardHeader><CardTitle>Quick Actions</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/dashboard/admin/students" className="text-sm text-primary hover:underline">Manage Students & Balances →</Link>
          <Link href="/dashboard/admin/teachers" className="text-sm text-primary hover:underline">View Teachers →</Link>
          <Link href="/dashboard/admin/classes" className="text-sm text-primary hover:underline">View All Classes →</Link>
        </CardContent>
      </Card>
    </div>
  );
}
