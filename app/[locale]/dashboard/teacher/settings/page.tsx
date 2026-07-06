import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { TeacherProfile } from "@/models/TeacherProfile";
import { TeacherSettingsForm } from "@/components/teacher/SettingsForm";

export default async function TeacherSettingsPage() {
  const session = await auth();
  if (!session?.user) return null;

  await connectDB();
  const [user, profile] = await Promise.all([
    User.findById(session.user.id).lean(),
    TeacherProfile.findOne({ userId: session.user.id }).lean(),
  ]);

  if (!user || !profile) return null;

  return (
    <div className="max-w-3xl">
      <TeacherSettingsForm
        initial={{
          name: user.name,
          avatar: user.avatar ?? "",
          bio: profile.bio,
          subjects: profile.subjects,
          experienceYears: profile.experienceYears,
          qualifications: profile.qualifications,
          certifications: profile.certifications,
          languages: profile.languages,
          hourlyRate: profile.hourlyRate,
        }}
      />
    </div>
  );
}
