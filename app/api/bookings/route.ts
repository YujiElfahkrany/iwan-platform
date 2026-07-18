import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Slot } from "@/models/Slot";
import { Class } from "@/models/Class";
import { User } from "@/models/User";
import { generateRoomName } from "@/lib/video";
import { studentClassPrice } from "@/lib/pricing";
import { enrollStudentInClass, unenrollStudentFromClass } from "@/lib/enrollment";
import { chargeStudent } from "@/lib/wallet";

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();
    const filter =
      session.user.role === "teacher"
        ? { teacherId: session.user.id }
        : { studentId: session.user.id };
    const bookings = await Booking.find(filter).sort({ createdAt: -1 }).lean();
    return NextResponse.json(
      bookings.map((b) => ({
        ...b,
        _id: b._id.toString(),
        studentId: b.studentId.toString(),
        teacherId: b.teacherId.toString(),
        slotId: b.slotId?.toString(),
        classId: b.classId?.toString(),
      }))
    );
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "student") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const { type, slotId, classId, teacherId, useCredits } = await req.json();

    let meetingRoomName = generateRoomName("session");
    let resolvedTeacherId = teacherId;
    let cost = 0;

    if (type === "1on1" && slotId) {
      const slot = await Slot.findById(slotId);
      if (!slot || slot.status !== "available") {
        return NextResponse.json({ error: "Slot not available" }, { status: 400 });
      }
      meetingRoomName = generateRoomName("1on1");
      resolvedTeacherId = slot.teacherId.toString();
      // Price comes from the slot itself, never from the client.
      cost = slot.price;
    }

    if (type === "class" && classId) {
      // Fast-path rejection; the atomic enroll below is the authoritative guard.
      const cls = await Class.findById(classId);
      if (!cls || cls.enrolledStudents.length >= cls.maxStudents) {
        return NextResponse.json({ error: "Class is full" }, { status: 400 });
      }
      meetingRoomName = cls.meetingRoomName;
      resolvedTeacherId = cls.teacherId.toString();
      // For classes the cost is computed server-side (teacher rate + commission)
      cost = studentClassPrice(cls.price);
    }

    // Credits-based payment
    if (useCredits) {
      // Claim the seat/slot atomically before charging, so a race between
      // students can never overbook or charge for a seat that no longer exists.
      if (type === "class" && classId) {
        const { enrolled } = await enrollStudentInClass(classId, session.user.id);
        if (!enrolled) {
          return NextResponse.json({ error: "Class is full" }, { status: 400 });
        }
      }
      if (type === "1on1" && slotId) {
        const claimed = await Slot.findOneAndUpdate(
          { _id: slotId, status: "available" },
          { status: "booked" }
        );
        if (!claimed) {
          return NextResponse.json({ error: "Slot not available" }, { status: 400 });
        }
      }

      const charged = await chargeStudent(session.user.id, cost);
      if (!charged) {
        // Release whatever we just claimed.
        if (type === "class" && classId) {
          await unenrollStudentFromClass(classId, session.user.id);
        }
        if (type === "1on1" && slotId) {
          await Slot.findByIdAndUpdate(slotId, { status: "available" });
        }
        const student = await User.findById(session.user.id).select("balance").lean();
        if (!student) return NextResponse.json({ error: "User not found" }, { status: 404 });
        return NextResponse.json({ error: `Insufficient balance. You have ${student.balance} LE but need ${cost} LE.` }, { status: 400 });
      }

      const booking = await Booking.create({
        studentId: session.user.id,
        teacherId: resolvedTeacherId,
        type,
        slotId,
        classId,
        meetingRoomName,
        status: "confirmed",
        pricePaid: cost,
      });

      return NextResponse.json({ id: booking._id.toString(), confirmed: true }, { status: 201 });
    }

    // Legacy pending booking (for any future payment flow)
    const booking = await Booking.create({
      studentId: session.user.id,
      teacherId: resolvedTeacherId,
      type,
      slotId,
      classId,
      meetingRoomName,
      status: "pending",
    });

    return NextResponse.json({ id: booking._id.toString() }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
