import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";

export default async function StudentDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/auth/login`);
  if (session.user.role !== "student") redirect(`/${locale}/dashboard/teacher`);

  await connectDB();
  const userDoc = await User.findById(session.user.id).select("balance").lean();
  const balance = (userDoc as { balance?: number } | null)?.balance ?? 0;

  return (
    <div className="flex min-h-screen bg-site-3">
      <DashboardSidebar role="student" userName={session.user.name ?? ""} balance={balance} />
      <main className="flex-1 bg-[#f2ede8]/80 p-6 pt-16 md:pt-6 overflow-auto">{children}</main>
    </div>
  );
}
