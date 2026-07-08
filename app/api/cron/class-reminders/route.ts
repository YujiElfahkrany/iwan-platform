import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Class } from "@/models/Class";
import { Booking } from "@/models/Booking";
import { User } from "@/models/User";
import { sendEmail } from "@/lib/email";

const TIMEZONE = "Africa/Cairo";
const REMINDER_MINUTES = 10;

function minutesOfDay(date: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(date);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return (h % 24) * 60 + m;
}

function weekdayName(date: Date): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: TIMEZONE, weekday: "long" })
    .format(date)
    .toLowerCase();
}

function dayKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

// Runs every 5 minutes: emails enrolled students ~10 minutes before a class session starts
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  const bearer = req.headers.get("authorization");
  if (secret !== process.env.CRON_SECRET && bearer !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const now = new Date();
  const nowMinutes = minutesOfDay(now);
  const today = weekdayName(now);

  const classes = await Class.find({
    status: { $in: ["open", "full"] },
    startTime: { $lte: new Date(now.getTime() + REMINDER_MINUTES * 60 * 1000) },
    $or: [{ reminderSentAt: { $exists: false } }, { reminderSentAt: { $lt: new Date(now.getTime() - 30 * 60 * 1000) } }],
  });

  let sent = 0;
  for (const cls of classes) {
    // Does a session occur today? Recurring classes use daysOfWeek; one-off classes use startTime's date
    const isRecurring = cls.daysOfWeek.length > 0;
    const occursToday = isRecurring
      ? cls.daysOfWeek.includes(today)
      : dayKey(new Date(cls.startTime)) === dayKey(now);
    if (!occursToday) continue;

    // Session starts within the next REMINDER_MINUTES?
    const classMinutes = minutesOfDay(new Date(cls.startTime));
    const diff = classMinutes - nowMinutes;
    if (diff <= 0 || diff > REMINDER_MINUTES) continue;

    if (cls.enrolledStudents.length === 0) continue;

    const [students, bookings] = await Promise.all([
      User.find({ _id: { $in: cls.enrolledStudents } }, { email: 1, name: 1 }).lean(),
      Booking.find({ classId: cls._id.toString(), status: "confirmed" }, { studentId: 1 }).lean(),
    ]);
    const bookingByStudent = new Map(bookings.map((b) => [b.studentId.toString(), b._id.toString()]));
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;

    const results = await Promise.allSettled(
      students.map((s) => {
        const bookingId = bookingByStudent.get(s._id.toString());
        const joinLinkAr = bookingId ? `<p><a href="${appUrl}/ar/session/${bookingId}">انضم إلى الجلسة من هنا</a></p>` : "";
        const joinLinkEn = bookingId ? `<p><a href="${appUrl}/en/session/${bookingId}">Join your session here</a></p>` : "";
        return sendEmail({
          to: s.email,
          subject: `فصلك يبدأ قريباً | Your class starts soon — ${cls.title}`,
          html: `
            <div dir="rtl">
              <h2>فصلك يبدأ خلال ${diff} دقائق</h2>
              <p>مرحباً ${s.name}،</p>
              <p>فصل «${cls.title}» (${cls.subject}) سيبدأ قريباً.</p>
              ${joinLinkAr}
            </div>
            <hr />
            <div dir="ltr">
              <h2>Your class starts in ${diff} minutes</h2>
              <p>Hi ${s.name},</p>
              <p>The class "${cls.title}" (${cls.subject}) is starting soon.</p>
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
