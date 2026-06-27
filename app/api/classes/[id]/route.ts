import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { Class } from "@/models/Class";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { id } = await params;
    const cls = await Class.findById(id).lean();
    if (!cls) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({
      ...cls,
      _id: cls._id.toString(),
      teacherId: cls.teacherId.toString(),
      enrolledStudents: cls.enrolledStudents.map((s: { toString: () => string }) => s.toString()),
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
