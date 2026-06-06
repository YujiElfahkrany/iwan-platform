import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Class } from "@/models/Class";
import { User } from "@/models/User";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

const STATUS_COLORS: Record<string, string> = {
  open: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  full: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  completed: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  cancelled: "bg-red-100 text-red-600 dark:bg-red-900 dark:text-red-400",
};

export default async function AdminClassesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;

  await connectDB();
  const classes = await Class.find().sort({ startTime: -1 }).lean();
  const teacherIds = [...new Set(classes.map((c) => c.teacherId.toString()))];
  const teachers = await User.find({ _id: { $in: teacherIds } }).select("name").lean();
  const teacherMap = Object.fromEntries(teachers.map((t) => [t._id.toString(), t.name]));

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Classes</h1>
        <Badge variant="secondary">{classes.length} total</Badge>
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">All Classes</CardTitle></CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-muted-foreground">
                  <th className="text-start py-2 font-medium">Title</th>
                  <th className="text-start py-2 font-medium">Subject</th>
                  <th className="text-start py-2 font-medium">Teacher</th>
                  <th className="text-start py-2 font-medium">Date</th>
                  <th className="text-start py-2 font-medium">Students</th>
                  <th className="text-start py-2 font-medium">Price</th>
                  <th className="text-start py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {classes.length === 0 ? (
                  <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No classes yet.</td></tr>
                ) : classes.map((c) => (
                  <tr key={c._id.toString()} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="py-3 font-medium max-w-[160px] truncate">{c.title}</td>
                    <td className="py-3"><Badge variant="outline" className="text-xs">{c.subject}</Badge></td>
                    <td className="py-3 text-muted-foreground">{teacherMap[c.teacherId.toString()] ?? "—"}</td>
                    <td className="py-3 text-muted-foreground whitespace-nowrap">{format(new Date(c.startTime), "MMM d, yyyy")}</td>
                    <td className="py-3">{c.enrolledStudents.length}/{c.maxStudents}</td>
                    <td className="py-3">{c.price} LE</td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[c.status] ?? ""}`}>{c.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
