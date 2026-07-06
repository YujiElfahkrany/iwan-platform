import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { TeacherProfile } from "@/models/TeacherProfile";
import { StudentProfile } from "@/models/StudentProfile";
import { resend, FROM_EMAIL } from "@/lib/resend";

const ADMIN_NOTIFICATION_EMAIL = "vizwrks@gmail.com";

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
    const user = await User.create({ name, email, passwordHash, role, status: "pending", balance: 0, avatar: image, phone });

    if (role === "teacher") {
      await TeacherProfile.create({ userId: user._id, ...profile });
    } else {
      await StudentProfile.create({ userId: user._id, ...profile });
    }

    try {
      await resend.emails.send({
        from: FROM_EMAIL,
        to: ADMIN_NOTIFICATION_EMAIL,
        subject: `New ${role} registration awaiting approval — ${name}`,
        html: `
          <p>A new ${role} has registered on Iwan Academy and is awaiting approval:</p>
          <ul>
            <li><strong>Name:</strong> ${name}</li>
            <li><strong>Email:</strong> ${email}</li>
            <li><strong>Role:</strong> ${role}</li>
          </ul>
          <p>Review and approve or reject this account from the admin dashboard.</p>
        `,
      });
    } catch (emailErr) {
      console.error("Failed to send admin notification email:", emailErr);
    }

    return NextResponse.json({ id: user._id.toString() }, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
