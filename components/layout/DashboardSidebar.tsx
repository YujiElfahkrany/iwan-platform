"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { signOut } from "next-auth/react";
import {
  LayoutDashboard,
  CalendarDays,
  BookOpen,
  Users,
  LogOut,
  Star,
  GraduationCap,
  ShieldCheck,
  Wallet,
  Menu,
  X,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

interface DashboardSidebarProps {
  role: "teacher" | "student" | "admin";
  userName: string;
}

function SidebarContent({
  links,
  userName,
  roleLabel,
  onLinkClick,
}: {
  links: NavItem[];
  userName: string;
  roleLabel: string;
  onLinkClick?: () => void;
}) {
  const pathname = usePathname();
  const locale = useLocale();
  const tNav = useTranslations("nav");
  const role = links[0]?.href.split("/")[2] as string;

  return (
    <>
      <div className="p-6 border-b border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/60 mb-1">{roleLabel}</p>
        <p className="font-semibold truncate">{userName}</p>
      </div>
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {links.map((item) => {
          const active =
            pathname === item.href ||
            (item.href !== `/dashboard/${role}` && pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onLinkClick}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground text-sidebar-foreground/80"
              )}
            >
              {item.icon}
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="p-4 border-t border-sidebar-border space-y-1">
        <Link
          href="/"
          onClick={onLinkClick}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors w-full"
        >
          <Home className="h-4 w-4" />
          {tNav("home")}
        </Link>
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={() => signOut({ callbackUrl: `/${locale}` })}
        >
          <LogOut className="h-4 w-4" />
          {tNav("logout")}
        </Button>
      </div>
    </>
  );
}

export function DashboardSidebar({ role, userName }: DashboardSidebarProps) {
  const t = useTranslations("dashboard");
  const [mobileOpen, setMobileOpen] = useState(false);

  const teacherLinks: NavItem[] = [
    { href: `/dashboard/teacher`, label: t("upcoming"), icon: <LayoutDashboard className="h-4 w-4" /> },
    { href: `/dashboard/teacher/availability`, label: t("availability"), icon: <CalendarDays className="h-4 w-4" /> },
    { href: `/dashboard/teacher/classes`, label: t("my_classes"), icon: <BookOpen className="h-4 w-4" /> },
    { href: `/dashboard/teacher/bookings`, label: t("my_bookings"), icon: <Star className="h-4 w-4" /> },
  ];

  const studentLinks: NavItem[] = [
    { href: `/dashboard/student`, label: t("upcoming"), icon: <LayoutDashboard className="h-4 w-4" /> },
    { href: `/dashboard/student/teachers`, label: t("browse_teachers"), icon: <Users className="h-4 w-4" /> },
    { href: `/dashboard/student/classes`, label: t("browse_classes"), icon: <GraduationCap className="h-4 w-4" /> },
    { href: `/dashboard/student/bookings`, label: t("my_bookings"), icon: <BookOpen className="h-4 w-4" /> },
  ];

  const adminLinks: NavItem[] = [
    { href: `/dashboard/admin`, label: t("admin_overview"), icon: <ShieldCheck className="h-4 w-4" /> },
    { href: `/dashboard/admin/students`, label: t("admin_students"), icon: <GraduationCap className="h-4 w-4" /> },
    { href: `/dashboard/admin/teachers`, label: t("admin_teachers"), icon: <Users className="h-4 w-4" /> },
    { href: `/dashboard/admin/classes`, label: t("admin_classes"), icon: <BookOpen className="h-4 w-4" /> },
    { href: `/dashboard/admin/topup`, label: t("admin_topup"), icon: <Wallet className="h-4 w-4" /> },
  ];

  const links = role === "admin" ? adminLinks : role === "teacher" ? teacherLinks : studentLinks;
  const tNav = useTranslations("nav");
  const roleLabel = role === "admin" ? tNav("role_admin") : role === "teacher" ? tNav("role_teacher") : tNav("role_student");

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 min-h-screen bg-[#2c1f12]/75 text-sidebar-foreground flex-col shrink-0">
        <SidebarContent links={links} userName={userName} roleLabel={roleLabel} />
      </aside>

      {/* Mobile hamburger button */}
      <button
        className="md:hidden fixed top-4 start-4 z-40 p-2 rounded-lg bg-[#2c1f12]/75 text-sidebar-foreground shadow-md"
        onClick={() => setMobileOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="md:hidden fixed inset-0 z-40 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="md:hidden fixed inset-y-0 start-0 z-50 w-72 bg-[#2c1f12]/75 text-sidebar-foreground flex flex-col shadow-2xl">
            <div className="absolute top-3 end-3">
              <button
                onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg hover:bg-sidebar-accent text-sidebar-foreground/60 hover:text-sidebar-foreground"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarContent
              links={links}
              userName={userName}
              roleLabel={roleLabel}
              onLinkClick={() => setMobileOpen(false)}
            />
          </aside>
        </>
      )}
    </>
  );
}
