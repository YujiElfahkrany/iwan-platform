import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { Slot } from "@/models/Slot";
import { Class } from "@/models/Class";
import { User } from "@/models/User";
import { generateRoomName } from "@/lib/jitsi";

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
    const { type, slotId, classId, teacherId, useCredits, price } = await req.json();

    let meetingRoomName = generateRoomName("session");
    let resolvedTeacherId = teacherId;

    if (type === "1on1" && slotId) {
      const slot = await Slot.findById(slotId);
      if (!slot || slot.status !== "available") {
        return NextResponse.json({ error: "Slot not available" }, { status: 400 });
      }
      meetingRoomName = generateRoomName("1on1");
      resolvedTeacherId = slot.teacherId.toString();
    }

    if (type === "class" && classId) {
      const cls = await Class.findById(classId);
      if (!cls || cls.enrolledStudents.length >= cls.maxStudents) {
        return NextResponse.json({ error: "Class is full" }, { status: 400 });
      }
      meetingRoomName = cls.meetingRoomName;
      resolvedTeacherId = cls.teacherId.toString();
    }

    // Credits-based payment
    if (useCredits) {
      const cost = Number(price) || 0;
      const student = await User.findById(session.user.id);
      if (!student) return NextResponse.json({ error: "User not found" }, { status: 404 });
      if (student.balance < cost) {
        return NextResponse.json({ error: `Insufficient balance. You have ${student.balance} LE but need ${cost} LE.` }, { status: 400 });
      }

      student.balance -= cost;
      await student.save();

      if (type === "1on1" && slotId) {
        await Slot.findByIdAndUpdate(slotId, { status: "booked" });
      }

      if (type === "class" && classId) {
        const studentObjId = new mongoose.Types.ObjectId(session.user.id);
        const updatedClass = await Class.findByIdAndUpdate(
          classId,
          { $addToSet: { enrolledStudents: studentObjId } },
          { new: true }
        );
        if (updatedClass && updatedClass.enrolledStudents.length >= updatedClass.maxStudents) {
          await Class.findByIdAndUpdate(classId, { $set: { status: "full" } });
        }
      }

      const booking = await Booking.create({
        studentId: session.user.id,
        teacherId: resolvedTeacherId,
        type,
        slotId,
        classId,
        meetingRoomName,
        status: "confirmed",
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
