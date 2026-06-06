"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function FAQSection() {
  const t = useTranslations("faq");
  const [open, setOpen] = useState<number | null>(null);

  const items = [
    { q: t("q1"), a: t("a1") },
    { q: t("q2"), a: t("a2") },
    { q: t("q3"), a: t("a3") },
    { q: t("q4"), a: t("a4") },
  ];

  return (
    <section className="py-20 bg-[#f2ede8]">
      <div className="container mx-auto px-4 max-w-3xl">
        {/* Section header */}
        <div className="text-end mb-10">
          <h2 className="flex items-center justify-end gap-2 text-2xl font-bold text-[#2c1f12]">
            <span className="text-[#c8973a] text-xl">◁</span>
            {t("title")}
          </h2>
        </div>

        <div className="space-y-3">
          {items.map((item, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl shadow-sm border border-[#e5ddd4] overflow-hidden"
            >
              <button
                className="w-full flex items-center justify-between px-6 py-4 text-end font-semibold text-[#2c1f12] hover:text-[#c8973a] hover:bg-[#faf8f5] transition-colors gap-4"
                onClick={() => setOpen(open === i ? null : i)}
              >
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 text-[#c8973a] transition-transform duration-200",
                    open === i && "rotate-180"
                  )}
                />
                <span className="flex-1 text-end">{item.q}</span>
              </button>
              {open === i && (
                <div className="px-6 pb-5 text-[#78716c] text-sm leading-relaxed text-end border-t border-[#f0ebe3] pt-3">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
