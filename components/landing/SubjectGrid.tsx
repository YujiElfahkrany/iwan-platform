import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import {
  Calculator, Languages, Globe, FlaskConical,
  BookOpen, Code2, Star, Palette
} from "lucide-react";

const subjects = [
  { key: "math",        icon: <Calculator className="h-7 w-7" />,    color: "text-[#4db6ac] bg-white" },
  { key: "arabic",      icon: <Languages className="h-7 w-7" />,     color: "text-[#c8973a] bg-white" },
  { key: "english",     icon: <Globe className="h-7 w-7" />,         color: "text-[#4db6ac] bg-white" },
  { key: "science",     icon: <FlaskConical className="h-7 w-7" />,  color: "text-[#c8973a] bg-white" },
  { key: "history",     icon: <BookOpen className="h-7 w-7" />,      color: "text-[#4db6ac] bg-white" },
  { key: "programming", icon: <Code2 className="h-7 w-7" />,         color: "text-[#c8973a] bg-white" },
  { key: "quran",       icon: <Star className="h-7 w-7" />,          color: "text-[#4db6ac] bg-white" },
  { key: "art",         icon: <Palette className="h-7 w-7" />,       color: "text-[#c8973a] bg-white" },
] as const;

export function SubjectGrid() {
  const t = useTranslations("subjects");

  return (
    <section className="relative py-20 bg-transparent overflow-hidden">
<div className="relative z-10 container mx-auto px-4">
        {/* Section header */}
        <div className="text-start mb-2">
          <h2 className="flex items-center justify-start gap-2 text-4xl font-bold text-[#2c1f12]">
            <span className="text-[#c8973a] text-xl">◁</span>
            {t("title")}
          </h2>
          <p className="text-[#78716c] mt-1.5 text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex justify-start mb-10">
          <Link href="/teachers" className="text-[#c8973a] text-sm font-medium hover:text-[#a67c2e] transition-colors">
            اكتشف المزيد ←
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {subjects.map((s) => (
            <Link
              key={s.key}
              href={`/teachers?subject=${s.key}`}
              className="group flex flex-col items-center gap-3 p-6 rounded-2xl border border-[#e5ddd4] bg-[#f8f5f0] hover:border-[#c8973a] hover:shadow-md hover:shadow-[#c8973a]/10 transition-all duration-200"
            >
              <div className={`p-3.5 rounded-xl ${s.color} shadow-sm border border-[#e5ddd4] group-hover:border-[#c8973a]/30`}>
                {s.icon}
              </div>
              <span className="font-semibold text-sm text-[#2c1f12] text-center group-hover:text-[#c8973a] transition-colors">
                {t(s.key)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
