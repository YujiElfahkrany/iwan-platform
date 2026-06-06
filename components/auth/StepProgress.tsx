"use client";

import { useTranslations } from "next-intl";

interface StepProgressProps {
  current: number;
  total: number;
  titles: string[];
}

export function StepProgress({ current, total, titles }: StepProgressProps) {
  const t = useTranslations("auth");
  return (
    <div className="mb-8">
      <p className="text-sm text-muted-foreground mb-3">
        {t("step", { current, total })}
      </p>
      <div className="flex gap-2">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex-1 flex flex-col gap-1">
            <div
              className={`h-1.5 rounded-full transition-colors ${
                i < current ? "bg-primary" : "bg-muted"
              }`}
            />
            <p className={`text-xs truncate ${i + 1 === current ? "text-primary font-medium" : "text-muted-foreground"}`}>
              {titles[i]}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
