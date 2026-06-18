import { useTranslations } from "next-intl";
import { UserPlus, Search, Video } from "lucide-react";

const steps = [
  { Icon: UserPlus, titleKey: "step1_title", descKey: "step1_desc", num: "01" },
  { Icon: Search,   titleKey: "step2_title", descKey: "step2_desc", num: "02" },
  { Icon: Video,    titleKey: "step3_title", descKey: "step3_desc", num: "03" },
] as const;

function StepCard({ Icon, title, desc }: { Icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="flex items-center gap-4 bg-[#ebe6de] rounded-full px-5 py-4 shadow-sm">
      {/* Text — naturally on the right in RTL flex */}
      <div className="flex-1 text-start">
        <p className="font-bold text-[#2c1f12] text-sm leading-snug">{title}</p>
        <p className="text-xs text-[#78716c] mt-1 leading-relaxed">{desc}</p>
      </div>
      {/* Teal icon — naturally on the left in RTL flex */}
      <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shrink-0 shadow-sm">
        <Icon className="h-6 w-6 text-[#4db6ac]" />
      </div>
    </div>
  );
}

export function HowItWorks() {
  const t = useTranslations("howItWorks");

  return (
    <section className="relative py-20 bg-[#f2ede8] overflow-hidden">
<div className="relative z-10 container mx-auto px-4 max-w-3xl">
        {/* Section header — Zad style */}
        <div className="text-start mb-2">
          <h2 className="flex items-center justify-start gap-2 text-2xl font-bold text-[#2c1f12]">
            <span className="text-[#c8973a] text-xl">◁</span>
            {t("title")}
          </h2>
          <p className="text-[#78716c] mt-1.5 text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex justify-start mb-8">
          <span className="text-[#c8973a] text-sm font-medium">اكتشف المزيد ←</span>
        </div>

        {/* Zigzag steps */}
        <div className="space-y-6">
          {steps.map((step, i) => {
            const isRight = i % 2 === 0;
            return (
              <div key={step.num} className="grid grid-cols-[1fr_4rem_1fr] items-center gap-4">
                {/* Left card slot */}
                <div className="flex justify-start">
                  {!isRight && (
                    <div className="w-full max-w-xs">
                      <StepCard Icon={step.Icon} title={t(step.titleKey)} desc={t(step.descKey)} />
                    </div>
                  )}
                </div>

                {/* Center number in dotted circle */}
                <div className="flex items-center justify-center">
                  <div className="w-14 h-14 rounded-full border-2 border-dashed border-[#c8973a]/60 flex items-center justify-center bg-[#f2ede8]">
                    <span className="text-xl font-bold text-[#c8973a]">{step.num}</span>
                  </div>
                </div>

                {/* Right card slot */}
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
      </div>
    </section>
  );
}
