import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";

export async function POST(req: NextRequest) {
  const secret = process.env.ADMIN_SETUP_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 403 });
  }

  const { setupSecret, email, password, name } = await req.json();

  if (setupSecret !== secret) {
    return NextResponse.json({ error: "Invalid secret" }, { status: 403 });
  }
  if (!email || !password || !name) {
    return NextResponse.json({ error: "email, password and name are required" }, { status: 400 });
  }

  await connectDB();

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role === "admin") {
      return NextResponse.json({ message: "Admin already exists", email }, { status: 200 });
    }
    // Upgrade existing user to admin
    existing.role = "admin";
    await existing.save();
    return NextResponse.json({ message: "User promoted to admin", email }, { status: 200 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await User.create({ name, email, passwordHash, role: "admin", balance: 0 });

  return NextResponse.json({ message: "Admin created", email }, { status: 201 });
}
