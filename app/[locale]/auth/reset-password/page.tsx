"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ChevronLeft, Check, X } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const t = useTranslations("auth");
  const tForm = useTranslations("student_form");
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const passwordRules = [
    { label: tForm("pw_min"), valid: password.length >= 8 },
    { label: tForm("pw_upper"), valid: /[A-Z]/.test(password) },
    { label: tForm("pw_number"), valid: /[0-9]/.test(password) },
  ];
  const passwordValid = passwordRules.every((r) => r.valid);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!passwordValid) return;
    if (password !== confirm) {
      toast.error(tForm("password_mismatch"));
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (res.ok) {
      toast.success(t("password_reset_success"));
      router.push("/auth/login");
    } else {
      const data = await res.json().catch(() => null);
      if (data?.error === "invalid_token") {
        toast.error(t("reset_link_invalid"));
      } else {
        toast.error(t("reset_failed"));
      }
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="text-center pb-2">
          <Link href="/auth/login" className="flex items-center gap-1 mb-1 w-fit text-[#2c1f12]/50 hover:text-[#c8973a] transition-colors text-xs">
            <ChevronLeft className={`h-3 w-3 ${locale === "ar" ? "rotate-180" : ""}`} />
            {t("login")}
          </Link>
          <div className="flex justify-center mb-2">
            <Image src="/logo.png" alt="Iwan Academy" width={72} height={72} unoptimized />
          </div>
          <CardTitle className="text-2xl">{t("reset_password_title")}</CardTitle>
          <CardDescription>{t("reset_password_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <p className="text-center text-sm text-muted-foreground py-4">{t("reset_link_invalid")}</p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">{t("new_password")}</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              {password.length > 0 && (
                <ul className="space-y-1 text-xs">
                  {passwordRules.map((rule) => (
                    <li key={rule.label} className={`flex items-center gap-1 ${rule.valid ? "text-green-600" : "text-muted-foreground"}`}>
                      {rule.valid ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                      {rule.label}
                    </li>
                  ))}
                </ul>
              )}
              <div className="space-y-2">
                <Label htmlFor="confirm">{t("confirm_new_password")}</Label>
                <Input
                  id="confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading || !passwordValid}>
                {loading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                {t("reset_password_title")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
