import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Class } from "@/models/Class";
import { TeacherProfile } from "@/models/TeacherProfile";
import { StudentProfile } from "@/models/StudentProfile";
import { Booking } from "@/models/Booking";
import { AssignmentSubmission } from "@/models/AssignmentSubmission";

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { type, id } = await req.json();
  if (!type || !id) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  await connectDB();

  if (type === "class") {
    await Class.findByIdAndDelete(id);
    await AssignmentSubmission.deleteMany({ classId: id });
    return NextResponse.json({ ok: true });
  }

  if (type === "user") {
    const user = await User.findById(id).lean();
    if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await User.findByIdAndDelete(id);
    await Booking.deleteMany({ studentId: id });

    if (user.role === "teacher") {
      await TeacherProfile.deleteOne({ userId: id });
      const teacherClasses = await Class.find({ teacherId: id }).select("_id").lean();
      const classIds = teacherClasses.map((c) => c._id);
      await Class.deleteMany({ teacherId: id });
      await AssignmentSubmission.deleteMany({ classId: { $in: classIds } });
    }

    if (user.role === "student") {
      await StudentProfile.deleteOne({ userId: id });
      await AssignmentSubmission.deleteMany({ studentId: id });
    }

    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unknown type" }, { status: 400 });
}
