"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { signIn } from "next-auth/react";
import { useRouter, Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BookOpen, Loader2, ChevronLeft } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

export default function LoginPage() {
  const t = useTranslations("auth");
  const tNav = useTranslations("nav");
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const role = searchParams.get("role");
  const [loading, setLoading] = useState(false);

  const registerHref =
    role === "student" ? "/auth/register/student" :
    role === "teacher" ? "/auth/register/teacher" :
    "/auth/register";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const result = await signIn("credentials", {
      email: fd.get("email"),
      password: fd.get("password"),
      redirect: false,
    });
    setLoading(false);
    if (result?.error) {
      toast.error("Invalid email or password");
    } else {
      const res = await fetch("/api/auth/session");
      const session = await res.json();
      const userRole = session?.user?.role;
      if (userRole === "admin") {
        router.push("/dashboard/admin");
      } else if (userRole === "teacher") {
        router.push("/dashboard/teacher");
      } else {
        router.push("/dashboard/student");
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-2">
          <Link href="/" className="flex items-center gap-1 mb-1 w-fit text-[#2c1f12]/50 hover:text-[#c8973a] transition-colors text-xs">
            <ChevronLeft className={`h-3 w-3 ${locale === "ar" ? "rotate-180" : ""}`} />
            {tNav("home")}
          </Link>
          <div className="flex justify-center mb-2">
            <Image src="/logo.png" alt="Iwan Academy" width={72} height={72} unoptimized />
          </div>
          <CardTitle className="text-2xl">{locale === "ar" ? "أكاديمية إيوان" : "Iwan Academy"}</CardTitle>
          <CardDescription>{t("login")}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input id="email" name="email" type="text" required autoComplete="username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <Input id="password" name="password" type="password" required autoComplete="current-password" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
              {t("login")}
            </Button>
          </form>
          <p className="text-center text-sm text-muted-foreground mt-4">
            {t("no_account")}{" "}
            <Link href={registerHref} className="text-primary hover:underline font-medium">
              {t("register")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
