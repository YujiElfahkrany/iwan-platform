"use client";

import { useTranslations } from "next-intl";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Star, Globe, Award, Clock } from "lucide-react";

interface Profile {
  subjects: string[];
  experienceYears: number;
  qualifications: string[];
  certifications: string[];
  bio: string;
  languages: string[];
  hourlyRate: number;
  rating: number;
  totalReviews: number;
}

interface TeacherProfileCardProps {
  name: string;
  avatar: string;
  profile: Profile;
  userId?: string;
}

export function TeacherProfileCard({ name, avatar, profile }: TeacherProfileCardProps) {
  const t = useTranslations("teacher");

  return (
    <Card className="overflow-hidden">
      <div className="h-2 bg-gradient-to-r from-primary to-[#f59e0b]" />
      <CardContent className="p-6">
        <div className="flex flex-col sm:flex-row gap-6">
          {/* Avatar + name */}
          <div className="flex flex-col items-center gap-2 sm:w-40 shrink-0">
            <Avatar className="h-20 w-20 ring-4 ring-primary/20">
              <AvatarImage src={avatar} />
              <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                {name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h3 className="font-bold text-center text-lg">{name}</h3>
            <div className="flex items-center gap-1 text-[#c8973a]">
              <Star className="h-4 w-4 fill-current" />
              <span className="font-semibold text-sm">{profile.rating > 0 ? profile.rating.toFixed(1) : t("new_teacher")}</span>
              {profile.totalReviews > 0 && (
                <span className="text-muted-foreground text-xs">({profile.totalReviews})</span>
              )}
            </div>
            <p className="text-[#c8973a] font-bold">${profile.hourlyRate}/hr</p>
          </div>

          {/* Details */}
          <div className="flex-1 space-y-4">
            {profile.bio && (
              <p className="text-sm text-muted-foreground leading-relaxed">{profile.bio}</p>
            )}

            {profile.subjects.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("subjects_label")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.subjects.map((s) => (
                    <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-4 text-sm">
              {profile.experienceYears > 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>{t("exp_years", { n: profile.experienceYears })}</span>
                </div>
              )}
              {profile.languages.length > 0 && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Globe className="h-4 w-4 text-primary" />
                  <span>{profile.languages.join(", ")}</span>
                </div>
              )}
            </div>

            {profile.qualifications.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">
                  <Award className="h-3.5 w-3.5 inline me-1" />{t("qualifications")}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.qualifications.map((q) => (
                    <Badge key={q} variant="outline" className="text-xs">{q}</Badge>
                  ))}
                </div>
              </div>
            )}

            {profile.certifications.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground mb-1.5 uppercase tracking-wide">{t("certifications")}</p>
                <div className="flex flex-wrap gap-1.5">
                  {profile.certifications.map((c) => (
                    <Badge key={c} className="text-xs bg-[#c8973a]/15 text-[#8a6420] hover:bg-[#c8973a]/20 border-0">{c}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
