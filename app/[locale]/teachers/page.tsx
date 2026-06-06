import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { TeacherProfile } from "@/models/TeacherProfile";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/landing/Footer";
import { Link } from "@/i18n/navigation";
import { Star, BookOpen, Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";

async function getTeachers(subject?: string) {
  try {
    await connectDB();
    const filter: Record<string, unknown> = {};
    if (subject) filter.subjects = subject;

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

export default async function TeachersPage({
  searchParams,
}: {
  searchParams: Promise<{ subject?: string }>;
}) {
  const { subject } = await searchParams;
  const teachers = await getTeachers(subject);
  const t = await getTranslations("nav");

  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1 bg-[#f2ede8]">
        {/* Header */}
        <div className="bg-[#2c1f12] text-white py-12">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-3xl font-bold mb-2">
              {t("teachers")}
            </h1>
            <p className="text-white/60 text-sm">
              اختر معلمك المثالي وابدأ رحلة التعلم
            </p>
          </div>
        </div>

        {/* Teachers grid */}
        <div className="container mx-auto px-4 py-12">
          {teachers.length === 0 ? (
            <div className="text-center py-20 text-[#78716c]">
              <BookOpen className="h-12 w-12 mx-auto mb-4 text-[#c8973a]/40" />
              <p className="text-lg font-medium">لا يوجد معلمون متاحون حالياً</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {teachers.map((teacher) => (
                <Link
                  key={teacher.id}
                  href={`/teachers/${teacher.id}`}
                  className="group bg-white rounded-2xl border border-[#e5ddd4] shadow-sm hover:shadow-md hover:border-[#c8973a]/40 transition-all duration-200 overflow-hidden"
                >
                  {/* Card header */}
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

                  {/* Card body */}
                  <div className="p-5 space-y-3">
                    {/* Subjects */}
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

                    {/* Bio */}
                    {teacher.bio && (
                      <p className="text-sm text-[#78716c] line-clamp-2 leading-relaxed">
                        {teacher.bio}
                      </p>
                    )}

                    {/* Footer meta */}
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
        </div>
      </main>
      <Footer />
    </div>
  );
}
