import Image from "next/image";

export function HadithBanner() {
  return (
    <section className="w-full bg-[#f2ede8] py-10">
      <div className="container mx-auto px-4 flex flex-col items-center text-center">
        <p className="text-[#2c1f12] font-bold text-base mb-4 tracking-wide">
          قال النبيُّ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ:
        </p>
        <Image
          src="/hadith.png"
          alt="من يرد الله به خيراً يفقهه في الدين"
          width={900}
          height={164}
          className="w-full max-w-4xl h-auto object-contain mix-blend-multiply"
          unoptimized
        />
        <p className="text-[#2c1f12] font-bold text-base mt-4 tracking-wide">
          صَدَقَ رَسُولُ اللَّهِ صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ
        </p>
      </div>
    </section>
  );
}
