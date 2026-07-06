import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { StudentProfile } from "@/models/StudentProfile";
import { StudentSettingsForm } from "@/components/student/SettingsForm";

export default async function StudentSettingsPage() {
  const session = await auth();
  if (!session?.user) return null;

  await connectDB();
  const [user, profile] = await Promise.all([
    User.findById(session.user.id).lean(),
    StudentProfile.findOne({ userId: session.user.id }).lean(),
  ]);

  if (!user || !profile) return null;

  return (
    <div className="max-w-3xl">
      <StudentSettingsForm
        initial={{
          name: user.name,
          avatar: user.avatar ?? "",
          subjects: profile.subjects,
          learningLevel: profile.learningLevel,
          learningHistory: profile.learningHistory,
          goals: profile.goals,
          languages: profile.languages,
        }}
      />
    </div>
  );
}
