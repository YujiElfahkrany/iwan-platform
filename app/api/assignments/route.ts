import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { AssignmentSubmission } from "@/models/AssignmentSubmission";
import { Class } from "@/models/Class";

const MAX_BYTES = 5 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "student") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const form = await req.formData();
  const classId = form.get("classId") as string;
  const sessionNumber = Number(form.get("sessionNumber"));
  const file = form.get("file") as File | null;

  if (!classId || !sessionNumber || !file) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File too large (max 5 MB)" }, { status: 400 });
  }

  await connectDB();

  const cls = await Class.findById(classId).lean();
  if (!cls) return NextResponse.json({ error: "Class not found" }, { status: 404 });

  const assignment = cls.curriculum.find((c: { sessionNumber: number }) => c.sessionNumber === sessionNumber);
  if (!assignment) return NextResponse.json({ error: "Assignment not found" }, { status: 404 });

  const existing = await AssignmentSubmission.findOne({
    classId,
    studentId: session.user.id,
    sessionNumber,
  });
  if (existing) return NextResponse.json({ error: "Already submitted" }, { status: 409 });

  const bytes = await file.arrayBuffer();
  const fileData = `data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`;

  const submission = await AssignmentSubmission.create({
    classId,
    studentId: session.user.id,
    sessionNumber,
    assignmentTitle: assignment.assignmentTitle,
    maxMarks: assignment.maxMarks,
    fileData,
    fileName: file.name,
  });

  return NextResponse.json({ id: submission._id.toString() }, { status: 201 });
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");

  const filter: Record<string, unknown> = {};
  if (classId) filter.classId = classId;
  if (session.user.role === "student") filter.studentId = session.user.id;

  const submissions = await AssignmentSubmission.find(filter)
    .populate("studentId", "name email")
    .sort({ createdAt: -1 })
    .lean();

  return NextResponse.json(
    submissions.map((s) => ({
      _id: s._id.toString(),
      classId: s.classId.toString(),
      studentId: s.studentId?.toString?.() ?? s.studentId,
      studentName: (s.studentId as { name?: string })?.name,
      sessionNumber: s.sessionNumber,
      assignmentTitle: s.assignmentTitle,
      maxMarks: s.maxMarks,
      fileName: s.fileName,
      status: s.status,
      mark: s.mark,
      feedback: s.feedback,
      createdAt: s.createdAt,
    }))
  );
}
