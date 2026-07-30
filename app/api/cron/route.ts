import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { Booking } from "@/models/Booking";
import { Class } from "@/models/Class";
import { Slot } from "@/models/Slot";
import { User } from "@/models/User";
import { sendEmail, escapeHtml, multilingualEmail } from "@/lib/email";
import { formatSessionDate, PLATFORM_TIMEZONE } from "@/lib/datetime";
import { classSessionOnDay } from "@/lib/schedule";

// Vercel Cron: runs daily at 08:00 UTC
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStart = new Date(tomorrow.setHours(0, 0, 0, 0));
  const tomorrowEnd = new Date(tomorrow.setHours(23, 59, 59, 999));

  const slots = await Slot.find({
    startTime: { $gte: tomorrowStart, $lte: tomorrowEnd },
    status: "booked",
  }).lean();

  const slotIds = slots.map((s) => s._id.toString());
  const bookings = await Booking.find({ slotId: { $in: slotIds }, status: "confirmed" }).lean();

  let sent = 0;
  for (const booking of bookings) {
    const slot = slots.find((s) => s._id.toString() === booking.slotId?.toString());
    if (!slot) continue;
    const [student, teacher] = await Promise.all([
      User.findById(booking.studentId).lean(),
      User.findById(booking.teacherId).lean(),
    ]);
    if (!student || !teacher) continue;

    const joinUrlFor = (locale: string) =>
      `${process.env.NEXT_PUBLIC_APP_URL}/${locale}/session/${booking._id}`;
    const slotDateOpts: Intl.DateTimeFormatOptions = {
      weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
      timeZone: PLATFORM_TIMEZONE,
    };
    const sessionTime = new Date(slot.startTime).toLocaleString("en-US", slotDateOpts);
    const sessionTimeAr = new Date(slot.startTime).toLocaleString("ar-EG", slotDateOpts);
    const sessionTimeRu = new Date(slot.startTime).toLocaleString("ru-RU", slotDateOpts);
    const { subject, html } = multilingualEmail({
      suffix: "Iwan Academy",
      ar: {
        subject: "تذكير بالجلسة",
        body: `
              <h2>تذكير بالجلسة — غداً!</h2>
              <p>لديك جلسة مقررة في <strong>${sessionTimeAr}</strong>.</p>
              <p><a href="${joinUrlFor("ar")}">انضم إلى جلستك من هنا</a></p>
            `,
      },
      en: {
        subject: "Session Reminder",
        body: `
              <h2>Session Reminder — Tomorrow!</h2>
              <p>You have a session scheduled for <strong>${sessionTime}</strong>.</p>
              <p><a href="${joinUrlFor("en")}">Join your session here</a></p>
            `,
      },
      ru: {
        subject: "Напоминание о занятии",
        body: `
              <h2>Напоминание о занятии — завтра!</h2>
              <p>У вас запланировано занятие: <strong>${sessionTimeRu}</strong>.</p>
              <p><a href="${joinUrlFor("ru")}">Присоединиться к занятию</a></p>
            `,
      },
    });

    await Promise.allSettled([
      sendEmail({ to: student.email, subject, html }),
      sendEmail({ to: teacher.email, subject, html }),
    ]);
    sent++;
  }

  // Group classes: remind every participant (enrolled students + the teacher)
  // who has a class session on the reminded day — the same day-ahead
  // semantics as the slot reminders above.
  const tomorrowRef = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const classes = await Class.find({ status: { $in: ["open", "full"] } }).lean();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

  let classEmails = 0;
  for (const cls of classes) {
    const sessionTime = classSessionOnDay(cls, tomorrowRef);
    if (!sessionTime) continue;

    const participants = await User.find(
      { _id: { $in: [...cls.enrolledStudents, cls.teacherId] } },
      { email: 1, name: 1, role: 1 }
    ).lean();
    if (participants.length === 0) continue;

    const safeTitle = escapeHtml(cls.title);
    const safeSubject = escapeHtml(cls.subject);
    const timeAr = formatSessionDate(sessionTime, "ar", PLATFORM_TIMEZONE);
    const timeEn = formatSessionDate(sessionTime, "en", PLATFORM_TIMEZONE);
    const timeRu = formatSessionDate(sessionTime, "ru", PLATFORM_TIMEZONE);

    const results = await Promise.allSettled(
      participants.map((p) => {
        const dashboardPath = p.role === "teacher" ? "dashboard/teacher" : "dashboard/student";
        const safeName = escapeHtml(p.name);
        return sendEmail({
          to: p.email,
          ...multilingualEmail({
            suffix: cls.title,
            ar: {
              subject: "تذكير بفصل الغد",
              body: `
              <h2>تذكير: فصلك غداً</h2>
              <p>مرحباً ${safeName}،</p>
              <p>فصل «${safeTitle}» (${safeSubject}) سيُعقد غداً في <strong>${timeAr}</strong>.</p>
              <p><a href="${appUrl}/ar/${dashboardPath}">افتح لوحة التحكم للانضمام</a></p>
            `,
            },
            en: {
              subject: "Class tomorrow",
              body: `
              <h2>Reminder: your class meets tomorrow</h2>
              <p>Hi ${safeName},</p>
              <p>The class "${safeTitle}" (${safeSubject}) meets tomorrow at <strong>${timeEn}</strong>.</p>
              <p><a href="${appUrl}/en/${dashboardPath}">Open your dashboard to join</a></p>
            `,
            },
            ru: {
              subject: "Занятие завтра",
              body: `
              <h2>Напоминание: ваше занятие состоится завтра</h2>
              <p>Здравствуйте, ${safeName}!</p>
              <p>Занятие «${safeTitle}» (${safeSubject}) состоится завтра в <strong>${timeRu}</strong>.</p>
              <p><a href="${appUrl}/ru/${dashboardPath}">Откройте панель управления, чтобы присоединиться</a></p>
            `,
            },
          }),
        });
      })
    );
    for (const r of results) {
      if (r.status === "rejected") console.error("Failed to send class day reminder:", r.reason);
      else classEmails++;
    }
  }

  return NextResponse.json({ reminders_sent: sent, class_reminder_emails: classEmails });
}
