import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StudentsBalanceTable } from "@/components/admin/StudentsBalanceTable";
import { getTranslations } from "next-intl/server";

export default async function AdminStudentsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;

  const t = await getTranslations("admin");

  await connectDB();
  const students = await User.find({ role: "student" })
    .select("name email balance createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const data = students.map((u) => ({
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    balance: u.balance ?? 0,
    createdAt: new Date(u.createdAt).toLocaleDateString(),
  }));

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("students")}</h1>
        <Badge variant="secondary">{t("total", { n: data.length })}</Badge>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{t("all_students")}</CardTitle>
        </CardHeader>
        <CardContent>
          <StudentsBalanceTable students={data} />
        </CardContent>
      </Card>
    </div>
  );
}
