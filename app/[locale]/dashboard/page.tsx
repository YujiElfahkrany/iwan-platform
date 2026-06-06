import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function DashboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const session = await auth();
  const { locale } = await params;

  if (!session?.user) redirect(`/${locale}/auth/login`);
  if (session.user.role === "admin") redirect(`/${locale}/dashboard/admin`);
  if (session.user.role === "teacher") redirect(`/${locale}/dashboard/teacher`);
  redirect(`/${locale}/dashboard/student`);
}
