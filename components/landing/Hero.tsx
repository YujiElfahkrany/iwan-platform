"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen, Gift } from "lucide-react";

export function Hero() {
  const t = useTranslations("hero");

  return (
    <section className="relative bg-[#f2ede8] overflow-hidden">
<div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#c8973a] to-transparent z-10" />

      <div className="relative z-10 container mx-auto px-4 py-16 md:py-24">
        {/* dir="ltr" keeps image LEFT and text RIGHT in both AR and EN */}
        <div className="grid md:grid-cols-[2fr_3fr] gap-10 items-center" dir="ltr">

          {/* Visual side — always left */}
          <div className="flex justify-center">
            <Image
              src="/hero-without-words.png"
              alt="إيوان"
              width={560}
              height={624}
              className="w-full h-auto object-contain drop-shadow-xl"
              unoptimized
              priority
            />
          </div>

          {/* Text side — always right; dir="rtl" restores Arabic alignment inside the ltr grid */}
          <div className="text-start" dir="rtl">
            <div className="inline-flex items-center gap-2 bg-[#c8973a]/10 border border-[#c8973a]/30 rounded-full px-4 py-1.5 text-sm mb-5 text-[#8a6420] font-medium">
              <Gift className="h-3.5 w-3.5 shrink-0" />
              {t("free_credit_badge")}
            </div>

            <h1 className="text-6xl md:text-7xl font-bold text-[#2c1f12] leading-tight mb-5">
              {t("title")}
            </h1>
            <p className="text-[#6b5c4c] leading-relaxed mb-3 text-xl">
              {t("free_credit_text")}
            </p>
            <p className="text-[#6b5c4c] leading-relaxed mb-8 text-lg">
              {t("subtitle")}
            </p>

            {/* CTA buttons with illustrations */}
            <div className="flex flex-wrap items-end gap-5">
              <div className="flex flex-col items-center gap-2">
                <Image
                  src="/student-login.png"
                  alt="الطالب"
                  width={80}
                  height={106}
                  className="object-contain"
                  unoptimized
                />
                <Button
                  asChild
                  size="lg"
                  className="bg-gradient-to-b from-[#d4a843] to-[#a67c2e] hover:from-[#c8973a] hover:to-[#96712a] text-white h-11 px-8 rounded-lg font-bold shadow-md shadow-[#c8973a]/30 border-0"
                >
                  <Link href="/auth/register/student">
                    <GraduationCap className="h-4 w-4 me-2" />
                    {t("cta_student")}
                  </Link>
                </Button>
              </div>
              <div className="flex flex-col items-center gap-2">
                <Image
                  src="/teacher-login.png"
                  alt="المعلم"
                  width={80}
                  height={106}
                  className="object-contain"
                  unoptimized
                />
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-11 px-7 rounded-lg border-[#c8973a] text-[#c8973a] hover:bg-[#c8973a]/8 hover:text-[#8a6420] font-semibold"
                >
                  <Link href="/auth/register/teacher">
                    <BookOpen className="h-4 w-4 me-2" />
                    {t("cta_teacher")}
                  </Link>
                </Button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
