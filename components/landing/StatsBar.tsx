import { useTranslations } from "next-intl";
import { Users, GraduationCap, BookOpen, Layers } from "lucide-react";
import { Link } from "@/i18n/navigation";


interface Stats {
  teachers: number;
  students: number;
  classes: number;
  subjects: number;
}

export function StatsBar({ stats }: { stats: Stats }) {
  const t = useTranslations("stats");

  const items = [
    { icon: <GraduationCap className="h-6 w-6" />, value: stats.teachers, label: t("teachers") },
    { icon: <Users className="h-6 w-6" />, value: stats.students, label: t("students") },
    { icon: <BookOpen className="h-6 w-6" />, value: stats.classes, label: t("classes") },
    { icon: <Layers className="h-6 w-6" />, value: stats.subjects ?? 0, label: t("subjects") },
  ];

  return (
    <section className="bg-transparent pb-8">
      <div className="container mx-auto px-4">
        {/* White floating card — matches Zad Academy stats bar */}
        <div className="bg-white rounded-2xl shadow-md px-6 py-5 flex flex-wrap items-center justify-between gap-6">
          {/* Gold register CTA — left side in RTL (end) */}
          <Link
            href="/auth/register/student"
            className="inline-flex items-center justify-center bg-gradient-to-b from-[#d4a843] to-[#a67c2e] text-white font-bold px-7 py-2.5 rounded-lg text-sm shadow-sm hover:from-[#c8973a] hover:to-[#8a6420] transition-all whitespace-nowrap"
          >
            {t("register_now")}
          </Link>

          {/* Stats — right side fills the rest */}
          <div className="flex flex-1 flex-wrap items-center justify-around gap-6">
            {items.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                {/* Teal icon */}
                <div className="text-[#4db6ac] shrink-0">{item.icon}</div>
                <div className="text-end">
                  <p className="text-lg font-bold text-[#2c1f12]">{item.value.toLocaleString()}+</p>
                  <p className="text-xs text-[#78716c]">{item.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
