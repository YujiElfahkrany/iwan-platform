import { Link } from "@/i18n/navigation";
import Image from "next/image";

export function Footer() {
  return (
    <footer className="bg-[#f2ede8]/95 border-t border-[#c8973a]/40 text-[#2c1f12]/60">
      {/* Gold top border */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-[#c8973a] to-transparent" />

      <div className="container mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-6 text-sm">
        {/* Brand with logo */}
        <Link href="/" className="flex items-center gap-3 text-[#2c1f12] group">
          <Image
            src="/logo.png"
            alt="إيوان"
            width={44}
            height={44}
            className="shrink-0 opacity-90 group-hover:opacity-100 transition-opacity"
            unoptimized
          />
          <span className="font-bold text-base">أكاديمية إيوان</span>
        </Link>

        {/* Copyright */}
        <p className="text-center">
          © {new Date().getFullYear()} أكاديمية إيوان — جميع الحقوق محفوظة
        </p>

        {/* Links */}
        <div className="flex gap-6">
          <Link href="/auth/login" className="hover:text-[#c8973a] transition-colors">
            تسجيل الدخول
          </Link>
          <Link href="/auth/register" className="hover:text-[#c8973a] transition-colors">
            إنشاء حساب
          </Link>
        </div>
      </div>
    </footer>
  );
}
