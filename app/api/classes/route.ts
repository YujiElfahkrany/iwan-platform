import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Class } from "@/models/Class";
import { generateRoomName } from "@/lib/jitsi";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get("teacherId");
    const subject = searchParams.get("subject");
    const filter: Record<string, unknown> = {};
    if (teacherId) filter.teacherId = teacherId;
    if (subject) filter.subject = subject;
    const classes = await Class.find({ ...filter, startTime: { $gte: new Date() } })
      .sort({ startTime: 1 })
      .lean();
    return NextResponse.json(
      classes.map((c) => ({
        ...c,
        _id: c._id.toString(),
        teacherId: c.teacherId.toString(),
        enrolledStudents: c.enrolledStudents.map((id: { toString: () => string }) => id.toString()),
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
    if (!session?.user || session.user.role !== "teacher") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const body = await req.json();
    const cls = await Class.create({
      teacherId: session.user.id,
      ...body,
      meetingRoomName: generateRoomName("class"),
      enrolledStudents: [],
    });
    return NextResponse.json({ id: cls._id.toString() }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
