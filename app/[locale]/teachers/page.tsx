import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { TeacherProfile } from "@/models/TeacherProfile";
import { Class } from "@/models/Class";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Link } from "@/i18n/navigation";
import { Star, BookOpen, Clock, Users, Tag } from "lucide-react";
import { getTranslations } from "next-intl/server";

// Maps URL key → search terms (Arabic name + key) for free-form DB fields
const SUBJECT_MAP: Record<string, string[]> = {
  quran:   ["القرآن", "quran"],
  tajweed: ["التجويد", "tajweed"],
  fiqh:    ["الفقه", "fiqh"],
  aqeedah: ["العقيدة", "aqeedah"],
  seerah:  ["السيرة", "seerah"],
  hadith:  ["الحديث", "hadith"],
  arabic:  ["العربية", "arabic"],
  tafseer: ["التفسير", "tafseer"],
};

const SUBJECT_LABELS: Record<string, string> = {
  quran:   "القرآن الكريم",
  tajweed: "التجويد",
  fiqh:    "الفقه",
  aqeedah: "العقيدة",
  seerah:  "السيرة النبوية",
  hadith:  "الحديث",
  arabic:  "اللغة العربية",
  tafseer: "التفسير",
};

function buildRegex(subject: string) {
  const terms = SUBJECT_MAP[subject] ?? [subject];
  return new RegExp(terms.join("|"), "i");
}

async function getTeachers(subject?: string) {
  try {
    await connectDB();
    const filter: Record<string, unknown> = {};
    if (subject) filter.subjects = { $regex: buildRegex(subject) };

    const profiles = await TeacherProfile.find(filter).lean();
    const userIds = profiles.map((p) => p.userId);
    const users = await User.find({ _id: { $in: userIds } }).lean();
    const userMap = Object.fromEntries(users.map((u) => [u._id.toString(), u]));

    return profiles.map((p) => ({
      id: p.userId.toString(),
      name: userMap[p.userId.toString()]?.name ?? "",
      avatar: userMap[p.userId.toString()]?.avatar ?? "",
      subjects: p.subjects,
      experienceYears: p.experienceYears,
      bio: p.bio,
      hourlyRate: p.hourlyRate,
      rating: p.rating,
      totalReviews: p.totalReviews,
    }));
  } catch {
    return [];
  }
}

async function getClasses(subject?: string) {
  try {
    await connectDB();
    const filter: Record<string, unknown> = {
      status: "open",
      startTime: { $gte: new Date() },
    };
    if (subject) filter.subject = { $regex: buildRegex(subject) };

    const classes = await Class.find(filter).sort({ startTime: 1 }).limit(50).lean();
    const teacherIds = [...new Set(classes.map((c) => c.teacherId.toString()))];
    const teachers = await User.find({ _id: { $in: teacherIds } }).lean();
    const teacherMap = Object.fromEntries(teachers.map((t) => [t._id.toString(), t.name]));

    return classes.map((c) => ({
      id: c._id.toString(),
      teacherId: c.teacherId.toString(),
      teacherName: teacherMap[c.teacherId.toString()] ?? "",
      title: c.title,
      description: c.description,
      subject: c.subject,
      startTime: c.startTime.toISOString(),
      endTime: c.endTime.toISOString(),
      price: c.price,
      maxStudents: c.maxStudents,
      enrolledCount: c.enrolledStudents.length,
      totalSessions: c.totalSessions ?? 0,
      curriculumCount: c.curriculum?.length ?? 0,
    }));
  } catch {
    return [];
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-EG", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startIso: string, endIso: string) {
  const mins = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000;
  if (mins < 60) return `${mins} دقيقة`;
  const hrs = mins / 60;
  return hrs === Math.floor(hrs) ? `${Math.floor(hrs)} ساعة` : `${hrs.toFixed(1)} ساعة`;
}

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject } = await searchParams;
  const [teachers, classes, t] = await Promise.all([
    getTeachers(subject),
    getClasses(subject),
    getTranslations("nav"),
  ]);

  const subjectLabel = subject ? (SUBJECT_LABELS[subject] ?? subject) : null;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto w-[90%] bg-[#f2ede8]/90 shadow-[0_0_60px_rgba(0,0,0,0.18)] min-h-screen">

          {/* Page header */}
          <div className="bg-[#2c1f12]/95 text-white py-12 text-center">
            <div className="h-0.5 bg-gradient-to-r from-transparent via-[#c8973a] to-transparent mb-8" />
            <h1 className="text-3xl font-bold mb-1">
              {subjectLabel ? `معلمو ${subjectLabel}` : t("teachers")}
            </h1>
            <p className="text-white/60 text-sm">
              {subjectLabel
                ? `تصفح المعلمين والفصول المتاحة في ${subjectLabel}`
                : "اختر معلمك المثالي وابدأ رحلة التعلم"}
            </p>
            <div className="h-0.5 bg-gradient-to-r from-transparent via-[#c8973a] to-transparent mt-8" />
          </div>

          {/* Subject filter tabs */}
          <div className="border-b border-[#e5ddd4] bg-white/60 px-4 py-3 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max mx-auto container">
              <Link
                href="/teachers"
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  !subject
                    ? "bg-[#2c1f12] text-white"
                    : "text-[#78716c] hover:text-[#2c1f12] hover:bg-[#f2ede8]"
                }`}
              >
                الكل
              </Link>
              {Object.entries(SUBJECT_LABELS).map(([key, label]) => (
                <Link
                  key={key}
                  href={`/teachers?subject=${key}`}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                    subject === key
                      ? "bg-[#c8973a] text-white"
                      : "text-[#78716c] hover:text-[#2c1f12] hover:bg-[#f2ede8]"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>

          <div className="container mx-auto px-4 py-12 space-y-16">

            {/* ── Teachers section ── */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <span className="text-[#c8973a] text-xl">◁</span>
                <h2 className="text-2xl font-bold text-[#2c1f12]">المعلمون</h2>
                {teachers.length > 0 && (
                  <span className="text-sm text-[#78716c] me-auto">{teachers.length} معلم</span>
                )}
              </div>

              {teachers.length === 0 ? (
                <div className="text-center py-14 text-[#78716c]">
                  <BookOpen className="h-10 w-10 mx-auto mb-3 text-[#c8973a]/30" />
                  <p className="font-medium">لا يوجد معلمون متاحون حالياً</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {teachers.map((teacher) => (
                    <Link
                      key={teacher.id}
                      href={`/teachers/${teacher.id}`}
                      className="group bg-white rounded-2xl border border-[#e5ddd4] shadow-sm hover:shadow-md hover:border-[#c8973a]/40 transition-all duration-200 overflow-hidden"
                    >
                      <div className="bg-gradient-to-br from-[#2c1f12] to-[#3d2b18] p-6 flex items-center gap-4">
                        {teacher.avatar ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={teacher.avatar}
                            alt={teacher.name}
                            className="w-16 h-16 rounded-full object-cover border-2 border-[#c8973a]/50"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-full bg-[#c8973a]/20 border-2 border-[#c8973a]/50 flex items-center justify-center shrink-0">
                            <span className="text-2xl font-bold text-[#c8973a]">
                              {teacher.name.charAt(0)}
                            </span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-white text-lg truncate">{teacher.name}</h3>
                          {teacher.rating > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <Star className="h-3.5 w-3.5 fill-[#c8973a] text-[#c8973a]" />
                              <span className="text-[#c8973a] text-sm font-medium">{teacher.rating.toFixed(1)}</span>
                              <span className="text-white/40 text-xs">({teacher.totalReviews})</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="p-5 space-y-3">
                        {teacher.subjects.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {teacher.subjects.slice(0, 3).map((s: string) => (
                              <span
                                key={s}
                                className="text-xs px-2.5 py-1 rounded-full bg-[#f2ede8] text-[#2c1f12] border border-[#e5ddd4]"
                              >
                                {s}
                              </span>
                            ))}
                            {teacher.subjects.length > 3 && (
                              <span className="text-xs px-2.5 py-1 rounded-full bg-[#f2ede8] text-[#78716c]">
                                +{teacher.subjects.length - 3}
                              </span>
                            )}
                          </div>
                        )}

                        {teacher.bio && (
                          <p className="text-sm text-[#78716c] line-clamp-2 leading-relaxed">
                            {teacher.bio}
                          </p>
                        )}

                        <div className="flex items-center justify-between pt-2 border-t border-[#f0ebe3]">
                          <div className="flex items-center gap-1 text-xs text-[#78716c]">
                            <Clock className="h-3.5 w-3.5" />
                            <span>{teacher.experienceYears} سنوات خبرة</span>
                          </div>
                          {teacher.hourlyRate > 0 && (
                            <span className="text-sm font-bold text-[#c8973a]">
                              {teacher.hourlyRate} ج/ساعة
                            </span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </section>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-[#c8973a]/40 to-transparent" />

            {/* ── Classes section ── */}
            <section>
              <div className="flex items-center gap-2 mb-6">
                <span className="text-[#c8973a] text-xl">◁</span>
                <h2 className="text-2xl font-bold text-[#2c1f12]">الفصول الجماعية</h2>
                {classes.length > 0 && (
                  <span className="text-sm text-[#78716c] me-auto">{classes.length} فصل متاح</span>
                )}
              </div>

              {classes.length === 0 ? (
                <div className="text-center py-14 text-[#78716c]">
                  <BookOpen className="h-10 w-10 mx-auto mb-3 text-[#c8973a]/30" />
                  <p className="font-medium">لا توجد فصول متاحة حالياً</p>
                  <p className="text-sm mt-1">تحقق مجدداً قريباً</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {classes.map((cls) => {
                    const spotsLeft = cls.maxStudents - cls.enrolledCount;
                    return (
                      <div
                        key={cls.id}
                        className="bg-white rounded-2xl border border-[#e5ddd4] shadow-sm hover:shadow-md hover:border-[#c8973a]/40 transition-all duration-200 overflow-hidden flex flex-col"
                      >
                        <div className="h-1 bg-gradient-to-r from-[#c8973a] to-[#4db6ac]" />

                        <div className="p-5 flex flex-col flex-1">
                          <div className="flex items-center justify-between mb-3">
                            <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-[#c8973a]/10 text-[#c8973a] border-[#c8973a]/30">
                              {cls.subject}
                            </span>
                            <span className={`text-xs font-medium ${spotsLeft <= 3 ? "text-red-500" : "text-[#78716c]"}`}>
                              {spotsLeft} مقعد متاح
                            </span>
                          </div>

                          <h3 className="font-bold text-[#2c1f12] text-base leading-snug mb-2">
                            {cls.title}
                          </h3>

                          {cls.description && (
                            <p className="text-sm text-[#78716c] line-clamp-2 leading-relaxed mb-4 flex-1">
                              {cls.description}
                            </p>
                          )}

                          <div className="space-y-1.5 text-xs text-[#78716c] mt-auto">
                            <div className="flex items-center gap-2">
                              <Clock className="h-3.5 w-3.5 text-[#4db6ac] shrink-0" />
                              <span>{formatDate(cls.startTime)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Tag className="h-3.5 w-3.5 text-[#4db6ac] shrink-0" />
                              <span>المدة: {formatDuration(cls.startTime, cls.endTime)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Users className="h-3.5 w-3.5 text-[#4db6ac] shrink-0" />
                              <span>
                                {cls.enrolledCount} / {cls.maxStudents} طالب — {cls.teacherName}
                              </span>
                            </div>
                            {cls.totalSessions > 0 && (
                              <div className="flex items-center gap-2">
                                <BookOpen className="h-3.5 w-3.5 text-[#4db6ac] shrink-0" />
                                <span>{cls.totalSessions} جلسة · {cls.curriculumCount} واجب</span>
                              </div>
                            )}
                          </div>

                          <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#f0ebe3]">
                            <span className="font-bold text-[#c8973a] text-lg">
                              {cls.price} ج.م
                            </span>
                            <Link
                              href={`/teachers/${cls.teacherId}`}
                              className="text-sm font-semibold px-4 py-1.5 rounded-full bg-[#2c1f12] text-white hover:bg-[#3d2b18] transition-colors"
                            >
                              احجز الآن
                            </Link>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
