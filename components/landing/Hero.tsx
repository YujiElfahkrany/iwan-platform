"use client";

import Image from "next/image";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen, Gift } from "lucide-react";

export function Hero() {
  const t = useTranslations("hero");
  const locale = useLocale();

  return (
    <section className="relative bg-[#f2ede8] overflow-hidden">
      <Image src="/banner-1.png" alt="" fill className="object-cover object-center -z-10" aria-hidden />
      {/* Gold top accent line */}
      <div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#c8973a] to-transparent" />

      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">

          {/* Visual side — laptop + book mockup */}
          <div className="flex justify-center order-2 md:order-1">
            <div className="relative">
              {/* Laptop screen */}
              <div className="w-72 h-48 bg-[#2c1f12] rounded-xl shadow-2xl overflow-hidden">
                <div className="absolute inset-1.5 bg-[#f8f5f0] rounded-lg overflow-hidden">
                  {/* Navbar mockup */}
                  <div className="h-7 bg-[#2c1f12] flex items-center px-3 gap-1">
                    <div className="w-2 h-2 rounded-full bg-[#c8973a]" />
                    <div className="flex-1" />
                    <div className="h-2 w-12 bg-white/20 rounded" />
                    <div className="h-2 w-8 bg-white/20 rounded ms-2" />
                  </div>
                  {/* Content mockup */}
                  <div className="p-3 space-y-2">
                    <div className="flex justify-end">
                      <div className="h-3 w-28 bg-[#c8973a]/30 rounded" />
                    </div>
                    <div className="h-2 bg-gray-200 rounded w-full" />
                    <div className="h-2 bg-gray-200 rounded w-4/5 ms-auto" />
                    <div className="flex gap-2 mt-2">
                      <div className="w-20 h-16 bg-[#c8973a]/15 rounded-lg border border-[#c8973a]/30 flex items-center justify-center">
                        <GraduationCap className="h-7 w-7 text-[#c8973a]/50" />
                      </div>
                      <div className="flex-1 space-y-1.5 pt-1">
                        <div className="h-2 bg-gray-200 rounded" />
                        <div className="h-2 bg-gray-200 rounded w-2/3" />
                        <div className="h-5 w-14 bg-[#c8973a] rounded mt-2" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {/* Keyboard base */}
              <div className="h-3 bg-[#3d2b18] rounded-b-lg mx-3" />
              <div className="h-1 w-full bg-[#2c1f12] rounded-b-xl" />

              {/* Decorative book */}
              <div className="absolute -bottom-8 end-0 w-18 h-24 shadow-xl" style={{ transform: "perspective(200px) rotateY(-15deg)" }}>
                <div className="w-16 h-full bg-gradient-to-b from-[#c8973a] to-[#8a6420] rounded-e-sm relative overflow-hidden">
                  <div className="absolute start-0 top-0 bottom-0 w-3 bg-[#2c1f12]" />
                  <div className="absolute inset-0 start-4 flex flex-col justify-center gap-1.5 pe-2">
                    <div className="h-px bg-white/25 rounded" />
                    <div className="h-px bg-white/25 rounded" />
                    <div className="h-px bg-white/25 rounded" />
                  </div>
                </div>
              </div>

              {/* Glow */}
              <div className="absolute -bottom-10 inset-x-4 h-6 bg-[#c8973a]/20 blur-xl rounded-full" />
              {/* Decorative circles */}
              <div className="absolute -top-6 -start-6 w-16 h-16 rounded-full border-2 border-dashed border-[#c8973a]/30" />
              <div className="absolute top-1/2 -end-8 w-8 h-8 rounded-full bg-[#c8973a]/15" />
            </div>
          </div>

          {/* Text content — right side (start in RTL) */}
          <div className="text-start order-1 md:order-2">
            {/* Free credit badge */}
            <div className="inline-flex items-center gap-2 bg-[#c8973a]/10 border border-[#c8973a]/30 rounded-full px-4 py-1.5 text-sm mb-5 text-[#8a6420] font-medium">
              <Gift className="h-3.5 w-3.5 shrink-0" />
              {t("free_credit_badge")}
            </div>

            <p className="text-[#78716c] font-semibold text-sm mb-1 tracking-wide">
              {locale === "ar" ? "أكاديمية إيوان" : "Iwan Academy"}
            </p>
            <h1 className="text-4xl md:text-5xl font-bold text-[#2c1f12] leading-tight mb-2">
              {t("title")}
            </h1>
            <h2 className="text-2xl md:text-3xl font-bold text-[#c8973a] leading-snug mb-5">
              {t("free_credit_text")}
            </h2>
            <p className="text-[#6b5c4c] leading-relaxed mb-8 text-base max-w-md">
              {t("subtitle")}
            </p>

            <div className="flex flex-wrap items-center gap-3">
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
    </section>
  );
}
