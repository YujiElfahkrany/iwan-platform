import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { TeacherProfile } from "@/models/TeacherProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function AdminTeachersPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;

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
        <h1 className="text-2xl font-bold">Teachers</h1>
        <Badge variant="secondary">{teachers.length} total</Badge>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">All Teachers</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-start py-2 font-medium">Name</th>
                  <th className="text-start py-2 font-medium">Email</th>
                  <th className="text-start py-2 font-medium">Subjects</th>
                  <th className="text-start py-2 font-medium">Rate</th>
                  <th className="text-start py-2 font-medium">Joined</th>
                </tr>
              </thead>
              <tbody>
                {teachers.length === 0 ? (
                  <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No teachers yet.</td></tr>
                ) : teachers.map((t) => {
                  const profile = profileMap[t._id.toString()];
                  return (
                    <tr key={t._id.toString()} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-3 font-medium">{t.name}</td>
                      <td className="py-3 text-muted-foreground">{t.email}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap gap-1">
                          {profile?.subjects?.slice(0, 3).map((s: string) => (
                            <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                          )) ?? <span className="text-muted-foreground">—</span>}
                        </div>
                      </td>
                      <td className="py-3">{profile?.hourlyRate ? `${profile.hourlyRate} LE/hr` : "—"}</td>
                      <td className="py-3 text-muted-foreground">{new Date(t.createdAt).toLocaleDateString()}</td>
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
