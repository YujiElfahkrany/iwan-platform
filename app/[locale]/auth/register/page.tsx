import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { GraduationCap, BookOpen } from "lucide-react";
import Image from "next/image";

function RoleCard({
  href,
  image,
  title,
  description,
}: {
  href: string;
  image: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="group flex flex-col items-center gap-4 p-8 rounded-2xl border-2 border-[#e5ddd4] bg-white hover:border-[#c8973a] hover:shadow-lg hover:shadow-[#c8973a]/10 transition-all duration-200"
    >
      <div className="h-32 flex items-end justify-center">
        <Image
          src={image}
          alt={title}
          width={90}
          height={120}
          className="object-contain group-hover:scale-105 transition-transform duration-200"
          unoptimized
        />
      </div>
      <div className="text-center">
        <h3 className="text-xl font-bold text-[#2c1f12] mb-2">{title}</h3>
        <p className="text-[#78716c] text-sm leading-relaxed">{description}</p>
      </div>
      <span className="text-sm font-semibold text-[#c8973a] group-hover:underline">
        إنشاء حساب →
      </span>
    </Link>
  );
}

export default function RegisterRolePage() {
  const t = useTranslations("auth");
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-[#2c1f12] mb-2">{t("choose_role")}</h1>
          <p className="text-[#78716c] text-sm">
            {t("have_account")}{" "}
            <Link href="/auth/login" className="text-[#c8973a] hover:underline font-medium">
              {t("login")}
            </Link>
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <RoleCard
            href="/auth/register/student"
            image="/student-login.png"
            title={t("student")}
            description={t("student_desc")}
          />
          <RoleCard
            href="/auth/register/teacher"
            image="/teacher-login.png"
            title={t("teacher")}
            description={t("teacher_desc")}
          />
        </div>
      </div>
    </div>
  );
}
