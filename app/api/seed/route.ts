import { NextResponse } from "next/server";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { TeacherProfile } from "@/models/TeacherProfile";
import { Class } from "@/models/Class";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

// Only allow in development
export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not allowed in production" }, { status: 403 });
  }

  await connectDB();

  const hash = await bcrypt.hash("teacher123", 12);
  const now = new Date();

  const teachers = [
    {
      name: "أحمد محمد حسن",
      email: "ahmed@iwan.test",
      subjects: ["رياضيات", "فيزياء"],
      bio: "مدرس رياضيات وفيزياء بخبرة 10 سنوات في التعليم الثانوي والجامعي. حاصل على ماجستير رياضيات تطبيقية.",
      languages: ["عربي", "إنجليزي"],
      hourlyRate: 150,
      experienceYears: 10,
      qualifications: ["ماجستير رياضيات تطبيقية", "بكالوريوس تربية"],
      rating: 4.8,
      totalReviews: 42,
    },
    {
      name: "فاطمة إبراهيم",
      email: "fatima@iwan.test",
      subjects: ["لغة عربية", "قرآن كريم"],
      bio: "معلمة لغة عربية وتحفيظ قرآن بأسلوب مبتكر. خبرة 7 سنوات مع الأطفال والبالغين.",
      languages: ["عربي"],
      hourlyRate: 120,
      experienceYears: 7,
      qualifications: ["بكالوريوس لغة عربية وآدابها", "إجازة في القراءات"],
      rating: 4.9,
      totalReviews: 68,
    },
    {
      name: "عمر خالد السيد",
      email: "omar@iwan.test",
      subjects: ["برمجة", "علوم حاسوب"],
      bio: "مهندس برمجيات يعمل في مجال التقنية وتعليم البرمجة. متخصص في Python وJavaScript وتطوير الويب.",
      languages: ["عربي", "إنجليزي"],
      hourlyRate: 200,
      experienceYears: 5,
      qualifications: ["بكالوريوس هندسة حاسوب", "شهادة AWS"],
      rating: 4.7,
      totalReviews: 31,
    },
    {
      name: "ليلى يوسف",
      email: "layla@iwan.test",
      subjects: ["لغة إنجليزية", "تاريخ"],
      bio: "معلمة لغة إنجليزية معتمدة بشهادة TEFL. خبرة في تدريس الإنجليزية للأعمال والتحضير لـ IELTS.",
      languages: ["عربي", "إنجليزي", "فرنسي"],
      hourlyRate: 130,
      experienceYears: 8,
      qualifications: ["بكالوريوس ترجمة", "شهادة TEFL", "IELTS 8.0"],
      rating: 4.6,
      totalReviews: 55,
    },
  ];

  const createdTeachers: { userId: mongoose.Types.ObjectId; subjects: string[]; name: string }[] = [];

  for (const t of teachers) {
    let user = await User.findOne({ email: t.email });
    if (!user) {
      user = await User.create({
        name: t.name,
        email: t.email,
        passwordHash: hash,
        role: "teacher",
        balance: 0,
      });
    }

    await TeacherProfile.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        subjects: t.subjects,
        bio: t.bio,
        languages: t.languages,
        hourlyRate: t.hourlyRate,
        experienceYears: t.experienceYears,
        qualifications: t.qualifications,
        certifications: [],
        rating: t.rating,
        totalReviews: t.totalReviews,
        timezone: "Africa/Cairo",
      },
      { upsert: true, new: true }
    );

    createdTeachers.push({ userId: user._id, subjects: t.subjects, name: t.name });
  }

  // Create upcoming classes
  const classTemplates = [
    {
      teacherIdx: 0,
      title: "مراجعة التفاضل والتكامل",
      description: "جلسة مراجعة شاملة لمفاهيم التفاضل والتكامل للصف الثالث الثانوي.",
      subject: "رياضيات",
      hoursFromNow: 24,
      durationHours: 1.5,
      price: 80,
      maxStudents: 10,
    },
    {
      teacherIdx: 0,
      title: "أساسيات الفيزياء — الميكانيكا",
      description: "مقدمة في قوانين نيوتن والحركة مع تطبيقات عملية.",
      subject: "فيزياء",
      hoursFromNow: 48,
      durationHours: 2,
      price: 100,
      maxStudents: 8,
    },
    {
      teacherIdx: 1,
      title: "قواعد النحو والصرف",
      description: "درس تفصيلي في قواعد اللغة العربية مع تمارين تفاعلية.",
      subject: "لغة عربية",
      hoursFromNow: 36,
      durationHours: 1,
      price: 60,
      maxStudents: 12,
    },
    {
      teacherIdx: 1,
      title: "تحفيظ سورة البقرة — الجزء الأول",
      description: "جلسة تحفيظ وتجويد مع شرح المعاني.",
      subject: "قرآن كريم",
      hoursFromNow: 72,
      durationHours: 1,
      price: 50,
      maxStudents: 6,
    },
    {
      teacherIdx: 2,
      title: "تعلم Python من الصفر",
      description: "للمبتدئين الراغبين في دخول عالم البرمجة. سنغطي المتغيرات والحلقات والدوال.",
      subject: "برمجة",
      hoursFromNow: 12,
      durationHours: 2,
      price: 120,
      maxStudents: 15,
    },
    {
      teacherIdx: 2,
      title: "بناء مواقع ويب بـ React",
      description: "مقدمة عملية في React.js مع بناء تطبيق حقيقي خلال الجلسة.",
      subject: "برمجة",
      hoursFromNow: 96,
      durationHours: 2.5,
      price: 150,
      maxStudents: 10,
    },
    {
      teacherIdx: 3,
      title: "IELTS Speaking & Writing",
      description: "تحضير مكثف لاختبار IELTS في مهارتي التحدث والكتابة.",
      subject: "لغة إنجليزية",
      hoursFromNow: 60,
      durationHours: 1.5,
      price: 90,
      maxStudents: 8,
    },
    {
      teacherIdx: 3,
      title: "الإنجليزية للأعمال",
      description: "تعلم مصطلحات وأساليب الإنجليزية المستخدمة في بيئة العمل والمراسلات المهنية.",
      subject: "لغة إنجليزية",
      hoursFromNow: 84,
      durationHours: 1,
      price: 70,
      maxStudents: 12,
    },
  ];

  let classesCreated = 0;
  for (const tmpl of classTemplates) {
    const teacher = createdTeachers[tmpl.teacherIdx];
    const startTime = new Date(now.getTime() + tmpl.hoursFromNow * 60 * 60 * 1000);
    const endTime = new Date(startTime.getTime() + tmpl.durationHours * 60 * 60 * 1000);

    const exists = await Class.findOne({ title: tmpl.title, teacherId: teacher.userId });
    if (!exists) {
      await Class.create({
        teacherId: teacher.userId,
        title: tmpl.title,
        description: tmpl.description,
        subject: tmpl.subject,
        startTime,
        endTime,
        price: tmpl.price,
        maxStudents: tmpl.maxStudents,
        enrolledStudents: [],
        meetingRoomName: `iwan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        status: "open",
      });
      classesCreated++;
    }
  }

  return NextResponse.json({
    ok: true,
    teachers: createdTeachers.length,
    classesCreated,
  });
}
