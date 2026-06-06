import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Slot } from "@/models/Slot";
import { User } from "@/models/User";
import { resend, FROM_EMAIL } from "@/lib/resend";

// Vercel Cron: runs daily at 08:00 UTC
export async function GET(req: NextRequest) {
  // Verify cron secret header
  const secret = req.headers.get("x-cron-secret");
  if (secret !== process.env.CRON_SECRET) {
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

    const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL}/en/session/${booking._id}`;
    const sessionTime = new Date(slot.startTime).toLocaleString("en-US", {
      weekday: "long", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit"
    });
    const html = `
      <h2>Session Reminder — Tomorrow!</h2>
      <p>You have a session scheduled for <strong>${sessionTime}</strong>.</p>
      <p><a href="${joinUrl}">Join your session here</a></p>
    `;

    await Promise.allSettled([
      resend.emails.send({ from: FROM_EMAIL, to: student.email, subject: "Session Reminder — Iwan Academy", html }),
      resend.emails.send({ from: FROM_EMAIL, to: teacher.email, subject: "Session Reminder — Iwan Academy", html }),
    ]);
    sent++;
  }

  return NextResponse.json({ reminders_sent: sent });
}
