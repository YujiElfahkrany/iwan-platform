"use client";

import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { useSession, signOut } from "next-auth/react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Menu, GraduationCap } from "lucide-react";
import { useState } from "react";
import Image from "next/image";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

export function Navbar() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);

  function switchLocale() {
    router.push(pathname, { locale: locale === "en" ? "ar" : "en" });
  }

  const navLinks = [
    { href: "/", label: t("home") },
    { href: "/teachers", label: t("teachers") },
    { href: "/classes", label: t("classes") },
  ];

  return (
    <header className="sticky top-0 z-50 w-full">
      <nav className="h-20 bg-[#f2ede8] border-b border-[#c8973a]/40 shadow-sm flex items-center">
        {/* dir="ltr" pins visual order: portals LEFT, logo RIGHT in both AR and EN */}
        <div className="w-full px-6 flex items-center justify-between gap-4" dir="ltr">

          {/* LEFT: portal links + language switch */}
          <div className="flex items-center gap-4 text-sm">
            {session?.user ? (
              <Link
                href={`/dashboard/${session.user.role}`}
                className="flex items-center gap-1.5 text-[#2c1f12]/70 hover:text-[#c8973a] transition-colors font-medium"
              >
                <GraduationCap className="h-4 w-4 text-[#c8973a]" />
                {t("dashboard")}
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/register/student"
                  className="hidden sm:flex items-center gap-2 text-[#2c1f12]/70 hover:text-[#c8973a] transition-colors font-medium border-r border-[#c8973a]/30 pr-4"
                >
                  <Image src="/student-login.png" alt="الطالب" width={34} height={44} className="object-contain" unoptimized />
                  {locale === "ar" ? "بوابة الطلاب" : "Student Portal"}
                </Link>
                <Link
                  href="/auth/register/teacher"
                  className="hidden sm:flex items-center gap-2 text-[#2c1f12]/70 hover:text-[#c8973a] transition-colors font-medium border-r border-[#c8973a]/30 pr-4"
                >
                  <Image src="/teacher-login.png" alt="المعلم" width={34} height={44} className="object-contain" unoptimized />
                  {locale === "ar" ? "بوابة المعلمين" : "Teacher Portal"}
                </Link>
              </>
            )}
            <button
              onClick={switchLocale}
              className="flex items-center gap-1.5 text-[#2c1f12]/60 hover:text-[#c8973a] transition-colors text-xs"
            >
              <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[10px]">
                {locale === "ar" ? "E" : "ع"}
              </span>
              {locale === "ar" ? "En" : "عر"}
            </button>
          </div>

          {/* CENTER: desktop nav links */}
          <div className="hidden md:flex items-center gap-1 text-sm font-medium">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="px-3 py-1.5 text-[#2c1f12]/70 hover:text-[#c8973a] transition-colors rounded-md hover:bg-[#c8973a]/10"
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* RIGHT: logo + user avatar */}
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <Sheet open={open} onOpenChange={setOpen}>
              <SheetTrigger className="md:hidden p-2 rounded-lg text-[#2c1f12] hover:bg-[#c8973a]/10 transition-colors">
                <Menu className="h-5 w-5" />
              </SheetTrigger>
              <SheetContent side={locale === "ar" ? "right" : "left"} className="bg-[#f2ede8] border-[#e5ddd4]">
                <div className="flex flex-col gap-5 mt-8">
                  {navLinks.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      className="text-lg font-medium text-[#2c1f12] hover:text-[#c8973a]"
                      onClick={() => setOpen(false)}
                    >
                      {l.label}
                    </Link>
                  ))}
                  <hr className="border-[#c8973a]/20" />
                  {session?.user ? (
                    <>
                      <Link href={`/dashboard/${session.user.role}`} className="text-lg font-medium text-[#c8973a]" onClick={() => setOpen(false)}>
                        {t("dashboard")}
                      </Link>
                      <button onClick={() => signOut({ callbackUrl: `/${locale}` })} className="text-start text-lg font-medium text-red-500">
                        {t("logout")}
                      </button>
                    </>
                  ) : (
                    <>
                      <Link href="/auth/register/student" className="flex items-center gap-2 text-lg font-medium text-[#2c1f12]/70 hover:text-[#c8973a]" onClick={() => setOpen(false)}>
                        <Image src="/student-login.png" alt="" width={24} height={30} className="object-contain" unoptimized />
                        {locale === "ar" ? "بوابة الطلاب" : "Student Portal"}
                      </Link>
                      <Link href="/auth/register/teacher" className="flex items-center gap-2 text-lg font-medium text-[#2c1f12]/70 hover:text-[#c8973a]" onClick={() => setOpen(false)}>
                        <Image src="/teacher-login.png" alt="" width={24} height={30} className="object-contain" unoptimized />
                        {locale === "ar" ? "بوابة المعلمين" : "Teacher Portal"}
                      </Link>
                    </>
                  )}
                  <button onClick={switchLocale} className="text-start text-sm text-[#2c1f12]/60 hover:text-[#c8973a]">
                    {locale === "ar" ? "English" : "عربي"}
                  </button>
                </div>
              </SheetContent>
            </Sheet>

            {/* Desktop user avatar */}
            {session?.user && (
              <div className="hidden md:block">
                <DropdownMenu>
                  <DropdownMenuTrigger className="relative h-8 w-8 rounded-full cursor-pointer outline-none">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={session.user.image ?? ""} />
                      <AvatarFallback className="bg-[#c8973a] text-white text-xs">
                        {session.user.name?.charAt(0).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align={locale === "ar" ? "start" : "end"}>
                    <DropdownMenuItem>
                      <Link href={`/dashboard/${session.user.role}`} className="w-full">{t("dashboard")}</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => signOut({ callbackUrl: `/${locale}` })} className="text-destructive">
                      {t("logout")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}

            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <span className="text-[#2c1f12] font-bold text-base leading-tight hidden sm:inline">
                {locale === "ar" ? "أكاديمية إيوان" : "Iwan Academy"}
              </span>
              <Image
                src="/logo.png"
                alt="إيوان"
                width={52}
                height={52}
                className="shrink-0"
                unoptimized
              />
            </Link>
          </div>

        </div>
      </nav>
    </header>
  );
}
