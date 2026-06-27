import Image from "next/image";

export function IslamicDivider() {
  return (
    <div className="w-full flex items-center justify-center py-2 overflow-hidden bg-transparent">
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#c8973a]/40 to-transparent" />
      <div className="flex items-center gap-3 mx-4 shrink-0">
        {[0, 1, 2].map((i) => (
          <Image
            key={i}
            src="/divider-clean.png"
            alt=""
            width={72}
            height={72}
            className="object-contain"
            unoptimized
            aria-hidden
          />
        ))}
      </div>
      <div className="flex-1 h-px bg-gradient-to-r from-transparent via-[#c8973a]/40 to-transparent" />
    </div>
  );
}
