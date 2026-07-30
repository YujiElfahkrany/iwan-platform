import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Class } from "@/models/Class";
import { User } from "@/models/User";
import { sendEmail, escapeHtml, multilingualEmail } from "@/lib/email";
import { serializeClass } from "@/lib/classResponse";
import { diffCurriculum, syncSubmissionsWithCurriculum } from "@/lib/curriculumSync";
import { PLATFORM_TIMEZONE } from "@/lib/datetime";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    const { id } = await params;
    const cls = await Class.findById(id).lean();
    if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json(serializeClass(cls));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { id } = await params;
    const cls = await Class.findById(id);
    if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });
    if (cls.teacherId.toString() !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json();
    const oldCurriculum: { sessionNumber: number; assignmentTitle: string }[] =
      cls.curriculum.map((c: { sessionNumber: number; assignmentTitle: string }) => ({
        sessionNumber: c.sessionNumber,
        assignmentTitle: c.assignmentTitle,
      }));
    if (typeof body.title === "string" && body.title.trim()) cls.title = body.title.trim();
    if (typeof body.description === "string") cls.description = body.description;
    if (typeof body.subject === "string" && body.subject) cls.subject = body.subject;
    if (body.startTime) cls.startTime = new Date(body.startTime);
    if (body.endTime) cls.endTime = new Date(body.endTime);
    if (typeof body.price === "number" && body.price >= 0) cls.price = body.price;
    if (typeof body.maxStudents === "number" && body.maxStudents >= 1) cls.maxStudents = body.maxStudents;
    if (typeof body.totalSessions === "number" && body.totalSessions >= 1) cls.totalSessions = body.totalSessions;
    if (Array.isArray(body.curriculum)) cls.curriculum = body.curriculum;
    if (Array.isArray(body.daysOfWeek)) cls.daysOfWeek = body.daysOfWeek;
    await cls.save();

    if (Array.isArray(body.curriculum)) {
      await syncSubmissionsWithCurriculum(
        cls._id,
        cls.curriculum.map((c: { sessionNumber: number; assignmentTitle: string; maxMarks: number }) => ({
          sessionNumber: c.sessionNumber,
          assignmentTitle: c.assignmentTitle,
          maxMarks: c.maxMarks,
        }))
      );
    }

    // Notify enrolled students of the changes
    let notified = 0;
    if (cls.enrolledStudents.length > 0) {
      const students = await User.find({ _id: { $in: cls.enrolledStudents } }, { email: 1, name: 1 }).lean();
      const dateOpts: Intl.DateTimeFormatOptions = {
        weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
        timeZone: PLATFORM_TIMEZONE,
      };
      const whenEn = new Date(cls.startTime).toLocaleString("en-US", dateOpts);
      const whenAr = new Date(cls.startTime).toLocaleString("ar-EG", dateOpts);
      const whenRu = new Date(cls.startTime).toLocaleString("ru-RU", dateOpts);
      const dayNamesAr: Record<string, string> = {
        saturday: "السبت", sunday: "الأحد", monday: "الاثنين", tuesday: "الثلاثاء",
        wednesday: "الأربعاء", thursday: "الخميس", friday: "الجمعة",
      };
      const dayNamesRu: Record<string, string> = {
        saturday: "суббота", sunday: "воскресенье", monday: "понедельник", tuesday: "вторник",
        wednesday: "среда", thursday: "четверг", friday: "пятница",
      };
      // Day keys come from the request body, so an unknown value falls through
      // to the raw string and must be escaped like any other user input.
      const localizedDays = (names: Record<string, string> | null, separator: string) =>
        cls.daysOfWeek.map((d: string) => escapeHtml(names?.[d] ?? d)).join(separator);
      const daysAr = localizedDays(dayNamesAr, "، ");
      const daysEn = localizedDays(null, ", ");
      const daysRu = localizedDays(dayNamesRu, ", ");

      // Diff assignments (curriculum) to report added/removed ones
      const { added: addedAssignments, removed: removedAssignments } = diffCurriculum(
        oldCurriculum,
        cls.curriculum.map((c: { sessionNumber: number; assignmentTitle: string }) => ({
          sessionNumber: c.sessionNumber,
          assignmentTitle: c.assignmentTitle,
        }))
      );
      type CurriculumEntry = { sessionNumber: number; assignmentTitle: string };
      /** Renders the added/removed assignment lists for one language. */
      const assignmentsSection = (
        item: (c: CurriculumEntry) => string,
        addedLabel: string,
        removedLabel: string
      ) =>
        (addedAssignments.length ? `<p><strong>${addedLabel}</strong></p><ul>${addedAssignments.map(item).join("")}</ul>` : "") +
        (removedAssignments.length ? `<p><strong>${removedLabel}</strong></p><ul>${removedAssignments.map(item).join("")}</ul>` : "");
      const assignmentItemAr = (c: CurriculumEntry) =>
        `<li>«${escapeHtml(c.assignmentTitle)}» (بعد الجلسة ${c.sessionNumber})</li>`;
      const assignmentItemEn = (c: CurriculumEntry) =>
        `<li>"${escapeHtml(c.assignmentTitle)}" (after session ${c.sessionNumber})</li>`;
      const assignmentItemRu = (c: CurriculumEntry) =>
        `<li>«${escapeHtml(c.assignmentTitle)}» (после занятия ${c.sessionNumber})</li>`;
      const safeTitle = escapeHtml(cls.title);
      const safeSubject = escapeHtml(cls.subject);
      const assignmentsSectionAr = assignmentsSection(assignmentItemAr, "واجبات جديدة:", "واجبات تم حذفها:");
      const assignmentsSectionEn = assignmentsSection(assignmentItemEn, "New assignments:", "Removed assignments:");
      const assignmentsSectionRu = assignmentsSection(assignmentItemRu, "Новые задания:", "Удалённые задания:");

      const { subject, html } = multilingualEmail({
        suffix: cls.title,
        ar: {
          subject: "تحديث الفصل",
          body: `
          <h2>تحديث الفصل — ${safeTitle}</h2>
          <p>قام معلمك بتحديث تفاصيل فصل أنت مسجل فيه:</p>
          <ul>
            <li><strong>العنوان:</strong> ${safeTitle}</li>
            <li><strong>المادة:</strong> ${safeSubject}</li>
            <li><strong>يبدأ:</strong> ${whenAr}</li>
            ${cls.daysOfWeek.length ? `<li><strong>أيام الجلسات:</strong> ${daysAr}</li>` : ""}
            <li><strong>إجمالي الجلسات:</strong> ${cls.totalSessions}</li>
          </ul>
          ${assignmentsSectionAr}
          <p>سجّل الدخول إلى لوحة التحكم لعرض التفاصيل كاملة.</p>
        `,
        },
        en: {
          subject: "Class Updated",
          body: `
          <h2>Class Updated — ${safeTitle}</h2>
          <p>Your teacher has updated the details of a class you're enrolled in:</p>
          <ul>
            <li><strong>Title:</strong> ${safeTitle}</li>
            <li><strong>Subject:</strong> ${safeSubject}</li>
            <li><strong>Starts:</strong> ${whenEn}</li>
            ${cls.daysOfWeek.length ? `<li><strong>Session days:</strong> ${daysEn}</li>` : ""}
            <li><strong>Total sessions:</strong> ${cls.totalSessions}</li>
          </ul>
          ${assignmentsSectionEn}
          <p>Log in to your dashboard to see the full details.</p>
        `,
        },
        ru: {
          subject: "Класс обновлён",
          body: `
          <h2>Класс обновлён — ${safeTitle}</h2>
          <p>Ваш преподаватель обновил детали класса, в котором вы записаны:</p>
          <ul>
            <li><strong>Название:</strong> ${safeTitle}</li>
            <li><strong>Предмет:</strong> ${safeSubject}</li>
            <li><strong>Начало:</strong> ${whenRu}</li>
            ${cls.daysOfWeek.length ? `<li><strong>Дни занятий:</strong> ${daysRu}</li>` : ""}
            <li><strong>Всего занятий:</strong> ${cls.totalSessions}</li>
          </ul>
          ${assignmentsSectionRu}
          <p>Войдите в панель управления, чтобы увидеть все детали.</p>
        `,
        },
      });
      const results = await Promise.allSettled(
        students.map((s) => sendEmail({ to: s.email, subject, html }))
      );
      notified = results.filter((r) => r.status === "fulfilled").length;
      for (const r of results) {
        if (r.status === "rejected") console.error("Failed to send class update email:", r.reason);
      }
    }

    return NextResponse.json({ ok: true, notified });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
