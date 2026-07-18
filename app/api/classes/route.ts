import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { Class } from "@/models/Class";
import { generateRoomName } from "@/lib/video";
import { studentClassPrice } from "@/lib/pricing";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const teacherId = searchParams.get("teacherId");
    const subject = searchParams.get("subject");
    const enrolled = searchParams.get("enrolled");
    const mine = searchParams.get("mine");
    const filter: Record<string, unknown> = {};
    if (teacherId) filter.teacherId = teacherId;
    if (subject) filter.subject = subject;

    // Teacher's own classes: no startTime cutoff, so past/today classes remain visible
    if (mine === "true") {
      const session = await auth();
      if (!session?.user || session.user.role !== "teacher") {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const classes = await Class.find({ teacherId: session.user.id }).sort({ startTime: -1 }).lean();
      return NextResponse.json(
        classes.map((c) => ({
          ...c,
          _id: c._id.toString(),
          teacherId: c.teacherId.toString(),
          enrolledStudents: c.enrolledStudents.map((id: { toString: () => string }) => id.toString()),
          studentPrice: studentClassPrice(c.price),
        }))
      );
    }

    if (enrolled === "true") {
      const session = await auth();
      if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      const studentObjId = new mongoose.Types.ObjectId(session.user.id);
      filter.enrolledStudents = studentObjId;
      console.log("[classes/enrolled] user:", session.user.id, "filter:", JSON.stringify(filter));
      const classes = await Class.find(filter).sort({ startTime: 1 }).lean();
      console.log("[classes/enrolled] found:", classes.length, "classes");
      return NextResponse.json(
        classes.map((c) => ({
          ...c,
          _id: c._id.toString(),
          teacherId: c.teacherId.toString(),
          enrolledStudents: c.enrolledStudents.map((id: { toString: () => string }) => id.toString()),
          studentPrice: studentClassPrice(c.price),
        }))
      );
    }

    // Visibility is status-based: recurring courses stay listed after their first session starts
    const classes = await Class.find({ ...filter, status: { $in: ["open", "full"] } })
      .sort({ startTime: 1 })
      .lean();
    return NextResponse.json(
      classes.map((c) => ({
        ...c,
        _id: c._id.toString(),
        teacherId: c.teacherId.toString(),
        enrolledStudents: c.enrolledStudents.map((id: { toString: () => string }) => id.toString()),
        studentPrice: studentClassPrice(c.price),
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
      ...body,
      // Fields below must win over anything in the client body.
      teacherId: session.user.id,
      meetingRoomName: generateRoomName("class"),
      enrolledStudents: [],
    });
    return NextResponse.json({ id: cls._id.toString() }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
