import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { VideoRoom } from "@/components/video/VideoRoom";
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

  const t = await getTranslations("session");
  // Recording is the teacher's call, and that is a property of this booking —
  // not of the account's role.
  const isTeacher = booking.teacherId.toString() === session.user.id;

  return (
    <div className="h-screen flex flex-col bg-[#0f172a]">
      {/* Minimal top bar — wraps instead of clipping both labels at once, since
          the Arabic and Russian ones are longer than the English */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 bg-[#1e293b] border-b border-white/10">
        <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10 min-w-0" asChild>
          <Link href={`/dashboard/${session.user.role}`}>
            <ArrowLeft className="h-4 w-4 me-1.5 shrink-0" />
            <span className="truncate">{t("back_to_dashboard")}</span>
          </Link>
        </Button>
        <p className="text-white/50 text-xs truncate">
          {t("room_label")}: {booking.meetingRoomName}
        </p>
      </div>

      {/* Video call fills remaining height */}
      <div className="flex-1 p-2 min-h-0">
        <VideoRoom
          bookingId={bookingId}
          displayName={session.user.name ?? session.user.email ?? "User"}
          leaveHref={`/dashboard/${session.user.role}`}
          isTeacher={isTeacher}
          teacherUid={booking.teacherId.toString()}
          isClass={booking.type === "class"}
        />
      </div>
    </div>
  );
}
