import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { TeacherProfile } from "@/models/TeacherProfile";

export async function GET(req: NextRequest) {
  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const subject = searchParams.get("subject");
    const language = searchParams.get("language");
    const minRate = searchParams.get("minRate");
    const maxRate = searchParams.get("maxRate");

    const filter: Record<string, unknown> = {};
    if (subject) filter.subjects = subject;
    if (language) filter.languages = language;
    if (minRate || maxRate) {
      filter.hourlyRate = {};
      if (minRate) (filter.hourlyRate as Record<string, number>).$gte = parseFloat(minRate);
      if (maxRate) (filter.hourlyRate as Record<string, number>).$lte = parseFloat(maxRate);
    }

    const profiles = await TeacherProfile.find(filter).lean();
    const userIds = profiles.map((p) => p.userId);
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    const teachers = profiles.map((p) => ({
      ...p,
      _id: p._id.toString(),
      userId: p.userId.toString(),
      user: userMap[p.userId.toString()] ? {
        name: userMap[p.userId.toString()].name,
        avatar: userMap[p.userId.toString()].avatar,
      } : null,
    }));

    return NextResponse.json(teachers);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
