import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { TeacherProfile } from "@/models/TeacherProfile";
import { StudentProfile } from "@/models/StudentProfile";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    await connectDB();

    const userUpdates: Record<string, unknown> = {};
    if (typeof body.name === "string" && body.name.trim()) {
      userUpdates.name = body.name.trim();
    }
    if (typeof body.avatar === "string" && body.avatar) {
      if (body.avatar.length > MAX_AVATAR_BYTES) {
        return NextResponse.json({ error: "Avatar image too large" }, { status: 413 });
      }
      userUpdates.avatar = body.avatar;
    }
    if (Object.keys(userUpdates).length) {
      await User.findByIdAndUpdate(session.user.id, userUpdates);
    }

    if (session.user.role === "teacher") {
      const {
        bio, subjects, experienceYears, qualifications, certifications, languages, hourlyRate,
      } = body;
      await TeacherProfile.findOneAndUpdate(
        { userId: session.user.id },
        {
          ...(typeof bio === "string" && { bio }),
          ...(Array.isArray(subjects) && { subjects }),
          ...(typeof experienceYears === "number" && { experienceYears }),
          ...(Array.isArray(qualifications) && { qualifications }),
          ...(Array.isArray(certifications) && { certifications }),
          ...(Array.isArray(languages) && { languages }),
          ...(typeof hourlyRate === "number" && { hourlyRate }),
        }
      );
    } else if (session.user.role === "student") {
      const { subjects, learningLevel, learningHistory, goals, languages } = body;
      await StudentProfile.findOneAndUpdate(
        { userId: session.user.id },
        {
          ...(Array.isArray(subjects) && { subjects }),
          ...(typeof learningLevel === "string" && { learningLevel }),
          ...(typeof learningHistory === "string" && { learningHistory }),
          ...(typeof goals === "string" && { goals }),
          ...(Array.isArray(languages) && { languages }),
        }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
