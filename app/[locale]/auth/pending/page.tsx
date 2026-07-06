"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock } from "lucide-react";
import Image from "next/image";

export default function PendingApprovalPage() {
  const t = useTranslations("auth");

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-2xl text-center">
        <CardHeader className="pb-2">
          <div className="flex justify-center mb-2">
            <Image src="/logo.png" alt="Iwan Academy" width={72} height={72} unoptimized />
          </div>
          <div className="flex justify-center mb-2">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Clock className="h-6 w-6 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">{t("pending_title")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">{t("pending_message")}</p>
          <Button asChild>
            <Link href="/">{t("back_home")}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
