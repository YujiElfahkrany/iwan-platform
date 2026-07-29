import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { isAuthorizedCronRequest } from "@/lib/cronAuth";
import { Class } from "@/models/Class";
import { Booking } from "@/models/Booking";
import { User } from "@/models/User";
import { sendEmail, escapeHtml } from "@/lib/email";
import { nearestClassSessionTime } from "@/lib/schedule";

const REMINDER_MINUTES = 10;

// Runs every 5 minutes: emails enrolled students ~10 minutes before a class session starts
export async function GET(req: NextRequest) {
  if (!isAuthorizedCronRequest(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const now = new Date();

  const classes = await Class.find({
    status: { $in: ["open", "full"] },
    startTime: { $lte: new Date(now.getTime() + REMINDER_MINUTES * 60 * 1000) },
    $or: [{ reminderSentAt: { $exists: false } }, { reminderSentAt: { $lt: new Date(now.getTime() - 30 * 60 * 1000) } }],
  });

  let sent = 0;
  for (const cls of classes) {
    // Session starts within the next REMINDER_MINUTES? nearestClassSessionTime
    // handles recurring weekdays, one-off classes, and day boundaries, and
    // matches the join-window logic used on the dashboard.
    const nextSession = nearestClassSessionTime(cls, now);
    if (!nextSession) continue;
    const diffMs = nextSession.getTime() - now.getTime();
    if (diffMs <= 0 || diffMs > REMINDER_MINUTES * 60 * 1000) continue;
    const diff = Math.ceil(diffMs / 60000);

    if (cls.enrolledStudents.length === 0) continue;

    const [students, bookings] = await Promise.all([
      User.find({ _id: { $in: cls.enrolledStudents } }, { email: 1, name: 1 }).lean(),
      Booking.find({ classId: cls._id.toString(), status: "confirmed" }, { studentId: 1 }).lean(),
    ]);
    const bookingByStudent = new Map(bookings.map((b) => [b.studentId.toString(), b._id.toString()]));
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

    const safeTitle = escapeHtml(cls.title);
    const safeSubject = escapeHtml(cls.subject);
    const results = await Promise.allSettled(
      students.map((s) => {
        const bookingId = bookingByStudent.get(s._id.toString());
        const safeName = escapeHtml(s.name);
        const joinLinkAr = bookingId ? `<p><a href="${appUrl}/ar/session/${bookingId}">انضم إلى الجلسة من هنا</a></p>` : "";
        const joinLinkEn = bookingId ? `<p><a href="${appUrl}/en/session/${bookingId}">Join your session here</a></p>` : "";
        return sendEmail({
          to: s.email,
          subject: `فصلك يبدأ قريباً | Your class starts soon — ${cls.title}`,
          html: `
            <div dir="rtl">
              <h2>فصلك يبدأ خلال ${diff} دقائق</h2>
              <p>مرحباً ${safeName}،</p>
              <p>فصل «${safeTitle}» (${safeSubject}) سيبدأ قريباً.</p>
              ${joinLinkAr}
            </div>
            <hr />
            <div dir="ltr">
              <h2>Your class starts in ${diff} minutes</h2>
              <p>Hi ${safeName},</p>
              <p>The class "${safeTitle}" (${safeSubject}) is starting soon.</p>
              ${joinLinkEn}
            </div>
          `,
        });
      })
    );
    for (const r of results) {
      if (r.status === "rejected") console.error("Failed to send class reminder email:", r.reason);
      else sent++;
    }

    cls.reminderSentAt = now;
    await cls.save();
  }

  return NextResponse.json({ reminders_sent: sent });
}
