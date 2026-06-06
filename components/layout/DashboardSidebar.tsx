"use client";

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

export function DashboardSidebar({ role, userName }: DashboardSidebarProps) {
  const t = useTranslations("dashboard");
  const locale = useLocale();
  const pathname = usePathname();

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
    { href: `/dashboard/admin`, label: "Overview", icon: <ShieldCheck className="h-4 w-4" /> },
    { href: `/dashboard/admin/students`, label: "Students", icon: <GraduationCap className="h-4 w-4" /> },
    { href: `/dashboard/admin/teachers`, label: "Teachers", icon: <Users className="h-4 w-4" /> },
    { href: `/dashboard/admin/classes`, label: "Classes", icon: <BookOpen className="h-4 w-4" /> },
  ];

  const links = role === "admin" ? adminLinks : role === "teacher" ? teacherLinks : studentLinks;

  const roleLabel = role === "admin" ? "Administrator" : role === "teacher" ? "Teacher" : "Student";

  return (
    <aside className="w-64 min-h-screen bg-sidebar text-sidebar-foreground flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <p className="text-xs text-sidebar-foreground/60 mb-1">{roleLabel}</p>
        <p className="font-semibold truncate">{userName}</p>
      </div>
      <nav className="flex-1 p-4 space-y-1">
        {links.map((item) => {
          const active = pathname === item.href || (item.href !== `/dashboard/${role}` && pathname.startsWith(item.href + "/"));
          return (
            <Link
              key={item.href}
              href={item.href}
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
      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="ghost"
          className="w-full justify-start gap-3 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={() => signOut({ callbackUrl: `/${locale}` })}
        >
          <LogOut className="h-4 w-4" />
          {useTranslations("nav")("logout")}
        </Button>
      </div>
    </aside>
  );
}
