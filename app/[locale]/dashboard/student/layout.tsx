import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
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

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar role="student" userName={session.user.name ?? ""} />
      <main className="flex-1 bg-muted/30 p-6 overflow-auto">{children}</main>
    </div>
  );
}
