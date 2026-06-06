import { Navbar } from "@/components/layout/Navbar";
import { Hero } from "@/components/landing/Hero";
import { StatsBar } from "@/components/landing/StatsBar";
import { SubjectGrid } from "@/components/landing/SubjectGrid";
import { HowItWorks } from "@/components/landing/HowItWorks";
import { FAQSection } from "@/components/landing/FAQSection";
import { Footer } from "@/components/landing/Footer";
import { connectDB } from "@/lib/mongodb";
import { User } from "@/models/User";
import { Class } from "@/models/Class";

async function getStats() {
  try {
    await connectDB();
    const [teachers, students, classes] = await Promise.all([
      User.countDocuments({ role: "teacher" }),
      User.countDocuments({ role: "student" }),
      Class.countDocuments({ status: { $in: ["open", "completed"] } }),
    ]);
    return { teachers, students, classes };
  } catch {
    return { teachers: 0, students: 0, classes: 0 };
  }
}

export default async function HomePage() {
  const stats = await getStats();
  return (
    <div className="flex flex-col min-h-screen">
      <Navbar />
      <main className="flex-1">
        <Hero />
        <StatsBar stats={stats} />
        <SubjectGrid />
        <HowItWorks />
        <FAQSection />
      </main>
      <Footer />
    </div>
  );
}
