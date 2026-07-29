import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { hasActiveRecording } from "@/lib/recordingStore";

// Tells a participant whether the room they are in is being recorded right now,
// so the student side can show the "recording" indicator.
export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const bookingId = req.nextUrl.searchParams.get("bookingId");
    if (!bookingId || !mongoose.Types.ObjectId.isValid(bookingId)) {
      return NextResponse.json({ error: "Invalid booking" }, { status: 400 });
    }

    await connectDB();
    const booking = await Booking.findById(bookingId).lean();
    if (!booking) return NextResponse.json({ error: "Booking not found" }, { status: 404 });

    const isParticipant =
      booking.studentId.toString() === session.user.id ||
      booking.teacherId.toString() === session.user.id;
    // Same bar as joining the call. Without the status check, anyone could open
    // a free pending class booking and then poll that room's recording state.
    if (!isParticipant || booking.status !== "confirmed") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const active = await hasActiveRecording(booking.meetingRoomName, new Date());
    return NextResponse.json({ active });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
