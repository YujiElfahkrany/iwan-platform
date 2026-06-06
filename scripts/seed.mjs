import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) { console.error("MONGODB_URI not set"); process.exit(1); }

await mongoose.connect(MONGODB_URI);
console.log("Connected to MongoDB");

// ── Schemas ──────────────────────────────────────────────────────────────────
const UserSchema = new mongoose.Schema({
  name: String, email: { type: String, lowercase: true }, passwordHash: String,
  role: String, balance: { type: Number, default: 0 }, avatar: String,
}, { timestamps: true });

const TeacherProfileSchema = new mongoose.Schema({
  userId: mongoose.Schema.Types.ObjectId, subjects: [String],
  experienceYears: Number, qualifications: [String], certifications: [String],
  bio: String, languages: [String], hourlyRate: Number, timezone: String,
  rating: Number, totalReviews: Number,
}, { timestamps: true });

const ClassSchema = new mongoose.Schema({
  teacherId: mongoose.Schema.Types.ObjectId, title: String, description: String,
  subject: String, startTime: Date, endTime: Date, price: Number,
  maxStudents: Number, enrolledStudents: [mongoose.Schema.Types.ObjectId],
  meetingRoomName: String, status: String,
}, { timestamps: true });

const User           = mongoose.models.User           ?? mongoose.model("User",           UserSchema);
const TeacherProfile = mongoose.models.TeacherProfile ?? mongoose.model("TeacherProfile", TeacherProfileSchema);
const Class          = mongoose.models.Class          ?? mongoose.model("Class",          ClassSchema);

// ── Teachers ─────────────────────────────────────────────────────────────────
const hash = await bcrypt.hash("teacher123", 12);
const now  = new Date();

const teacherData = [
  {
    name: "أحمد محمد حسن", email: "ahmed@iwan.test",
    subjects: ["رياضيات", "فيزياء"],
    bio: "مدرس رياضيات وفيزياء بخبرة 10 سنوات في التعليم الثانوي والجامعي. حاصل على ماجستير رياضيات تطبيقية.",
    languages: ["عربي", "إنجليزي"], hourlyRate: 150, experienceYears: 10,
    qualifications: ["ماجستير رياضيات تطبيقية", "بكالوريوس تربية"],
    rating: 4.8, totalReviews: 42,
  },
  {
    name: "فاطمة إبراهيم", email: "fatima@iwan.test",
    subjects: ["لغة عربية", "قرآن كريم"],
    bio: "معلمة لغة عربية وتحفيظ قرآن بأسلوب مبتكر. خبرة 7 سنوات مع الأطفال والبالغين.",
    languages: ["عربي"], hourlyRate: 120, experienceYears: 7,
    qualifications: ["بكالوريوس لغة عربية وآدابها", "إجازة في القراءات"],
    rating: 4.9, totalReviews: 68,
  },
  {
    name: "عمر خالد السيد", email: "omar@iwan.test",
    subjects: ["برمجة", "علوم حاسوب"],
    bio: "مهندس برمجيات متخصص في Python وJavaScript. يعلّم البرمجة للمبتدئين والمتقدمين.",
    languages: ["عربي", "إنجليزي"], hourlyRate: 200, experienceYears: 5,
    qualifications: ["بكالوريوس هندسة حاسوب", "شهادة AWS"],
    rating: 4.7, totalReviews: 31,
  },
  {
    name: "ليلى يوسف", email: "layla@iwan.test",
    subjects: ["لغة إنجليزية", "تاريخ"],
    bio: "معلمة لغة إنجليزية معتمدة بشهادة TEFL. متخصصة في IELTS والإنجليزية للأعمال.",
    languages: ["عربي", "إنجليزي", "فرنسي"], hourlyRate: 130, experienceYears: 8,
    qualifications: ["بكالوريوس ترجمة", "شهادة TEFL", "IELTS 8.0"],
    rating: 4.6, totalReviews: 55,
  },
];

const createdTeachers = [];
for (const t of teacherData) {
  let user = await User.findOne({ email: t.email });
  if (!user) {
    user = await User.create({ name: t.name, email: t.email, passwordHash: hash, role: "teacher", balance: 0 });
    console.log(`  Created teacher: ${t.name}`);
  } else {
    console.log(`  Teacher exists: ${t.name}`);
  }
  await TeacherProfile.findOneAndUpdate(
    { userId: user._id },
    { userId: user._id, subjects: t.subjects, bio: t.bio, languages: t.languages,
      hourlyRate: t.hourlyRate, experienceYears: t.experienceYears,
      qualifications: t.qualifications, certifications: [], rating: t.rating,
      totalReviews: t.totalReviews, timezone: "Africa/Cairo" },
    { upsert: true, new: true }
  );
  createdTeachers.push({ userId: user._id, ...t });
}

// ── Classes ───────────────────────────────────────────────────────────────────
const classTemplates = [
  { ti: 0, title: "مراجعة التفاضل والتكامل",      description: "جلسة مراجعة شاملة لمفاهيم التفاضل والتكامل للصف الثالث الثانوي.", subject: "رياضيات",       h: 24,  dur: 1.5, price: 80,  max: 10 },
  { ti: 0, title: "أساسيات الفيزياء — الميكانيكا", description: "مقدمة في قوانين نيوتن والحركة مع تطبيقات عملية.",                 subject: "فيزياء",        h: 48,  dur: 2,   price: 100, max: 8  },
  { ti: 1, title: "قواعد النحو والصرف",             description: "درس تفصيلي في قواعد اللغة العربية مع تمارين تفاعلية.",           subject: "لغة عربية",     h: 36,  dur: 1,   price: 60,  max: 12 },
  { ti: 1, title: "تحفيظ سورة البقرة — الجزء الأول", description: "جلسة تحفيظ وتجويد مع شرح المعاني.",                            subject: "قرآن كريم",     h: 72,  dur: 1,   price: 50,  max: 6  },
  { ti: 2, title: "تعلم Python من الصفر",           description: "للمبتدئين: المتغيرات والحلقات والدوال.",                         subject: "برمجة",         h: 12,  dur: 2,   price: 120, max: 15 },
  { ti: 2, title: "بناء مواقع ويب بـ React",        description: "مقدمة عملية في React.js مع بناء تطبيق حقيقي خلال الجلسة.",       subject: "برمجة",         h: 96,  dur: 2.5, price: 150, max: 10 },
  { ti: 3, title: "IELTS Speaking & Writing",       description: "تحضير مكثف لاختبار IELTS في مهارتي التحدث والكتابة.",            subject: "لغة إنجليزية",  h: 60,  dur: 1.5, price: 90,  max: 8  },
  { ti: 3, title: "الإنجليزية للأعمال",             description: "مصطلحات وأساليب الإنجليزية في بيئة العمل والمراسلات المهنية.",   subject: "لغة إنجليزية",  h: 84,  dur: 1,   price: 70,  max: 12 },
];

let created = 0;
for (const tmpl of classTemplates) {
  const teacher = createdTeachers[tmpl.ti];
  const startTime = new Date(now.getTime() + tmpl.h * 3600000);
  const endTime   = new Date(startTime.getTime() + tmpl.dur * 3600000);
  const exists    = await Class.findOne({ title: tmpl.title, teacherId: teacher.userId });
  if (!exists) {
    await Class.create({
      teacherId: teacher.userId, title: tmpl.title, description: tmpl.description,
      subject: tmpl.subject, startTime, endTime, price: tmpl.price,
      maxStudents: tmpl.max, enrolledStudents: [],
      meetingRoomName: `iwan-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      status: "open",
    });
    console.log(`  Created class: ${tmpl.title}`);
    created++;
  } else {
    console.log(`  Class exists: ${tmpl.title}`);
  }
}

console.log(`\nDone — ${created} classes created.`);
await mongoose.disconnect();
