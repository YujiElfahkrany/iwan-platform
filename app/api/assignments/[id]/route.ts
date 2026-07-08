import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { AssignmentSubmission } from "@/models/AssignmentSubmission";
import { Class } from "@/models/Class";
import { User } from "@/models/User";
import { sendEmail } from "@/lib/email";

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

  const student = await User.findById(sub.studentId, { email: 1, name: 1 }).lean();
  if (student) {
    const approved = status === "approved";
    const markLineAr = approved ? `<li><strong>الدرجة:</strong> ${mark} من ${sub.maxMarks}</li>` : "";
    const markLineEn = approved ? `<li><strong>Mark:</strong> ${mark} / ${sub.maxMarks}</li>` : "";
    const feedbackLineAr = feedback ? `<li><strong>ملاحظات المعلم:</strong> ${feedback}</li>` : "";
    const feedbackLineEn = feedback ? `<li><strong>Teacher feedback:</strong> ${feedback}</li>` : "";
    try {
      await sendEmail({
        to: student.email,
        subject: approved
          ? `تم قبول واجبك | Assignment Approved — ${sub.assignmentTitle}`
          : `واجبك يحتاج إلى مراجعة | Assignment Rejected — ${sub.assignmentTitle}`,
        html: `
          <div dir="rtl">
            <h2>${approved ? "تم قبول واجبك" : "لم يتم قبول واجبك"}</h2>
            <p>مرحباً ${student.name}،</p>
            <p>قام معلمك بمراجعة واجبك «${sub.assignmentTitle}» (الجلسة ${sub.sessionNumber}) في فصل «${cls.title}».</p>
            <ul>
              ${markLineAr}
              ${feedbackLineAr}
            </ul>
            <p>${approved ? "أحسنت! واصل العمل الرائع." : "يرجى مراجعة الملاحظات وإعادة تقديم الواجب من لوحة التحكم."}</p>
          </div>
          <hr />
          <div dir="ltr">
            <h2>${approved ? "Your assignment was approved" : "Your assignment was not approved"}</h2>
            <p>Hi ${student.name},</p>
            <p>Your teacher has reviewed your submission "${sub.assignmentTitle}" (session ${sub.sessionNumber}) in the class "${cls.title}".</p>
            <ul>
              ${markLineEn}
              ${feedbackLineEn}
            </ul>
            <p>${approved ? "Well done! Keep up the great work." : "Please review the feedback and resubmit from your dashboard."}</p>
          </div>
        `,
      });
    } catch (emailErr) {
      console.error("Failed to send assignment review email:", emailErr);
    }
  }

  return NextResponse.json({ ok: true });
}
