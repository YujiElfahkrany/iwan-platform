import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { TeacherProfile } from "@/models/TeacherProfile";

const FALLBACK_SUBJECTS = [
  "قرآن كريم",
  "تجويد",
  "حفظ القرآن",
  "تفسير",
  "علوم القرآن",
  "حديث شريف",
  "مصطلح الحديث",
  "فقه",
  "أصول الفقه",
  "عقيدة",
  "سيرة نبوية",
  "تاريخ إسلامي",
  "تربية إسلامية",
  "أخلاق إسلامية",
  "لغة عربية",
  "نحو",
  "صرف",
  "بلاغة",
  "أدب عربي",
];

export async function GET() {
  try {
    await connectDB();
    const profiles = await TeacherProfile.find({}, { subjects: 1 }).lean();
    const fromDB = [...new Set(profiles.flatMap((p) => p.subjects as string[]))].filter(Boolean);
    const merged = [...new Set([...FALLBACK_SUBJECTS, ...fromDB])].sort();
    return NextResponse.json(merged);
  } catch {
    return NextResponse.json(FALLBACK_SUBJECTS);
  }
}
