"use client";

import { useState, useRef, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter, Link } from "@/i18n/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StepProgress } from "@/components/auth/StepProgress";
import { Loader2, ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import PhoneInput from "react-phone-number-input";
import arLabels from "react-phone-number-input/locale/ar.json";
import "react-phone-number-input/style.css";
import type { E164Number } from "libphonenumber-js/core";

const TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Dubai", "Asia/Riyadh", "Asia/Cairo", "Asia/Karachi"];
const LANGUAGES = ["English", "Arabic", "French", "Spanish", "Urdu"];

const SKIN_TONE_BASES_MALE = ["man-kufi", "man-keffiyeh", "man-keffiyeh-blonde", "man-casual", "man-thobe", "man-keffiyeh-grey", "man-keffiyeh-gold", "man-thobe-white"];
const SKIN_TONE_BASES_FEMALE = ["woman-hijab-blue", "woman-hijab-red", "woman-hijab-green", "woman-hijab-yellow", "woman-niqab-grey", "woman-niqab-blue"];

const AVATARS: { name: string; url: string; gender: "male" | "female" }[] = [
  ...["man-kufi", "man-keffiyeh", "man-keffiyeh-blonde", "man-casual",
      "man-thobe", "man-keffiyeh-grey", "man-keffiyeh-gold", "man-thobe-white",
      "man-beard-dark", "man-apron", "man-kufi-chef", "man-glasses-elder", "man-beret",
  ].map((name) => ({ name, url: `/avatars/${name}.png`, gender: "male" as const })),
  ...SKIN_TONE_BASES_MALE.flatMap((name) =>
    (["light", "medium", "dark"] as const).map((tone) => ({
      name: `${name}-${tone}`, url: `/avatars/${name}-${tone}.png`, gender: "male" as const,
    }))
  ),
  ...["woman-hijab-blue", "woman-hijab-dark", "woman-hijab-red", "woman-hijab-green",
      "woman-hijab-yellow", "woman-hijab-white", "woman-niqab-grey", "woman-niqab-blue",
      "woman-niqab-black", "woman-casual-red", "woman-dark-skin", "woman-glasses",
  ].map((name) => ({ name, url: `/avatars/${name}.png`, gender: "female" as const })),
  ...SKIN_TONE_BASES_FEMALE.flatMap((name) =>
    (["light", "medium", "dark"] as const).map((tone) => ({
      name: `${name}-${tone}`, url: `/avatars/${name}-${tone}.png`, gender: "female" as const,
    }))
  ),
];

type FormData = {
  name: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  gender: "male" | "female";
  avatar: string;
  subjects: string[];
  learningLevel: string;
  learningHistory: string;
  goals: string;
  languages: string[];
  timezone: string;
};

export default function StudentRegisterPage() {
  const t = useTranslations("student_form");
  const ta = useTranslations("auth");
  const router = useRouter();
  const locale = useLocale();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [subjectOpen, setSubjectOpen] = useState(false);
  const sliderRef = useRef<HTMLDivElement>(null);
  const subjectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/subjects").then((r) => r.json()).then(setSubjects).catch(() => {});
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (subjectRef.current && !subjectRef.current.contains(e.target as Node)) {
        setSubjectOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  function scrollSlider(dir: "left" | "right") {
    sliderRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  }
  const [data, setData] = useState<FormData>({
    name: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    gender: "male",
    avatar: AVATARS[0].url,
    subjects: [],
    learningLevel: "beginner",
    learningHistory: "",
    goals: "",
    languages: [],
    timezone: "UTC",
  });

  function update(field: keyof FormData, value: FormData[keyof FormData] | null) {
    if (value === null) return;
    setData((d) => ({ ...d, [field]: value }));
  }

  const passwordRules = [
    { label: t("pw_min"), valid: data.password.length >= 8 },
    { label: t("pw_upper"), valid: /[A-Z]/.test(data.password) },
    { label: t("pw_number"), valid: /[0-9]/.test(data.password) },
  ];
  const passwordValid = passwordRules.every((r) => r.valid);

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          phone: data.phone,
          password: data.password,
          image: data.avatar,
          role: "student",
          profile: {
            subjects: data.subjects,
            learningLevel: data.learningLevel,
            learningHistory: data.learningHistory,
            goals: data.goals,
            languages: data.languages,
            timezone: data.timezone,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Registration failed");
      }
      await signIn("credentials", { email: data.email, password: data.password, redirect: false });
      router.push("/dashboard/student");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const stepTitles = [t("step1_title"), t("step2_title"), t("step3_title")];

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f2ede8] watermark-pattern px-4 py-12">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader>
          <Link href="/" className="flex items-center gap-1.5 mb-2 w-fit text-[#2c1f12]/60 hover:text-[#c8973a] transition-colors text-sm">
            <ChevronLeft className="h-4 w-4" />
            <Image src="/logo.png" alt="Iwan" width={44} height={44} unoptimized />
            <span>{locale === "ar" ? "العودة إلى الصفحة الرئيسية" : "Return to Homepage"}</span>
          </Link>
          <CardTitle className="text-xl">{ta("student")}</CardTitle>
          <StepProgress current={step} total={3} titles={stepTitles} />
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("avatar")} <span className="text-destructive">*</span></Label>
                <div className="flex rounded-lg overflow-hidden border border-border w-fit">
                  {(["male", "female"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        const first = AVATARS.find((a) => a.gender === g);
                        setData((d) => ({ ...d, gender: g, avatar: first?.url ?? d.avatar }));
                      }}
                      className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                        data.gender === g
                          ? "bg-[#c8973a] text-white"
                          : "text-[#2c1f12]/60 hover:bg-[#c8973a]/10"
                      }`}
                    >
                      {g === "male" ? t("male") : t("female")}
                    </button>
                  ))}
                </div>
                <div className="relative flex items-center gap-1">
                  <button type="button" onClick={() => scrollSlider("left")} className="shrink-0 p-1 rounded-full hover:bg-[#c8973a]/15 transition-colors text-[#2c1f12]/60">
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div
                    ref={sliderRef}
                    className="flex gap-3 overflow-x-auto snap-x snap-mandatory [&::-webkit-scrollbar]:hidden [scrollbar-width:none]"
                  >
                    {AVATARS.filter((av) => av.gender === data.gender).map((av) => (
                      <button
                        key={av.name}
                        type="button"
                        onClick={() => update("avatar", av.url)}
                        className={`snap-start shrink-0 rounded-full overflow-hidden border-2 transition-colors h-20 w-20 ${
                          data.avatar === av.url ? "border-[#c8973a]" : "border-transparent hover:border-[#c8973a]/50"
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={av.url} alt={av.name} className="h-full w-full object-cover" />
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => scrollSlider("right")} className="shrink-0 p-1 rounded-full hover:bg-[#c8973a]/15 transition-colors text-[#2c1f12]/60">
                    <ChevronRight className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>{t("name")} <span className="text-destructive">*</span></Label>
                <Input value={data.name} onChange={(e) => update("name", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>{t("email")} <span className="text-destructive">*</span></Label>
                <Input type="email" value={data.email} onChange={(e) => update("email", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>{t("phone")} <span className="text-destructive">*</span></Label>
                <PhoneInput
                  international
                  defaultCountry="EG"
                  labels={locale === "ar" ? arLabels : undefined}
                  value={data.phone as E164Number}
                  onChange={(val) => update("phone", val ?? "")}
                  className="phone-input flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("password")} <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} value={data.password} onChange={(e) => update("password", e.target.value)} required className="pe-10" />
                  <button type="button" onClick={() => setShowPassword((v) => !v)} className="absolute end-3 top-1/2 -translate-y-1/2 text-[#2c1f12]/40 hover:text-[#2c1f12]/70">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {data.password && (
                  <ul className="space-y-0.5 mt-1">
                    {passwordRules.map((r) => (
                      <li key={r.label} className={`flex items-center gap-1.5 text-xs ${r.valid ? "text-green-600" : "text-[#2c1f12]/40"}`}>
                        <span>{r.valid ? "✓" : "○"}</span>
                        {r.label}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("confirm_password")} <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input type={showConfirm ? "text" : "password"} value={data.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} required className="pe-10" />
                  <button type="button" onClick={() => setShowConfirm((v) => !v)} className="absolute end-3 top-1/2 -translate-y-1/2 text-[#2c1f12]/40 hover:text-[#2c1f12]/70">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {data.confirmPassword && data.password !== data.confirmPassword && (
                  <p className="text-xs text-destructive">{t("password_mismatch")}</p>
                )}
              </div>
              <Button
                className="w-full mt-2"
                onClick={() => setStep(2)}
                disabled={!data.name || !data.email || !data.phone || !passwordValid || !data.confirmPassword || data.password !== data.confirmPassword}
              >
                {ta("next")}
              </Button>
              <p className="text-xs text-center text-[#2c1f12]/40 leading-relaxed">
                {t("data_notice")}
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2" ref={subjectRef}>
                <Label>{t("subjects")}</Label>
                <button
                  type="button"
                  onClick={() => setSubjectOpen((v) => !v)}
                  className="flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs text-start"
                >
                  <span className={data.subjects.length ? "text-foreground" : "text-muted-foreground"}>
                    {data.subjects.length ? data.subjects.join("، ") : t("subjects_placeholder")}
                  </span>
                  <span className="text-muted-foreground">▾</span>
                </button>
                {subjectOpen && (
                  <div className="rounded-md border border-input bg-card shadow-md max-h-52 overflow-y-auto z-50">
                    {subjects.map((s) => {
                      const selected = data.subjects.includes(s);
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => update("subjects", selected ? data.subjects.filter((x) => x !== s) : [...data.subjects, s])}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-sm text-start hover:bg-[#c8973a]/10 transition-colors ${selected ? "text-[#c8973a] font-medium" : ""}`}
                        >
                          <span className="w-4 text-center">{selected ? "✓" : ""}</span>
                          {s}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>{t("level")}</Label>
                <Select value={data.learningLevel} onValueChange={(v) => update("learningLevel", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder={t("level")}>
                      {data.learningLevel === "beginner" ? t("beginner") : data.learningLevel === "intermediate" ? t("intermediate") : t("advanced")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">{t("beginner")}</SelectItem>
                    <SelectItem value="intermediate">{t("intermediate")}</SelectItem>
                    <SelectItem value="advanced">{t("advanced")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("history")}</Label>
                <Textarea placeholder={t("history_placeholder")} value={data.learningHistory} onChange={(e) => update("learningHistory", e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>{t("goals")}</Label>
                <Textarea placeholder={t("goals_placeholder")} value={data.goals} onChange={(e) => update("goals", e.target.value)} rows={3} />
              </div>
              <div className="flex gap-3 mt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">{ta("back")}</Button>
                <Button onClick={() => setStep(3)} className="flex-1">{ta("next")}</Button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("languages")}</Label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() =>
                        update(
                          "languages",
                          data.languages.includes(lang)
                            ? data.languages.filter((l) => l !== lang)
                            : [...data.languages, lang]
                        )
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
              <div className="space-y-2">
                <Label>{t("timezone")}</Label>
                <Select value={data.timezone} onValueChange={(v) => update("timezone", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-3 mt-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">{ta("back")}</Button>
                <Button onClick={submit} className="flex-1" disabled={loading}>
                  {loading && <Loader2 className="h-4 w-4 animate-spin me-2" />}
                  {ta("submit")}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
