import { connectDB } from "@/lib/mongodb";
import { Class } from "@/models/Class";
import { User } from "@/models/User";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Link } from "@/i18n/navigation";
import { Users, Clock, BookOpen, Tag } from "lucide-react";
import { getTranslations, getLocale } from "next-intl/server";

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

const SUBJECT_KEYS = ["quran", "tajweed", "fiqh", "aqeedah", "seerah", "hadith", "arabic", "tafseer"];

function buildRegex(subject: string) {
  const terms = SUBJECT_MAP[subject] ?? [subject];
  return new RegExp(terms.join("|"), "i");
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

function formatDate(iso: string, locale: string) {
  return new Date(iso).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startIso: string, endIso: string, minuteLabel: string, hourLabel: string) {
  const mins = (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000;
  if (mins < 60) return `${mins} ${minuteLabel}`;
  const hrs = mins / 60;
  return `${hrs === Math.floor(hrs) ? Math.floor(hrs) : hrs.toFixed(1)} ${hourLabel}`;
}

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject } = await searchParams;
  const locale = await getLocale();

  const [classes, t, ts] = await Promise.all([
    getClasses(subject),
    getTranslations("browse"),
    getTranslations("subjects"),
  ]);

  const subjectLabel = subject ? (ts as (k: string) => string)(subject) : null;

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <div className="mx-auto w-[90%] bg-[#f2ede8]/90 shadow-[0_0_60px_rgba(0,0,0,0.18)] min-h-screen">

          {/* Page header */}
          <div className="bg-[#2c1f12]/95 text-white py-12 text-center">
            <div className="h-0.5 bg-gradient-to-r from-transparent via-[#c8973a] to-transparent mb-8" />
            <h1 className="text-3xl font-bold mb-1">
              {subjectLabel ? t("classes_of", { subject: subjectLabel }) : t("classes")}
            </h1>
            <p className="text-white/60 text-sm">
              {subjectLabel
                ? t("classes_subject_subtitle", { subject: subjectLabel })
                : t("classes_subtitle")}
            </p>
            <div className="h-0.5 bg-gradient-to-r from-transparent via-[#c8973a] to-transparent mt-8" />
          </div>

          {/* Subject filter tabs */}
          <div className="border-b border-[#e5ddd4] bg-white/60 px-4 py-3 overflow-x-auto">
            <div className="flex items-center gap-2 min-w-max mx-auto container">
              <Link
                href="/classes"
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                  !subject
                    ? "bg-[#2c1f12] text-white"
                    : "text-[#78716c] hover:text-[#2c1f12] hover:bg-[#f2ede8]"
                }`}
              >
                {t("all")}
              </Link>
              {SUBJECT_KEYS.map((key) => (
                <Link
                  key={key}
                  href={`/classes?subject=${key}`}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                    subject === key
                      ? "bg-[#c8973a] text-white"
                      : "text-[#78716c] hover:text-[#2c1f12] hover:bg-[#f2ede8]"
                  }`}
                >
                  {(ts as (k: string) => string)(key)}
                </Link>
              ))}
            </div>
          </div>

          {/* Classes grid */}
          <div className="container mx-auto px-4 py-12">
            <div className="flex items-center gap-2 mb-6">
              <span className="text-[#c8973a] text-xl">◁</span>
              <h2 className="text-2xl font-bold text-[#2c1f12]">{t("classes_available")}</h2>
              {classes.length > 0 && (
                <span className="text-sm text-[#78716c] me-auto">{t("class_count", { n: classes.length })}</span>
              )}
            </div>

            {classes.length === 0 ? (
              <div className="text-center py-20 text-[#78716c]">
                <BookOpen className="h-12 w-12 mx-auto mb-4 text-[#c8973a]/40" />
                <p className="text-lg font-medium">{t("no_classes")}</p>
                <p className="text-sm mt-1">{t("check_back")}</p>
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
                            {t("spots_left", { n: spotsLeft })}
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
                            <span>{formatDate(cls.startTime, locale)}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Tag className="h-3.5 w-3.5 text-[#4db6ac] shrink-0" />
                            <span>{t("duration", { d: formatDuration(cls.startTime, cls.endTime, t("minute"), t("hour")) })}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-3.5 w-3.5 text-[#4db6ac] shrink-0" />
                            <span>{t("students_enrolled", { enrolled: cls.enrolledCount, max: cls.maxStudents, teacher: cls.teacherName })}</span>
                          </div>
                          {cls.totalSessions > 0 && (
                            <div className="flex items-center gap-2">
                              <BookOpen className="h-3.5 w-3.5 text-[#4db6ac] shrink-0" />
                              <span>{t("sessions_assignments", { sessions: cls.totalSessions, assignments: cls.curriculumCount })}</span>
                            </div>
                          )}
                        </div>

                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-[#f0ebe3]">
                          <span className="font-bold text-[#c8973a] text-lg">
                            {cls.price} LE
                          </span>
                          <Link
                            href={`/teachers/${cls.teacherId}`}
                            className="text-sm font-semibold px-4 py-1.5 rounded-full bg-[#2c1f12] text-white hover:bg-[#3d2b18] transition-colors"
                          >
                            {t("book_now")}
                          </Link>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
