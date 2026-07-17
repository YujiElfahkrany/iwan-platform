"use client";

import { useLocale } from "next-intl";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { supportWhatsAppUrl } from "@/lib/support";

export function WhatsAppButton() {
  const locale = useLocale();
  const { data: session } = useSession();
  const isRtl = locale === "ar";

  if (!session?.user) return null;

  const label = isRtl ? "تحتاج مساعدة؟" : "Need help?";
  const waUrl = supportWhatsAppUrl(session.user.gender);

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={`fixed bottom-6 z-50 flex flex-col items-center gap-1.5 group hover:scale-105 transition-all duration-200 ${
        isRtl ? "left-6" : "right-6"
      }`}
    >
      {/* Label above */}
      <span dir={isRtl ? "rtl" : "ltr"} className="text-xs font-semibold text-[#2c1f12] bg-[#f2ede8]/95 border border-[#c8973a]/40 px-3 py-1.5 rounded-full shadow-md whitespace-nowrap">
        {label}
      </span>

      {/* Logo circle */}
      <div className="w-16 h-16 rounded-full bg-[#f2ede8] border-2 border-[#c8973a]/50 shadow-lg flex items-center justify-center shrink-0">
        <Image
          src="/logo.png"
          alt="Iwan"
          width={48}
          height={48}
          className="rounded-full"
          unoptimized
        />
      </div>
    </a>
  );
}
