import { connectDB } from "@/lib/mongodb";
import { Class } from "@/models/Class";
import { User } from "@/models/User";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Link } from "@/i18n/navigation";
import { Users, Clock, BookOpen, Tag } from "lucide-react";

async function getClasses(subject?: string) {
  try {
    await connectDB();
    const filter: Record<string, unknown> = {
      status: "open",
      startTime: { $gte: new Date() },
    };
    if (subject) filter.subject = subject;

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
      status: c.status,
    }));
  } catch {
    return [];
  }
}

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("ar-EG", {
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
  return hrs === Math.floor(hrs) ? `${Math.floor(hrs)} ساعة` : `${hrs} ساعة`;
}

const subjectColors: Record<string, string> = {
  "رياضيات": "bg-blue-50 text-blue-700 border-blue-200",
  "فيزياء": "bg-purple-50 text-purple-700 border-purple-200",
  "لغة عربية": "bg-emerald-50 text-emerald-700 border-emerald-200",
  "قرآن كريم": "bg-teal-50 text-teal-700 border-teal-200",
  "برمجة": "bg-orange-50 text-orange-700 border-orange-200",
  "لغة إنجليزية": "bg-indigo-50 text-indigo-700 border-indigo-200",
  "تاريخ": "bg-amber-50 text-amber-700 border-amber-200",
};

export default async function ClassesPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject } = await searchParams;
  const classes = await getClasses(subject);

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 bg-[#f2ede8]">
        {/* Header */}
        <div className="bg-[#2c1f12] text-white py-12">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-3xl font-bold mb-2">الفصول الجماعية</h1>
            <p className="text-white/60 text-sm">
              انضم إلى فصول مباشرة مع مجموعة من الطلاب بأسعار مخفضة
            </p>
          </div>
        </div>

        {/* Classes list */}
        <div className="container mx-auto px-4 py-12">
          {classes.length === 0 ? (
            <div className="text-center py-20 text-[#78716c]">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-[#c8973a]/40" />
              <p className="text-lg font-medium">لا توجد فصول متاحة حالياً</p>
              <p className="text-sm mt-1">تحقق مجدداً قريباً</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {classes.map((cls) => {
                const spotsLeft = cls.maxStudents - cls.enrolledCount;
                const subjectColor = subjectColors[cls.subject] ?? "bg-[#f2ede8] text-[#2c1f12] border-[#e5ddd4]";

                return (
                  <div
                    key={cls.id}
                    className="bg-white rounded-2xl border border-[#e5ddd4] shadow-sm hover:shadow-md hover:border-[#c8973a]/40 transition-all duration-200 overflow-hidden flex flex-col"
                  >
                    {/* Card top accent */}
                    <div className="h-1 bg-gradient-to-r from-[#c8973a] to-[#4db6ac]" />

                    <div className="p-5 flex flex-col flex-1">
                      {/* Subject badge + spots */}
                      <div className="flex items-center justify-between mb-3">
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${subjectColor}`}>
                          {cls.subject}
                        </span>
                        <span className={`text-xs font-medium ${spotsLeft <= 3 ? "text-red-500" : "text-[#78716c]"}`}>
                          {spotsLeft} مقعد متاح
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="font-bold text-[#2c1f12] text-base leading-snug mb-2">
                        {cls.title}
                      </h3>

                      {/* Description */}
                      {cls.description && (
                        <p className="text-sm text-[#78716c] line-clamp-2 leading-relaxed mb-4 flex-1">
                          {cls.description}
                        </p>
                      )}

                      {/* Meta */}
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
                      </div>

                      {/* Footer */}
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
        </div>
      </main>
      <Footer />
    </div>
  );
}
