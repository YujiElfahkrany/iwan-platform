import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { TeacherProfile } from "@/models/TeacherProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getTranslations } from "next-intl/server";

export default async function AdminTeachersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;

  const t = await getTranslations("admin");

  await connectDB();
  const teachers = await User.find({ role: "teacher" })
    .select("name email createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const profiles = await TeacherProfile.find({
    userId: { $in: teachers.map((t) => t._id) },
  }).lean();

  const profileMap = Object.fromEntries(profiles.map((p) => [p.userId.toString(), p]));

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("teachers")}</h1>
        <Badge variant="secondary">{t("total", { n: teachers.length })}</Badge>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">{t("all_teachers")}</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-start py-2 font-medium">{t("name")}</th>
                  <th className="text-start py-2 font-medium">{t("email")}</th>
                  <th className="text-start py-2 font-medium">{t("subjects")}</th>
                  <th className="text-start py-2 font-medium">{t("rate")}</th>
                  <th className="text-start py-2 font-medium">{t("joined")}</th>
                </tr>
              </thead>
              <tbody>
                {teachers.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">{t("no_teachers")}</td></tr>
                ) : teachers.map((teacher) => {
                  const profile = profileMap[teacher._id.toString()];
                  return (
                    <tr key={teacher._id.toString()} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 font-medium">{teacher.name}</td>
                      <td className="py-3 text-muted-foreground">{teacher.email}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {profile?.subjects?.slice(0, 3).map((s: string) => (
                            <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                          )) ?? <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="py-3">{profile?.hourlyRate ? `${profile.hourlyRate} LE` : "—"}</td>
                      <td className="py-3 text-muted-foreground">{new Date(teacher.createdAt).toLocaleDateString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
