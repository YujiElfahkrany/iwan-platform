"use client";

import { useLocale } from "next-intl";
import Image from "next/image";

export function WhatsAppButton() {
  const locale = useLocale();
  const isRtl = locale === "ar";

  const label = isRtl ? "تحتاج مساعدة؟" : "Need help?";
  const waUrl = "https://wa.me/819082272250";

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={`fixed bottom-6 z-50 flex flex-col items-center gap-1.5 group hover:scale-105 transition-all duration-200 ${
        isRtl ? "right-6" : "left-6"
      }`}
    >
      {/* Label above */}
      <span className="text-xs font-semibold text-[#2c1f12] bg-[#f2ede8]/95 border border-[#c8973a]/40 px-3 py-1.5 rounded-full shadow-md whitespace-nowrap">
        {label}
      </span>

      {/* Logo circle */}
      <div className="w-12 h-12 rounded-full bg-[#f2ede8] border-2 border-[#c8973a]/50 shadow-lg flex items-center justify-center shrink-0">
        <Image
          src="/logo.png"
          alt="Iwan"
          width={36}
          height={36}
          className="rounded-full"
          unoptimized
        />
      </div>
    </a>
  );
}
