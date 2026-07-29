"use client";

import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import Image from "next/image";
import { supportWhatsAppUrl } from "@/lib/support";

export function WhatsAppButton() {
  const t = useTranslations("common");
  const { data: session } = useSession();

  if (!session?.user) return null;

  const label = t("need_help");
  const waUrl = supportWhatsAppUrl(session.user.gender);

  return (
    <a
      href={waUrl}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      // Sits at the inline end, so it stays on the opposite side from the
      // dashboard sidebar in both reading directions. z-30 keeps it under every
      // overlay surface (mobile menu drawer, sheets, dialogs are z-40/z-50) —
      // otherwise it paints over the drawer's bottom links on narrow screens.
      className="fixed bottom-6 end-6 z-30 flex flex-col items-center gap-1.5 group hover:scale-105 transition-all duration-200"
    >
      {/* Label above */}
      <span className="text-xs font-semibold text-[#2c1f12] bg-[#f2ede8]/95 border border-[#c8973a]/40 px-3 py-1.5 rounded-full shadow-md whitespace-nowrap">
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
