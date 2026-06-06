import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { JitsiRoom } from "@/components/video/JitsiRoom";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ArrowLeft } from "lucide-react";
import mongoose from "mongoose";

export default async function SessionPage({ params }: { params: Promise<{ bookingId: string; locale: string }> }) {
  const { bookingId, locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/auth/login`);

  if (!mongoose.Types.ObjectId.isValid(bookingId)) redirect(`/${locale}/dashboard/${session.user.role}`);

  await connectDB();
  const booking = await Booking.findById(bookingId).lean();

  if (!booking) redirect(`/${locale}/dashboard/${session.user.role}`);

  const isOwner =
    booking.studentId.toString() === session.user.id ||
    booking.teacherId.toString() === session.user.id;

  if (!isOwner || booking.status !== "confirmed") {
    redirect(`/${locale}/dashboard/${session.user.role}`);
  }

  return (
    <div className="h-screen flex flex-col bg-[#0f172a]">
      {/* Minimal top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-[#1e293b] border-b border-white/10">
        <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10" asChild>
          <Link href={`/dashboard/${session.user.role}`}>
            <ArrowLeft className="h-4 w-4 me-1.5" />Back to Dashboard
          </Link>
        </Button>
        <p className="text-white/50 text-xs">Room: {booking.meetingRoomName}</p>
      </div>

      {/* Jitsi fills remaining height */}
      <div className="flex-1 p-2">
        <JitsiRoom
          roomName={booking.meetingRoomName}
          displayName={session.user.name ?? session.user.email ?? "User"}
          email={session.user.email ?? undefined}
        />
      </div>
    </div>
  );
}
