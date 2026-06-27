import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { TeacherProfile } from "@/models/TeacherProfile";
import { StudentProfile } from "@/models/StudentProfile";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, email, password, role, profile, image, phone } = body;

    if (!name || !email || !password || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    await connectDB();

    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: "Email already registered" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, passwordHash, role, balance: 0, avatar: image, phone });

    if (role === "teacher") {
      await TeacherProfile.create({ userId: user._id, ...profile });
    } else {
      await StudentProfile.create({ userId: user._id, ...profile });
    }

    return NextResponse.json({ id: user._id.toString() }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
