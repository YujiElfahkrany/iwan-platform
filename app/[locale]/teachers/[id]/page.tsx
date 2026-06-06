import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { TeacherProfile } from "@/models/TeacherProfile";
import { Slot } from "@/models/Slot";
import { notFound } from "next/navigation";
import { TeacherProfileCard } from "@/components/teacher/ProfileCard";
import { Navbar } from "@/components/layout/Navbar";
import { BookSlotSection } from "@/components/student/BookSlotSection";
import mongoose from "mongoose";

export default async function TeacherPublicPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const { id } = await params;
  await connectDB();

  if (!mongoose.Types.ObjectId.isValid(id)) notFound();

  const [user, profile] = await Promise.all([
    User.findById(id).lean(),
    TeacherProfile.findOne({ userId: id }).lean(),
  ]);

  if (!user || !profile || user.role !== "teacher") notFound();

  const slots = await Slot.find({ teacherId: id, status: "available", startTime: { $gte: new Date() } })
    .sort({ startTime: 1 })
    .limit(20)
    .lean();

  const slotsData = slots.map((s) => ({
    _id: s._id.toString(),
    startTime: s.startTime.toISOString(),
    endTime: s.endTime.toISOString(),
    durationMinutes: s.durationMinutes,
    price: s.price,
    teacherId: s.teacherId.toString(),
  }));

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-10 max-w-4xl space-y-8">
        <TeacherProfileCard
          name={user.name}
          avatar={user.avatar ?? ""}
          userId={user._id.toString()}
          profile={{
            subjects: profile.subjects,
            experienceYears: profile.experienceYears,
            qualifications: profile.qualifications,
            certifications: profile.certifications,
            bio: profile.bio,
            languages: profile.languages,
            hourlyRate: profile.hourlyRate,
            rating: profile.rating,
            totalReviews: profile.totalReviews,
          }}
        />
        <BookSlotSection slots={slotsData} teacherId={id} teacherName={user.name} />
      </div>
    </div>
  );
}
