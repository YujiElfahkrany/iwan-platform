"use client";

import { useState, useRef } from "react";
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
import { TagInput } from "@/components/auth/TagInput";
import { Loader2, ChevronLeft, Eye, EyeOff, Upload, X } from "lucide-react";
import { toast } from "sonner";
import Image from "next/image";
import PhoneInput from "react-phone-number-input";
import arLabels from "react-phone-number-input/locale/ar.json";
import "react-phone-number-input/style.css";
import type { E164Number } from "libphonenumber-js/core";

const TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Dubai", "Asia/Riyadh", "Asia/Cairo", "Asia/Karachi"];
const LANGUAGES = ["English", "Arabic", "French", "Spanish", "Urdu"];

const SKIN_TONE_BASES_FEMALE = ["woman-hijab-blue", "woman-hijab-red", "woman-hijab-green", "woman-hijab-yellow", "woman-niqab-grey", "woman-niqab-blue"];

const AVATARS: { name: string; url: string; gender: "male" | "female" }[] = [
  ...["man-kufi", "man-keffiyeh", "man-keffiyeh-blonde", "man-casual",
      "man-thobe", "man-keffiyeh-grey", "man-keffiyeh-gold", "man-thobe-white",
      "man-beard-dark", "man-glasses-elder",
  ].map((name) => ({ name, url: `/avatars/${name}.png`, gender: "male" as const })),
  ...[
    "man-kufi-light", "man-kufi-medium",
    "man-keffiyeh-light", "man-keffiyeh-medium", "man-keffiyeh-dark",
    "man-keffiyeh-blonde-light", "man-keffiyeh-blonde-medium", "man-keffiyeh-blonde-dark",
    "man-casual-light", "man-casual-medium", "man-casual-dark",
    "man-thobe-light",
    "man-keffiyeh-grey-light", "man-keffiyeh-grey-medium",
    "man-keffiyeh-gold-light", "man-keffiyeh-gold-dark",
    "man-thobe-white-medium",
  ].map((name) => ({ name, url: `/avatars/${name}.png`, gender: "male" as const })),
  ...["woman-hijab-blue", "woman-hijab-dark", "woman-hijab-red", "woman-hijab-green",
      "woman-hijab-yellow", "woman-niqab-grey", "woman-niqab-blue",
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
  experienceYears: number;
  qualifications: string[];
  certifications: string[];
  bio: string;
  hourlyRate: number;
  languages: string[];
  timezone: string;
  credentialImage: string;
};

export default function TeacherRegisterPage() {
  const t = useTranslations("teacher_form");
  const ts = useTranslations("student_form");
  const ta = useTranslations("auth");
  const router = useRouter();
  const locale = useLocale();
  const sliderRef = useRef<HTMLDivElement>(null);
  const credentialInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [credentialPreview, setCredentialPreview] = useState<string | null>(null);

  const [data, setData] = useState<FormData>({
    name: "", email: "", phone: "", password: "", confirmPassword: "",
    gender: "male", avatar: AVATARS[0].url,
    subjects: [], experienceYears: 1,
    qualifications: [], certifications: [],
    bio: "", hourlyRate: 20,
    languages: [], timezone: "UTC",
    credentialImage: "",
  });

  function update<K extends keyof FormData>(field: K, value: FormData[K] | null) {
    if (value === null) return;
    setData((d) => ({ ...d, [field]: value }));
  }

  function scrollSlider(dir: "left" | "right") {
    sliderRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  }

  const visibleAvatars = AVATARS.filter((a) => a.gender === data.gender);

  const passwordRules = [
    { label: ts("pw_min"), valid: data.password.length >= 8 },
    { label: ts("pw_upper"), valid: /[A-Z]/.test(data.password) },
    { label: ts("pw_number"), valid: /[0-9]/.test(data.password) },
  ];
  const passwordValid = passwordRules.every((r) => r.valid);

  async function handleCredentialUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { toast.error("File too large — max 5 MB"); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      update("credentialImage", base64);
      setCredentialPreview(base64);
    };
    reader.readAsDataURL(file);
  }

  async function submit() {
    if (data.password !== data.confirmPassword) { toast.error("Passwords do not match"); return; }
    if (!passwordValid) { toast.error("Password does not meet requirements"); return; }
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
          role: "teacher",
          profile: {
            subjects: data.subjects,
            experienceYears: data.experienceYears,
            qualifications: data.qualifications,
            certifications: data.certifications,
            bio: data.bio,
            hourlyRate: data.hourlyRate,
            languages: data.languages,
            timezone: data.timezone,
            credentialImage: data.credentialImage,
          },
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Registration failed");
      }
      await signIn("credentials", { email: data.email, password: data.password, redirect: false });
      router.push("/dashboard/teacher");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  }

  const stepTitles = [t("step1_title"), t("step2_title"), t("step3_title")];

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader>
          <Link href="/" className="flex items-center gap-1.5 mb-2 w-fit text-[#2c1f12]/60 hover:text-[#c8973a] transition-colors text-sm">
            <ChevronLeft className={`h-4 w-4 ${locale === "ar" ? "rotate-180" : ""}`} />
            <Image src="/logo.png" alt="Iwan" width={44} height={44} unoptimized />
            <span>{locale === "ar" ? "العودة إلى الصفحة الرئيسية" : "Return to Homepage"}</span>
          </Link>
          <CardTitle className="text-xl">{ta("teacher")}</CardTitle>
          <StepProgress current={step} total={3} titles={stepTitles} />
        </CardHeader>

        <CardContent>
          {/* ── Step 1: Avatar + Personal info ── */}
          {step === 1 && (
            <div className="space-y-4">
              {/* Gender toggle */}
              <div className="space-y-2">
                <Label>{ts("avatar")}</Label>
                <div className="flex rounded-lg overflow-hidden border border-border w-fit">
                  {(["male", "female"] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => {
                        update("gender", g);
                        const first = AVATARS.find((a) => a.gender === g);
                        if (first) update("avatar", first.url);
                      }}
                      className={`px-4 py-1.5 text-sm font-medium transition-colors ${data.gender === g ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                    >
                      {g === "male" ? ts("male") : ts("female")}
                    </button>
                  ))}
                </div>

                {/* Avatar slider */}
                <div className="relative">
                  <button type="button" onClick={() => scrollSlider("left")} className="absolute start-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 border rounded-full p-1 shadow hover:bg-white">
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <div ref={sliderRef} className="flex gap-3 overflow-x-auto scroll-smooth px-8 py-2 scrollbar-hide">
                    {visibleAvatars.map((av) => (
                      <button
                        key={av.name}
                        type="button"
                        onClick={() => update("avatar", av.url)}
                        className={`shrink-0 rounded-xl border-2 p-1 transition-all ${data.avatar === av.url ? "border-primary shadow-md" : "border-transparent hover:border-border"}`}
                      >
                        <Image src={av.url} alt={av.name} width={56} height={56} className="object-contain" unoptimized />
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => scrollSlider("right")} className="absolute end-0 top-1/2 -translate-y-1/2 z-10 bg-white/80 border rounded-full p-1 shadow hover:bg-white">
                    <ChevronLeft className="h-4 w-4 rotate-180" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t("name")}</Label>
                <Input value={data.name} onChange={(e) => update("name", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>{t("email")}</Label>
                <Input type="email" value={data.email} onChange={(e) => update("email", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>{ts("phone")}</Label>
                <PhoneInput
                  international
                  defaultCountry="EG"
                  labels={locale === "ar" ? arLabels : undefined}
                  value={data.phone as E164Number}
                  onChange={(v) => update("phone", v ?? "")}
                  className="phone-input flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>{t("password")}</Label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} value={data.password} onChange={(e) => update("password", e.target.value)} required />
                  <button type="button" onClick={() => setShowPassword((p) => !p)} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground">
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
                <Label>{ts("confirm_password")} <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input type={showConfirm ? "text" : "password"} value={data.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)} required />
                  <button type="button" onClick={() => setShowConfirm((p) => !p)} className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {data.confirmPassword && data.password !== data.confirmPassword && (
                  <p className="text-xs text-destructive">{ts("password_mismatch")}</p>
                )}
              </div>
              <Button className="w-full mt-2" onClick={() => setStep(2)} disabled={!data.name || !data.email || !data.password || !passwordValid || !data.confirmPassword || data.password !== data.confirmPassword}>
                {ta("next")}
              </Button>
            </div>
          )}

          {/* ── Step 2: Professional info ── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("subjects")}</Label>
                <TagInput value={data.subjects} onChange={(v) => update("subjects", v)} placeholder={locale === "ar" ? "اكتب مادة واضغط Enter" : "Type subject and press Enter"} />
              </div>
              <div className="space-y-2">
                <Label>{t("experience")}</Label>
                <Input type="number" min={0} max={50} value={data.experienceYears} onChange={(e) => update("experienceYears", parseInt(e.target.value) || 0)} />
              </div>
              <div className="space-y-2">
                <Label>{t("qualifications")}</Label>
                <TagInput value={data.qualifications} onChange={(v) => update("qualifications", v)} placeholder={t("qualifications_placeholder")} />
              </div>
              <div className="space-y-2">
                <Label>{t("certifications")}</Label>
                <TagInput value={data.certifications} onChange={(v) => update("certifications", v)} placeholder={t("certifications_placeholder")} />
              </div>
              <div className="space-y-2">
                <Label>{t("bio")}</Label>
                <Textarea placeholder={t("bio_placeholder")} value={data.bio} onChange={(e) => update("bio", e.target.value)} rows={3} />
              </div>
              <div className="space-y-2">
                <Label>{t("hourly_rate")}</Label>
                <Input type="number" min={1} value={data.hourlyRate} onChange={(e) => update("hourlyRate", parseFloat(e.target.value) || 0)} />
              </div>
              <div className="flex gap-3 mt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">{ta("back")}</Button>
                <Button onClick={() => setStep(3)} className="flex-1">{ta("next")}</Button>
              </div>
            </div>
          )}

          {/* ── Step 3: Credentials + Languages + Timezone ── */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Credential upload */}
              <div className="space-y-2">
                <Label>{locale === "ar" ? "وثيقة المؤهل" : "Credential Document"}</Label>
                <p className="text-xs text-muted-foreground">
                  {locale === "ar"
                    ? "ارفع صورة أو ملف PDF لشهادتك أو مؤهلك التدريسي (الحد الأقصى 5 ميجابايت)"
                    : "Upload a photo or PDF of your teaching certificate or qualification (max 5 MB)"}
                </p>
                <input
                  ref={credentialInputRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={handleCredentialUpload}
                />
                {credentialPreview ? (
                  <div className="relative inline-block">
                    {credentialPreview.startsWith("data:image") ? (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img src={credentialPreview} alt="credential" className="h-32 w-auto rounded-lg border object-contain" />
                    ) : (
                      <div className="h-32 w-48 rounded-lg border bg-muted flex items-center justify-center text-sm text-muted-foreground">
                        {locale === "ar" ? "تم رفع الملف ✓" : "File uploaded ✓"}
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => { update("credentialImage", ""); setCredentialPreview(null); }}
                      className="absolute -top-2 -end-2 bg-destructive text-white rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => credentialInputRef.current?.click()}
                    className="flex items-center gap-2 border-2 border-dashed border-[#c8973a]/40 hover:border-[#c8973a] rounded-xl px-6 py-4 text-sm text-muted-foreground hover:text-[#c8973a] transition-colors w-full justify-center"
                  >
                    <Upload className="h-5 w-5" />
                    {locale === "ar" ? "انقر لرفع الوثيقة" : "Click to upload document"}
                  </button>
                )}
              </div>

              {/* Languages */}
              <div className="space-y-2">
                <Label>{t("languages")}</Label>
                <div className="flex flex-wrap gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() =>
                        update("languages", data.languages.includes(lang)
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

              {/* Timezone */}
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

          <p className="text-center text-xs text-muted-foreground mt-4">
            {ta("have_account")}{" "}
            <Link href="/auth/login?role=teacher" className="text-primary hover:underline font-medium">
              {ta("login")}
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
