"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, ChevronLeft, MailCheck } from "lucide-react";
import Image from "next/image";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const t = useTranslations("auth");
  const locale = useLocale();
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: fd.get("email"), locale }),
    });
    setLoading(false);
    if (res.ok) {
      setSent(true);
    } else {
      toast.error(t("reset_email_failed"));
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
          <CardTitle className="text-2xl">{t("forgot_password_title")}</CardTitle>
          <CardDescription>{t("forgot_password_desc")}</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="text-center space-y-3 py-4">
              <MailCheck className="h-10 w-10 mx-auto text-primary" />
              <p className="text-sm text-muted-foreground">{t("reset_email_sent")}</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input id="email" name="email" type="email" required autoComplete="username" />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                {t("send_reset_link")}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
