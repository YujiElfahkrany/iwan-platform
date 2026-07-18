import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Slot } from "@/models/Slot";
import { Class } from "@/models/Class";
import { unenrollStudentFromClass } from "@/lib/enrollment";
import { computeCancellation } from "@/lib/cancellation";
import { refundStudent } from "@/lib/wallet";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    const booking = await Booking.findById(id).lean();
    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const isOwner =
      booking.studentId.toString() === session.user.id ||
      booking.teacherId.toString() === session.user.id;
    if (!isOwner) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    return NextResponse.json({
      ...booking,
      _id: booking._id.toString(),
      studentId: booking.studentId.toString(),
      teacherId: booking.teacherId.toString(),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const { id } = await params;
    const { status } = await req.json();
    if (status !== "cancelled") {
      return NextResponse.json({ error: "Unsupported status change" }, { status: 400 });
    }

    const booking = await Booking.findById(id);
    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const isOwner =
      booking.studentId.toString() === session.user.id ||
      booking.teacherId.toString() === session.user.id;
    if (!isOwner && session.user.role !== "admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    let sessionStart: Date | null = null;
    if (booking.slotId) {
      sessionStart = (await Slot.findById(booking.slotId).lean())?.startTime ?? null;
    } else if (booking.classId) {
      sessionStart = (await Class.findById(booking.classId).lean())?.startTime ?? null;
    }

    const decision = computeCancellation({
      pricePaid: booking.pricePaid,
      wasCharged: booking.status === "confirmed",
      sessionStart,
    });
    if (!decision.allowed) {
      return NextResponse.json(
        { error: "Cancellation window has passed — bookings can only be cancelled up to one week before the session." },
        { status: 400 }
      );
    }

    // Atomic status flip so a repeated cancel can never refund twice.
    const previous = await Booking.findOneAndUpdate(
      { _id: booking._id, status: { $in: ["pending", "confirmed"] } },
      { status: "cancelled" }
    );
    if (!previous) {
      return NextResponse.json({ error: "Booking cannot be cancelled" }, { status: 409 });
    }

    // Restore slot/class capacity
    if (booking.slotId) {
      await Slot.findByIdAndUpdate(booking.slotId, { status: "available", bookingId: undefined });
    }
    if (booking.classId) {
      await unenrollStudentFromClass(booking.classId, booking.studentId);
    }
    if (decision.refund > 0) {
      await refundStudent(booking.studentId, decision.refund);
    }

    return NextResponse.json({ success: true, refund: decision.refund });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
