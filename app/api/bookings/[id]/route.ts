import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Slot } from "@/models/Slot";
import { Class } from "@/models/Class";

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
    const booking = await Booking.findById(id);
    if (!booking) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const { status } = await req.json();

    if (status === "cancelled") {
      // Restore slot/class capacity
      if (booking.slotId) {
        await Slot.findByIdAndUpdate(booking.slotId, { status: "available", bookingId: undefined });
      }
      if (booking.classId) {
        await Class.findByIdAndUpdate(booking.classId, {
          $pull: { enrolledStudents: booking.studentId },
        });
        await Class.findByIdAndUpdate(booking.classId, [
          { $set: { status: { $cond: [{ $lt: [{ $size: "$enrolledStudents" }, "$maxStudents"] }, "open", "full"] } } },
        ]);
      }
    }

    booking.status = status;
    await booking.save();
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
