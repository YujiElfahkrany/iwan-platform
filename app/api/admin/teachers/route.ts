import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { TeacherProfile } from "@/models/TeacherProfile";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await connectDB();
  const teachers = await User.find({ role: "teacher" })
    .select("name email createdAt")
    .sort({ createdAt: -1 })
    .lean();

  const profiles = await TeacherProfile.find({
    userId: { $in: teachers.map((t) => t._id) },
  }).lean();

  const profileMap = Object.fromEntries(profiles.map((p) => [p.userId.toString(), p]));

  return NextResponse.json(
    teachers.map((t) => {
      const profile = profileMap[t._id.toString()];
      return {
        id: t._id.toString(),
        name: t.name,
        email: t.email,
        subjects: profile?.subjects ?? [],
        hourlyRate: profile?.hourlyRate ?? null,
        createdAt: new Date(t.createdAt).toLocaleDateString(),
      };
    })
  );
}
