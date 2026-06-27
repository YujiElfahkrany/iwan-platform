import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";

export default async function TeacherDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/auth/login`);
  if (session.user.role !== "teacher") redirect(`/${locale}/dashboard/student`);

  return (
    <div className="flex min-h-screen bg-site-3">
      <DashboardSidebar role="teacher" userName={session.user.name ?? ""} />
      <main className="flex-1 bg-[#f2ede8]/80 p-6 pt-16 md:pt-6 overflow-auto">{children}</main>
    </div>
  );
}
