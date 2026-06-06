import { NextRequest, NextResponse } from "next/server";
import { stripe } from "@/lib/stripe";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Slot } from "@/models/Slot";
import { Class } from "@/models/Class";
import { User } from "@/models/User";
import { resend, FROM_EMAIL } from "@/lib/resend";
import Stripe from "stripe";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    console.error("Webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const checkoutSession = event.data.object as Stripe.Checkout.Session;
    const { bookingId } = checkoutSession.metadata ?? {};
    if (!bookingId) return NextResponse.json({ received: true });

    await connectDB();
    const booking = await Booking.findById(bookingId);
    if (!booking) return NextResponse.json({ received: true });

    booking.status = "confirmed";
    booking.stripeSessionId = checkoutSession.id;
    booking.stripePaymentIntentId = checkoutSession.payment_intent as string;
    booking.stripePaymentStatus = checkoutSession.payment_status;
    await booking.save();

    // Update slot / class
    if (booking.type === "1on1" && booking.slotId) {
      await Slot.findByIdAndUpdate(booking.slotId, { status: "booked", bookingId: booking._id });
    }
    if (booking.type === "class" && booking.classId) {
      const cls = await Class.findById(booking.classId);
      if (cls) {
        if (!cls.enrolledStudents.includes(booking.studentId)) {
          cls.enrolledStudents.push(booking.studentId);
        }
        cls.status = cls.enrolledStudents.length >= cls.maxStudents ? "full" : "open";
        await cls.save();
      }
    }

    // Send confirmation email
    try {
      const [student, teacher] = await Promise.all([
        User.findById(booking.studentId).lean(),
        User.findById(booking.teacherId).lean(),
      ]);
      if (student && teacher) {
        const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL}/en/session/${booking._id}`;
        const emailHtml = `
          <h2>Booking Confirmed!</h2>
          <p>Your ${booking.type === "1on1" ? "1-on-1 session" : "group class"} has been confirmed.</p>
          <p><strong>Join link:</strong> <a href="${joinUrl}">${joinUrl}</a></p>
          <p>Meeting room: <strong>${booking.meetingRoomName}</strong></p>
        `;
        await Promise.all([
          resend.emails.send({ from: FROM_EMAIL, to: student.email, subject: "Booking Confirmed — Iwan Academy", html: emailHtml }),
          resend.emails.send({ from: FROM_EMAIL, to: teacher.email, subject: "New Booking Confirmed — Iwan Academy", html: emailHtml }),
        ]);
      }
    } catch (emailErr) {
      console.error("Email send error:", emailErr);
    }
  }

  return NextResponse.json({ received: true });
}
