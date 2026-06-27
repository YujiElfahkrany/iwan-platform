import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { AssignmentSubmission } from "@/models/AssignmentSubmission";
import { Class } from "@/models/Class";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { id } = await params;
  const sub = await AssignmentSubmission.findById(id).lean();
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (session.user.role === "student" && sub.studentId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session.user.role === "teacher") {
    const cls = await Class.findById(sub.classId).lean();
    if (!cls || cls.teacherId.toString() !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  return NextResponse.json({ fileData: sub.fileData, fileName: sub.fileName });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "teacher") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const { id } = await params;
  const sub = await AssignmentSubmission.findById(id).lean();
  if (!sub) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const cls = await Class.findById(sub.classId).lean();
  if (!cls || cls.teacherId.toString() !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { status, mark, feedback } = await req.json();

  if (!["approved", "rejected"].includes(status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }
  if (status === "approved" && (mark === undefined || mark < 0 || mark > sub.maxMarks)) {
    return NextResponse.json({ error: `Mark must be 0–${sub.maxMarks}` }, { status: 400 });
  }

  await AssignmentSubmission.findByIdAndUpdate(id, {
    status,
    mark: status === "approved" ? mark : undefined,
    feedback,
  });

  return NextResponse.json({ ok: true });
}
