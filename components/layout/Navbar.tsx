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
import { BookOpen, Menu, GraduationCap, Users } from "lucide-react";
import { useState } from "react";
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
      {/* Top dark bar — quick portal access */}
      <div className="h-9 bg-[#2c1f12] text-white/80 text-xs flex items-center">
        <div className="w-full max-w-screen-xl mx-auto px-4 flex items-center justify-between gap-4">
          {/* Left side (RTL: appears on LEFT = end) */}
          <button
            onClick={switchLocale}
            className="flex items-center gap-1.5 hover:text-white transition-colors text-xs shrink-0"
          >
            <span className="w-4 h-4 rounded-full border border-white/40 flex items-center justify-center text-[10px]">
              {locale === "ar" ? "E" : "ع"}
            </span>
            {locale === "ar" ? "English" : "عربي"}
          </button>

          {/* Right side (RTL: appears on RIGHT = start) */}
          <div className="flex items-center gap-4">
            {session?.user ? (
              <Link
                href={`/dashboard/${session.user.role}`}
                className="flex items-center gap-1.5 hover:text-white transition-colors"
              >
                <GraduationCap className="h-3.5 w-3.5 text-[#c8973a]" />
                {t("dashboard")}
              </Link>
            ) : (
              <>
                <Link
                  href="/auth/register/student"
                  className="flex items-center gap-1.5 hover:text-white transition-colors border-e border-white/20 pe-4"
                >
                  <GraduationCap className="h-3.5 w-3.5 text-[#c8973a]" />
                  {locale === "ar" ? "بوابة الطلاب" : "Student Portal"}
                </Link>
                <Link
                  href="/auth/register/teacher"
                  className="flex items-center gap-1.5 hover:text-white transition-colors"
                >
                  <Users className="h-3.5 w-3.5 text-[#c8973a]" />
                  {locale === "ar" ? "بوابة المعلمين" : "Teacher Portal"}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Main white navbar */}
      <nav className="h-16 bg-white border-b border-[#e5ddd4] shadow-sm flex items-center">
        <div className="w-full max-w-screen-xl mx-auto flex items-center justify-between px-4">

          {/* Left side (RTL): desktop nav links */}
          <div className="hidden md:flex items-center gap-7 text-sm font-medium">
            {navLinks.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="text-[#2c1f12]/70 hover:text-[#c8973a] transition-colors"
              >
                {l.label}
              </Link>
            ))}
          </div>

          {/* Right side (RTL): Logo */}
          <Link href="/" className="flex items-center gap-3">
            <span className="text-[#2c1f12] font-bold text-xl leading-tight">
              {locale === "ar" ? "أكاديمية إيوان" : "Iwan Academy"}
            </span>
            <div className="w-11 h-11 rounded-full bg-[#2c1f12] border-2 border-[#c8973a] flex items-center justify-center shrink-0">
              <BookOpen className="h-5 w-5 text-[#c8973a]" />
            </div>
          </Link>

          {/* Mobile menu */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="md:hidden p-2 rounded-lg text-[#2c1f12] hover:bg-[#f2ede8] transition-colors">
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side={locale === "ar" ? "right" : "left"} className="bg-white border-[#e5ddd4]">
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
                <hr className="border-[#e5ddd4]" />
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
                    <Link href="/auth/login" className="text-lg font-medium text-[#2c1f12]/70 hover:text-[#c8973a]" onClick={() => setOpen(false)}>
                      {t("login")}
                    </Link>
                    <Link href="/auth/register" className="text-lg font-semibold text-[#c8973a]" onClick={() => setOpen(false)}>
                      {t("register")}
                    </Link>
                  </>
                )}
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
        </div>
      </nav>
    </header>
  );
}
