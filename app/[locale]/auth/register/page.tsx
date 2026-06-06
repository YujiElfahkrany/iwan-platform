import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { GraduationCap, BookOpen, ChevronRight } from "lucide-react";

function RoleCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-border bg-card hover:border-primary hover:shadow-lg transition-all duration-200"
    >
      <div className="p-4 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
        {icon}
      </div>
      <div className="text-center">
        <h3 className="text-xl font-bold mb-2">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
      <div className="flex items-center gap-1 text-primary text-sm font-medium">
        Get started <ChevronRight className="h-4 w-4" />
      </div>
    </Link>
  );
}

export default function RegisterRolePage() {
  const t = useTranslations("auth");
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0f172a] to-[#1e293b] px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">{t("choose_role")}</h1>
          <p className="text-white/60 text-sm">
            {t("have_account")}{" "}
            <Link href="/auth/login" className="text-[#0ea5e9] hover:underline">
              {t("login")}
            </Link>
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RoleCard
            href="/auth/register/student"
            icon={<GraduationCap className="h-10 w-10 text-primary" />}
            title={t("student")}
            description={t("student_desc")}
          />
          <RoleCard
            href="/auth/register/teacher"
            icon={<BookOpen className="h-10 w-10 text-primary" />}
            title={t("teacher")}
            description={t("teacher_desc")}
          />
        </div>
      </div>
    </div>
  );
}
