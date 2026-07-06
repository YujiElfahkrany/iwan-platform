"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Loader2, Camera } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TagInput } from "@/components/auth/TagInput";
import { resizeImageToBase64 } from "@/lib/image";
import { LANGUAGES } from "@/lib/constants";

interface TeacherSettingsInitial {
  name: string;
  avatar: string;
  bio: string;
  subjects: string[];
  experienceYears: number;
  qualifications: string[];
  certifications: string[];
  languages: string[];
  hourlyRate: number;
}

export function TeacherSettingsForm({ initial }: { initial: TeacherSettingsInitial }) {
  const t = useTranslations("settings");
  const { update } = useSession();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState(initial);

  function set<K extends keyof TeacherSettingsInitial>(key: K, value: TeacherSettingsInitial[K]) {
    setData((d) => ({ ...d, [key]: value }));
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(t("photo_too_large"));
      return;
    }
    try {
      const resized = await resizeImageToBase64(file);
      set("avatar", resized);
    } catch {
      toast.error(t("photo_too_large"));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error();
      await update({ name: data.name, image: data.avatar });
      toast.success(t("saved"));
    } catch {
      toast.error(t("save_failed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Card>
        <CardHeader><CardTitle>{t("title")}</CardTitle></CardHeader>
        <CardContent className="space-y-5">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="relative group"
              onClick={() => fileInputRef.current?.click()}
            >
              <Avatar className="h-20 w-20 ring-4 ring-primary/20">
                <AvatarImage src={data.avatar} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {data.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </span>
            </button>
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                {t("change_photo")}
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
            </div>
          </div>

          <div className="space-y-1">
            <Label>{t("name")}</Label>
            <Input required value={data.name} onChange={(e) => set("name", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>{t("bio")}</Label>
            <Textarea rows={4} value={data.bio} onChange={(e) => set("bio", e.target.value)} />
          </div>

          <div className="space-y-1">
            <Label>{t("subjects")}</Label>
            <TagInput value={data.subjects} onChange={(v) => set("subjects", v)} placeholder={t("tag_placeholder")} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>{t("experience_years")}</Label>
              <Input
                type="number"
                min={0}
                value={data.experienceYears}
                onChange={(e) => set("experienceYears", parseInt(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1">
              <Label>{t("hourly_rate")}</Label>
              <Input
                type="number"
                min={0}
                value={data.hourlyRate}
                onChange={(e) => set("hourlyRate", parseFloat(e.target.value) || 0)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label>{t("qualifications")}</Label>
            <TagInput value={data.qualifications} onChange={(v) => set("qualifications", v)} placeholder={t("tag_placeholder")} />
          </div>

          <div className="space-y-1">
            <Label>{t("certifications")}</Label>
            <TagInput value={data.certifications} onChange={(v) => set("certifications", v)} placeholder={t("tag_placeholder")} />
          </div>

          <div className="space-y-2">
            <Label>{t("languages")}</Label>
            <div className="flex flex-wrap gap-2">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() =>
                    set("languages", data.languages.includes(lang)
                      ? data.languages.filter((l) => l !== lang)
                      : [...data.languages, lang])
                  }
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    data.languages.includes(lang)
                      ? "bg-primary text-white border-primary"
                      : "border-border hover:border-primary"
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin me-2" />}{t("save")}
      </Button>
    </form>
  );
}
