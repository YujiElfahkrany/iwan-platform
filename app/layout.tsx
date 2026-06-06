import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import { getLocale } from "next-intl/server";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Iwan Academy | Learn from the Best",
  description: "Book 1-on-1 sessions or join group classes with qualified teachers.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";
  return (
    <html lang={locale} dir={dir} className={`${cairo.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-cairo)] antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
