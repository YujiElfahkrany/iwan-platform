import { Link } from "@/i18n/navigation";
import { BookOpen } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-[#2c1f12] text-white/60">
      {/* Gold top border */}
      <div className="h-0.5 bg-gradient-to-r from-transparent via-[#c8973a] to-transparent" />

      <div className="container mx-auto px-4 py-10 flex flex-col md:flex-row items-center justify-between gap-6 text-sm">
        {/* Brand */}
        <Link href="/" className="flex items-center gap-3 text-white group">
          <div className="w-10 h-10 rounded-full bg-[#3d2b18] border border-[#c8973a]/50 flex items-center justify-center group-hover:border-[#c8973a] transition-colors">
            <BookOpen className="h-4 w-4 text-[#c8973a]" />
          </div>
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
