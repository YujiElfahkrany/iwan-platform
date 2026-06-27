"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StepProgress } from "@/components/auth/StepProgress";
import { TagInput } from "@/components/auth/TagInput";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const TIMEZONES = ["UTC", "America/New_York", "America/Los_Angeles", "Europe/London", "Europe/Paris", "Asia/Dubai", "Asia/Riyadh", "Asia/Cairo", "Asia/Karachi"];
const LANGUAGES = ["English", "Arabic", "French", "Spanish", "Urdu"];

type FormData = {
  name: string;
  email: string;
  password: string;
  subjects: string[];
  experienceYears: number;
  qualifications: string[];
  certifications: string[];
  bio: string;
  hourlyRate: number;
  languages: string[];
  timezone: string;
};

export default function TeacherRegisterPage() {
  const t = useTranslations("teacher_form");
  const ta = useTranslations("auth");
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FormData>({
    name: "",
    email: "",
    password: "",
    subjects: [],
    experienceYears: 1,
    qualifications: [],
    certifications: [],
    bio: "",
    hourlyRate: 20,
    languages: [],
    timezone: "UTC",
  });

  function update<K extends keyof FormData>(field: K, value: FormData[K] | null) {
    if (value === null) return;
    setData((d) => ({ ...d, [field]: value }));
  }

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: data.name,
          email: data.email,
          password: data.password,
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
          <CardTitle className="text-xl">{ta("teacher")}</CardTitle>
          <StepProgress current={step} total={3} titles={stepTitles} />
        </CardHeader>
        <CardContent>
          {step === 1 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("name")}</Label>
                <Input value={data.name} onChange={(e) => update("name", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>{t("email")}</Label>
                <Input type="email" value={data.email} onChange={(e) => update("email", e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>{t("password")}</Label>
                <Input type="password" value={data.password} onChange={(e) => update("password", e.target.value)} required />
              </div>
              <Button className="w-full mt-2" onClick={() => setStep(2)} disabled={!data.name || !data.email || !data.password}>
                {ta("next")}
              </Button>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("subjects")}</Label>
                <TagInput value={data.subjects} onChange={(v) => update("subjects", v)} placeholder="Type subject and press Enter" />
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
