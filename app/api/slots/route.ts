import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Slot } from "@/models/Slot";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get("teacherId");
    const filter: Record<string, unknown> = { status: "available" };
    if (teacherId) filter.teacherId = teacherId;
    const slots = await Slot.find({ ...filter, startTime: { $gte: new Date() } })
      .sort({ startTime: 1 })
      .lean();
    return NextResponse.json(slots.map((s) => ({ ...s, _id: s._id.toString(), teacherId: s.teacherId.toString() })));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const body = await req.json();
    const { startTime, endTime, durationMinutes, price } = body;
    const slot = await Slot.create({
      teacherId: session.user.id,
      startTime: new Date(startTime),
      endTime: new Date(endTime),
      durationMinutes,
      price,
    });
    return NextResponse.json({ id: slot._id.toString() }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "teacher") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const { searchParams } = new URL(req.url);
    const slotId = searchParams.get("id");
    await Slot.deleteOne({ _id: slotId, teacherId: session.user.id, status: "available" });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
