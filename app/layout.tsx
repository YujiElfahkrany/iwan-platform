import type { Metadata } from "next";
import { Marhey } from "next/font/google";
import { getLocale } from "next-intl/server";
import "./globals.css";

const marhey = Marhey({
  subsets: ["arabic", "latin"],
  variable: "--font-marhey",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Iwan Academy | Learn from the Best",
  description: "Book 1-on-1 sessions or join group classes with qualified teachers.",
  icons: { icon: "/logo.png" },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const dir = locale === "ar" ? "rtl" : "ltr";
  return (
    <html lang={locale} dir={dir} className={`${marhey.variable} h-full`} suppressHydrationWarning>
      <body className="min-h-full flex flex-col font-[family-name:var(--font-marhey)] antialiased bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
