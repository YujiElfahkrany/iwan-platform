import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { AssignmentSubmission } from "@/models/AssignmentSubmission";
import { Class } from "@/models/Class";
import { User } from "@/models/User";
import { sendEmail, escapeHtml } from "@/lib/email";

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

  const [teacher, student] = await Promise.all([
    User.findById(cls.teacherId, { email: 1, name: 1 }).lean(),
    User.findById(session.user.id, { name: 1 }).lean(),
  ]);
  if (teacher) {
    const studentName = escapeHtml(student?.name ?? "");
    const safeTeacherName = escapeHtml(teacher.name);
    const safeAssignmentTitle = escapeHtml(assignment.assignmentTitle);
    const safeClassTitle = escapeHtml(cls.title);
    try {
      await sendEmail({
        to: teacher.email,
        subject: `تسليم واجب جديد | New Assignment Submission — ${assignment.assignmentTitle}`,
        html: `
          <div dir="rtl">
            <h2>تسليم واجب جديد</h2>
            <p>مرحباً ${safeTeacherName}،</p>
            <p>قام الطالب <strong>${studentName}</strong> بتسليم واجب «${safeAssignmentTitle}» (بعد الجلسة ${sessionNumber}) في فصل «${safeClassTitle}».</p>
            <p>سجّل الدخول إلى لوحة التحكم لمراجعة التسليم وتقييمه.</p>
          </div>
          <hr />
          <div dir="ltr">
            <h2>New assignment submission</h2>
            <p>Hi ${safeTeacherName},</p>
            <p>Student <strong>${studentName}</strong> submitted "${safeAssignmentTitle}" (after session ${sessionNumber}) in the class "${safeClassTitle}".</p>
            <p>Log in to your dashboard to review and grade the submission.</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Failed to send submission notification email:", emailErr);
    }
  }

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
