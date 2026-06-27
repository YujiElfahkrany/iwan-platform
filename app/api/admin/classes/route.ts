import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Class } from "@/models/Class";
import { User } from "@/models/User";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const classes = await Class.find().sort({ startTime: -1 }).lean();
  const teacherIds = [...new Set(classes.map((c) => c.teacherId.toString()))];
  const teachers = await User.find({ _id: { $in: teacherIds } }).select("name").lean();
  const teacherMap = Object.fromEntries(teachers.map((t) => [t._id.toString(), t.name]));

  return NextResponse.json(
    classes.map((c) => ({
      _id: c._id.toString(),
      title: c.title,
      subject: c.subject,
      teacherName: teacherMap[c.teacherId.toString()] ?? null,
      startTime: c.startTime,
      enrolledStudents: c.enrolledStudents.length,
      maxStudents: c.maxStudents,
      price: c.price,
      status: c.status,
      totalSessions: c.totalSessions ?? 0,
      curriculumCount: c.curriculum?.length ?? 0,
    }))
  );
}
