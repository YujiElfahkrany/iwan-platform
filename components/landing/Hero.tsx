"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { GraduationCap, BookOpen, BadgeCheck, CalendarDays, Layers } from "lucide-react";
import { useSession } from "next-auth/react";

export function Hero() {
  const t = useTranslations("hero");
  const { data: session } = useSession();
  const role = session?.user?.role;

  const studentHref = role ? `/dashboard/${role}` : "/auth/login?role=student";
  const teacherHref = role ? `/dashboard/${role}` : "/auth/login?role=teacher";

  return (
    <section className="relative bg-transparent overflow-hidden">
<div className="absolute top-0 inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-[#c8973a] to-transparent z-10" />

      <div className="relative z-10 container mx-auto px-4 py-16 md:py-24">
        {/* dir="ltr" keeps image LEFT and text RIGHT in both AR and EN */}
        <div className="grid md:grid-cols-[2fr_3fr] gap-4 items-center" dir="ltr">

          {/* Visual side — always left */}
          <div className="flex justify-center md:-my-16 md:-ms-8">
            <Image
              src="/hero-without-words.png"
              alt="إيوان"
              width={480}
              height={540}
              className="w-full h-auto object-contain"
              unoptimized
              priority
            />
          </div>

          {/* Text side — always right; dir="rtl" restores Arabic alignment inside the ltr grid */}
          <div className="text-start pt-6 md:pt-0" dir="rtl">
            <h1 className="text-3xl sm:text-5xl md:text-7xl font-bold text-[#2c1f12] leading-tight mb-5">
              {t("title")}
            </h1>
            <p className="text-[#6b5c4c] leading-relaxed mb-6 text-base sm:text-lg">
              {t("subtitle")}
            </p>

            {/* Feature highlights */}
            <div className="grid grid-cols-1 gap-3 mb-8">
              {([
                { icon: <BadgeCheck className="h-4 w-4 shrink-0 text-[#c8973a]" />, title: t("feat1_title"), desc: t("feat1_desc") },
                { icon: <CalendarDays className="h-4 w-4 shrink-0 text-[#c8973a]" />, title: t("feat2_title"), desc: t("feat2_desc") },
                { icon: <Layers className="h-4 w-4 shrink-0 text-[#c8973a]" />, title: t("feat3_title"), desc: t("feat3_desc") },
              ] as const).map((f, i) => (
                <div key={i} className="flex items-start gap-3 bg-white/50 border border-[#c8973a]/15 rounded-xl px-4 py-3">
                  <div className="mt-0.5">{f.icon}</div>
                  <div>
                    <p className="font-semibold text-sm text-[#2c1f12]">{f.title}</p>
                    <p className="text-xs text-[#6b5c4c] leading-relaxed mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* CTA buttons with illustrations */}
            <div className="grid grid-cols-2 gap-8 w-fit">
              {/* Images — route to dashboard if logged in, else login with role hint */}
              <Link href={studentHref} className="flex items-end justify-center h-60 group">
                <Image src="/student-login.png" alt="الطالب" width={180} height={240} className="object-contain group-hover:scale-105 transition-transform duration-200" unoptimized />
              </Link>
              <Link href={teacherHref} className="flex items-end justify-center h-60 group">
                <Image src="/teacher-login.png" alt="المعلم" width={180} height={240} className="object-contain translate-y-[20px] group-hover:scale-105 transition-transform duration-200" unoptimized />
              </Link>
              {/* Primary buttons */}
              <div className="flex flex-col items-center gap-1.5">
                <Button asChild size="lg" className="w-full bg-gradient-to-b from-[#d4a843] to-[#a67c2e] hover:from-[#c8973a] hover:to-[#96712a] text-white h-14 rounded-xl text-base font-bold shadow-md shadow-[#c8973a]/30 border-0">
                  <Link href={studentHref}>
                    <GraduationCap className="h-5 w-5 me-2" />
                    {t("cta_student")}
                  </Link>
                </Button>
                <Link href="/auth/register/student" className="text-xs text-[#8a6420] hover:underline">
                  {t("login_student")}
                </Link>
              </div>
              <div className="flex flex-col items-center gap-1.5">
                <Button asChild variant="outline" size="lg" className="w-full h-14 rounded-xl text-base border-[#c8973a] text-[#c8973a] hover:bg-[#c8973a]/8 hover:text-[#8a6420] font-semibold">
                  <Link href={teacherHref}>
                    <BookOpen className="h-5 w-5 me-2" />
                    {t("cta_teacher")}
                  </Link>
                </Button>
                <Link href="/auth/register/teacher" className="text-xs text-[#8a6420] hover:underline">
                  {t("login_teacher")}
                </Link>
              </div>
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
