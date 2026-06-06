import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { DashboardSidebar } from "@/components/layout/DashboardSidebar";

export default async function AdminDashboardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/auth/login`);
  if (session.user.role !== "admin") redirect(`/${locale}/auth/login`);

  return (
    <div className="flex min-h-screen">
      <DashboardSidebar role="admin" userName="Admin" />
      <main className="flex-1 bg-muted/30 p-6 overflow-auto">{children}</main>
    </div>
  );
}
