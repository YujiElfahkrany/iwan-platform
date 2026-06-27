"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { BookOpen, Sparkles, Scale, Heart, Star, ScrollText, Languages, BookMarked, X } from "lucide-react";

const subjects = [
  { key: "quran",   icon: Star,        color: "text-[#c8973a]" },
  { key: "tajweed", icon: Sparkles,    color: "text-[#4db6ac]" },
  { key: "fiqh",    icon: Scale,       color: "text-[#c8973a]" },
  { key: "aqeedah", icon: Heart,       color: "text-[#4db6ac]" },
  { key: "seerah",  icon: BookOpen,    color: "text-[#c8973a]" },
  { key: "hadith",  icon: ScrollText,  color: "text-[#4db6ac]" },
  { key: "arabic",  icon: Languages,   color: "text-[#c8973a]" },
  { key: "tafseer", icon: BookMarked,  color: "text-[#4db6ac]" },
] as const;

export function SubjectGrid() {
  const t = useTranslations("subjects");
  const [selected, setSelected] = useState<string | null>(null);

  const selectedSubject = subjects.find((s) => s.key === selected);

  return (
    <section className="relative py-20 bg-transparent overflow-hidden">
      <div className="relative z-10 container mx-auto px-4">
        <div className="text-start mb-2">
          <h2 className="flex items-center justify-start gap-2 text-4xl font-bold text-[#2c1f12]">
            <span className="text-[#c8973a] text-xl">◁</span>
            {t("title")}
          </h2>
          <p className="text-[#78716c] mt-1.5 text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex justify-start mb-10">
          <Link href="/teachers" className="text-[#c8973a] text-sm font-medium hover:text-[#a67c2e] transition-colors">
            {t("browse_btn")}
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {subjects.map((s) => {
            const Icon = s.icon;
            const isActive = selected === s.key;
            return (
              <button
                key={s.key}
                onClick={() => setSelected(isActive ? null : s.key)}
                className={`group flex flex-col items-center gap-3 p-6 rounded-2xl border transition-all duration-200 text-start ${
                  isActive
                    ? "border-[#c8973a] bg-[#c8973a]/5 shadow-md shadow-[#c8973a]/10"
                    : "border-[#e5ddd4] bg-[#f8f5f0] hover:border-[#c8973a] hover:shadow-md hover:shadow-[#c8973a]/10"
                }`}
              >
                <div className={`p-3.5 rounded-xl bg-white shadow-sm border ${isActive ? "border-[#c8973a]/30" : "border-[#e5ddd4] group-hover:border-[#c8973a]/30"}`}>
                  <Icon className={`h-7 w-7 ${s.color}`} />
                </div>
                <span className={`font-semibold text-sm text-center transition-colors ${isActive ? "text-[#c8973a]" : "text-[#2c1f12] group-hover:text-[#c8973a]"}`}>
                  {t(s.key)}
                </span>
              </button>
            );
          })}
        </div>

        {/* Inline description panel */}
        <div
          style={{
            maxHeight: selected ? "220px" : "0px",
            opacity: selected ? 1 : 0,
            marginTop: selected ? "1.5rem" : "0",
            overflow: "hidden",
            transition: "max-height 0.35s ease-in-out, opacity 0.25s ease-in-out, margin-top 0.25s ease-in-out",
          }}
        >
          {selectedSubject && (
            <div className="relative rounded-2xl border border-[#c8973a]/30 bg-[#c8973a]/5 p-6">
              <button
                onClick={() => setSelected(null)}
                className="absolute top-4 end-4 text-[#78716c] hover:text-[#2c1f12] transition-colors"
                aria-label="close"
              >
                <X className="h-4 w-4" />
              </button>
              <div className="flex items-start gap-4">
                <div className="p-3 rounded-xl bg-white border border-[#c8973a]/30 shadow-sm shrink-0">
                  <selectedSubject.icon className={`h-6 w-6 ${selectedSubject.color}`} />
                </div>
                <div>
                  <h3 className="font-bold text-[#2c1f12] text-lg mb-1">{t(selectedSubject.key)}</h3>
                  <p className="text-[#78716c] text-sm leading-relaxed">{t(`${selectedSubject.key}_desc`)}</p>
                  <Link
                    href={`/teachers?subject=${selectedSubject.key}`}
                    className="inline-flex items-center mt-3 text-sm font-semibold text-[#c8973a] hover:text-[#a67c2e] transition-colors"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {t("browse_btn")}
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
