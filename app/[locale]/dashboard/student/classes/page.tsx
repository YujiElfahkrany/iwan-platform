"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, Users, Clock, Search } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

interface ClassItem {
  _id: string;
  title: string;
  subject: string;
  description: string;
  startTime: string;
  endTime: string;
  price: number;
  maxStudents: number;
  enrolledStudents: string[];
  status: string;
  teacherId: string;
}

export default function BrowseClassesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const t = useTranslations("class_card");
  const td = useTranslations("dashboard");
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const res = await fetch("/api/classes");
      setClasses(await res.json());
      setLoading(false);
    }
    load();
  }, []);

  async function enroll(cls: ClassItem) {
    if (!session?.user) { router.push("/auth/login"); return; }
    setEnrollingId(cls._id);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "class",
          classId: cls._id,
          teacherId: cls.teacherId,
          useCredits: true,
          price: cls.price,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Enrollment failed");
      toast.success(`${cls.price} LE deducted from your balance.`);
      router.push("/dashboard/student/bookings");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Enrollment failed");
    } finally {
      setEnrollingId(null);
    }
  }

  const filtered = classes.filter((c) =>
    !search ||
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.subject.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">{td("browse_classes")}</h1>
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input className="ps-9" placeholder={`${td("browse_classes")}...`} value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">{t("full")}</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((cls) => {
            const spotsLeft = cls.maxStudents - cls.enrolledStudents.length;
            const isFull = spotsLeft === 0;
            const isEnrolled = session?.user && cls.enrolledStudents.includes(session.user.id);

            return (
              <Card key={cls._id} className="hover:shadow-md transition-shadow overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-primary to-[#f59e0b]" />
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base leading-tight">{cls.title}</CardTitle>
                    <p className="text-primary font-bold shrink-0">{cls.price} LE</p>
                  </div>
                  <Badge variant="outline" className="w-fit">{cls.subject}</Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  {cls.description && <p className="text-sm text-muted-foreground line-clamp-2">{cls.description}</p>}
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p className="flex items-center gap-2"><Clock className="h-3.5 w-3.5" />{format(new Date(cls.startTime), "PPp")} – {format(new Date(cls.endTime), "HH:mm")}</p>
                    <p className="flex items-center gap-2"><Users className="h-3.5 w-3.5" />{isFull ? t("full") : t("spots_left", { n: spotsLeft })}</p>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(cls.enrolledStudents.length / cls.maxStudents) * 100}%` }} />
                  </div>
                  <Button
                    className="w-full"
                    size="sm"
                    disabled={isFull || !!isEnrolled || enrollingId === cls._id}
                    onClick={() => enroll(cls)}
                  >
                    {enrollingId === cls._id && <Loader2 className="h-3.5 w-3.5 animate-spin me-1.5" />}
                    {isEnrolled ? td("enrolled_classes") : isFull ? t("full") : t("enroll")}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
