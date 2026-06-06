"use client";

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Link } from "@/i18n/navigation";
import { Search, Star, Globe, Clock, Loader2 } from "lucide-react";

interface Teacher {
  _id: string;
  userId: string;
  subjects: string[];
  experienceYears: number;
  bio: string;
  languages: string[];
  hourlyRate: number;
  rating: number;
  totalReviews: number;
  user: { name: string; avatar?: string } | null;
}

export default function BrowseTeachersPage() {
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      const params = new URLSearchParams();
      if (subjectFilter) params.set("subject", subjectFilter);
      const res = await fetch(`/api/teachers?${params}`);
      setTeachers(await res.json());
      setLoading(false);
    }
    load();
  }, [subjectFilter]);

  const filtered = teachers.filter((t) => {
    if (!search) return true;
    const name = t.user?.name?.toLowerCase() ?? "";
    return name.includes(search.toLowerCase()) || t.subjects.some((s) => s.toLowerCase().includes(search.toLowerCase()));
  });

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-2xl font-bold">Browse Teachers</h1>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="ps-9" placeholder="Search by name or subject..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Input placeholder="Filter by subject..." value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)} className="sm:w-48" />
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No teachers found.</CardContent></Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((t) => (
            <Card key={t._id} className="hover:shadow-md transition-shadow overflow-hidden">
              <div className="h-1.5 bg-gradient-to-r from-primary to-[#f59e0b]" />
              <CardContent className="p-5">
                <div className="flex gap-4">
                  <Avatar className="h-14 w-14 shrink-0">
                    <AvatarImage src={t.user?.avatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-lg">
                      {t.user?.name?.charAt(0).toUpperCase() ?? "T"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold truncate">{t.user?.name ?? "Teacher"}</h3>
                      <p className="text-primary font-bold shrink-0">${t.hourlyRate}/hr</p>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                      {t.rating > 0 && (
                        <span className="flex items-center gap-1"><Star className="h-3.5 w-3.5 text-amber-400 fill-current" />{t.rating.toFixed(1)}</span>
                      )}
                      {t.experienceYears > 0 && (
                        <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{t.experienceYears}yr</span>
                      )}
                      {t.languages.length > 0 && (
                        <span className="flex items-center gap-1"><Globe className="h-3.5 w-3.5" />{t.languages[0]}</span>
                      )}
                    </div>
                    {t.bio && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{t.bio}</p>}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {t.subjects.slice(0, 3).map((s) => (
                        <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <Button className="w-full mt-4" size="sm" asChild>
                  <Link href={`/teachers/${t.userId}`}>View Profile & Book</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
