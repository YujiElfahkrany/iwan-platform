import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { SessionProvider } from "@/components/session-provider";
import { Toaster } from "@/components/ui/sonner";
import { WhatsAppButton } from "@/components/layout/WhatsAppButton";

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!(routing.locales as readonly string[]).includes(locale)) notFound();

  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <NextIntlClientProvider messages={messages}>
      <SessionProvider>
        {children}
        <WhatsAppButton />
        <Toaster richColors position={dir === "rtl" ? "top-left" : "top-right"} />
      </SessionProvider>
    </NextIntlClientProvider>
  );
}
