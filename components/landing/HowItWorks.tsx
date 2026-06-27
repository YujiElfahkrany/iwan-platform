"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { UserPlus, Search, Video, ChevronDown, ChevronUp, CheckCircle } from "lucide-react";

const steps = [
  { Icon: UserPlus, titleKey: "step1_title", descKey: "step1_desc", num: "01", details: ["step1_detail1", "step1_detail2", "step1_detail3"] },
  { Icon: Search,   titleKey: "step2_title", descKey: "step2_desc", num: "02", details: ["step2_detail1", "step2_detail2", "step2_detail3"] },
  { Icon: Video,    titleKey: "step3_title", descKey: "step3_desc", num: "03", details: ["step3_detail1", "step3_detail2", "step3_detail3"] },
] as const;

function StepCard({ Icon, title, desc }: { Icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-4 bg-[#c8a97a]/30 rounded-full px-5 py-4 shadow-sm border border-[#c8973a]/20">
      <div className="flex-1 text-start">
        <p className="font-bold text-[#2c1f12] text-sm leading-snug">{title}</p>
        <p className="text-xs text-[#78716c] mt-1 leading-relaxed">{desc}</p>
      </div>
      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
        <Icon className="h-6 w-6 text-[#4db6ac]" />
      </div>
    </div>
  );
}

export function HowItWorks() {
  const t = useTranslations("howItWorks");
  const [open, setOpen] = useState(false);

  return (
    <section className="relative py-20 bg-transparent overflow-hidden">
      <div className="relative z-10 container mx-auto px-4 max-w-3xl">

        {/* Section header */}
        <div className="text-start mb-2">
          <h2 className="flex items-center justify-start gap-2 text-2xl font-bold text-[#2c1f12]">
            <span className="text-[#c8973a] text-xl">◁</span>
            {t("title")}
          </h2>
          <p className="text-[#78716c] mt-1.5 text-sm">{t("subtitle")}</p>
        </div>

        {/* Mobile: simple vertical list */}
        <div className="flex flex-col gap-4 md:hidden mt-8">
          {steps.map((step) => (
            <StepCard key={step.num} Icon={step.Icon} title={t(step.titleKey)} desc={t(step.descKey)} />
          ))}
        </div>

        {/* Desktop: zigzag */}
        <div className="hidden md:block space-y-6 mt-8">
          {steps.map((step, i) => {
            const isRight = i % 2 === 0;
            return (
              <div key={step.num} className="grid grid-cols-[1fr_4rem_1fr] items-center gap-4">
                <div className="flex justify-start">
                  {!isRight && (
                    <div className="w-full max-w-xs">
                      <StepCard Icon={step.Icon} title={t(step.titleKey)} desc={t(step.descKey)} />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full border-2 border-dashed border-[#c8973a]/60 flex items-center justify-center bg-[#f2ede8]">
                    <span className="text-xl font-bold text-[#c8973a]">{step.num}</span>
                  </div>
                </div>
                <div className="flex justify-start">
                  {isRight && (
                    <div className="w-full max-w-xs">
                      <StepCard Icon={step.Icon} title={t(step.titleKey)} desc={t(step.descKey)} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Discover more button — sits right above the expanding panel */}
        <div className="flex justify-start mt-6">
          <button
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1.5 text-[#c8973a] text-sm font-medium hover:text-[#a67c2e] transition-colors"
          >
            {open ? t("show_less") : t("discover_more")}
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>

        {/* Expandable details panel — inline styles avoid Tailwind purge */}
        <div
          style={{
            maxHeight: open ? "600px" : "0px",
            opacity: open ? 1 : 0,
            marginTop: open ? "1rem" : "0",
            overflow: "hidden",
            transition: "max-height 0.4s ease-in-out, opacity 0.3s ease-in-out, margin-top 0.3s ease-in-out",
          }}
        >
          <div className="rounded-2xl border border-[#c8973a]/25 bg-[#faf7f2] divide-y divide-[#c8973a]/15 shadow-sm">
            {steps.map((step) => (
              <div key={step.num} className="flex gap-4 px-5 py-5">
                <div className="w-10 h-10 rounded-xl bg-[#c8973a]/15 flex items-center justify-center shrink-0 mt-0.5">
                  <step.Icon className="h-5 w-5 text-[#c8973a]" />
                </div>
                <div className="flex-1 text-start">
                  <p className="font-bold text-[#2c1f12] text-sm mb-2">{t(step.titleKey)}</p>
                  <ul className="space-y-1.5">
                    {step.details.map((key) => (
                      <li key={key} className="flex items-start gap-2 text-xs text-[#6b5c4c] leading-relaxed">
                        <CheckCircle className="h-3.5 w-3.5 text-[#4db6ac] shrink-0 mt-0.5" />
                        {t(key)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </section>
  );
}
