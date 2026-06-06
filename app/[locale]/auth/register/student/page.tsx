"use client";

import { useState } from "react";
import { useTranslations, useLocale } from "next-intl";
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
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<FormData>({
    name: "",
    email: "",
    password: "",
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
          <CardTitle className="text-xl">{ta("student")}</CardTitle>
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
                <Label>{t("level")}</Label>
                <Select value={data.learningLevel} onValueChange={(v) => update("learningLevel", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
