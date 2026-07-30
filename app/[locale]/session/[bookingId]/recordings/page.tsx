import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { connectDB } from "@/lib/mongodb";
import { Booking } from "@/models/Booking";
import { listPlayableByChannel } from "@/lib/recordingStore";
import { isR2Configured, presignDownloadObject, presignGetObject } from "@/lib/r2";
import { GET_URL_TTL_S, RETENTION_DAYS, downloadFileName, formatRecordingDuration } from "@/lib/recording";
import { formatSessionDate, PLATFORM_TIMEZONE } from "@/lib/datetime";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/navigation";
import { ArrowLeft, Download, Film } from "lucide-react";
import { getTranslations } from "next-intl/server";
import mongoose from "mongoose";


export default async function SessionRecordingsPage({
  params,
}: {
  params: Promise<{ bookingId: string; locale: string }>;
}) {
  const { bookingId, locale } = await params;
  const session = await auth();
  if (!session?.user) redirect(`/${locale}/auth/login`);

  if (!mongoose.Types.ObjectId.isValid(bookingId)) redirect(`/${locale}/dashboard/${session.user.role}`);

  await connectDB();
  const booking = await Booking.findById(bookingId).lean();

  if (!booking) redirect(`/${locale}/dashboard/${session.user.role}`);

  // Recordings are for the teacher who made them. A room's recording contains
  // every participant, so letting one student watch it back would hand them
  // footage of their classmates — including sessions they never attended.
  const isTeacher = booking.teacherId.toString() === session.user.id;

  // Unlike the live session page, a finished lesson still needs playback, so
  // "completed" bookings are allowed here too.
  if (!isTeacher || (booking.status !== "confirmed" && booking.status !== "completed")) {
    redirect(`/${locale}/dashboard/${session.user.role}`);
  }

  const t = await getTranslations("session");

  // Without R2 credentials (e.g. a local env) nothing was ever stored, so this
  // is an empty list, not a failure — presigning would be the thing that throws.
  const recordings = isR2Configured()
    ? await listPlayableByChannel(booking.meetingRoomName, new Date())
    : [];

  const videos = await Promise.all(
    recordings.map(async (rec) => ({
      id: rec._id.toString(),
      src: await presignGetObject(rec.objectKey, GET_URL_TTL_S),
      downloadSrc: await presignDownloadObject(
        rec.objectKey,
        GET_URL_TTL_S,
        downloadFileName(rec.startedAt)
      ),
      startedAtIso: rec.startedAt.toISOString(),
      // Always formatted against the platform timezone: this runs on the
      // server, which is UTC in production.
      startedAtText: formatSessionDate(rec.startedAt, locale, PLATFORM_TIMEZONE),
      duration: rec.endedAt ? formatRecordingDuration(rec.startedAt, rec.endedAt) : null,
    }))
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#0f172a]">
      {/* Wraps because the Russian and Arabic labels are much longer than the
          English ones and must not push the bar wider than the phone screen. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2 bg-[#1e293b] border-b border-white/10">
        <Button variant="ghost" size="sm" className="h-auto min-w-0 py-1.5 text-start text-white/70 hover:text-white hover:bg-white/10 whitespace-normal" asChild>
          <Link href={`/dashboard/${session.user.role}`}>
            <ArrowLeft className="h-4 w-4 me-1.5" />{t("back_to_dashboard")}
          </Link>
        </Button>
        <h1 className="flex min-w-0 items-center gap-2 text-sm font-medium text-white/90">
          <Film className="h-4 w-4 text-white/60" />
          <span className="break-words">{t("recordings_title")}</span>
        </h1>
      </div>

      <div className="flex-1 px-4 py-6">
        <div className="mx-auto w-full max-w-3xl space-y-4">
          {videos.length === 0 ? (
            <Card className="bg-[#1e293b] ring-white/10">
              <CardContent className="py-12 text-center text-white/60 break-words">{t("recordings_none")}</CardContent>
            </Card>
          ) : (
            videos.map((video) => (
              <Card key={video.id} className="bg-[#1e293b] ring-white/10">
                <CardContent className="space-y-3">
                  {/* Known limitation: files written by MediaRecorder carry no
                      duration in their header, so the player may report an
                      unknown/Infinity length and jump around coarsely when you
                      drag the scrubber until the whole file has downloaded. The
                      length we print below comes from the server timestamps
                      instead. We deliberately do not rewrite the file to fix it. */}
                  <video controls preload="metadata" src={video.src} className="w-full rounded-lg bg-black" />
                  {/* One wrapping paragraph: the date sits inside the translated
                      sentence, whose word order differs per locale. */}
                  {/* Wraps so a longer Russian or Arabic label cannot push the
                      button out of the card on a narrow screen. */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="min-w-0 text-xs leading-relaxed text-white/60 break-words">
                      <time dateTime={video.startedAtIso}>
                        {t("recorded_on", { date: video.startedAtText })}
                      </time>
                      {video.duration && <span className="text-white/40"> · {video.duration}</span>}
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-auto min-h-8 min-w-0 whitespace-normal py-1"
                      asChild
                    >
                      <a href={video.downloadSrc}>
                        <Download className="h-4 w-4 me-1.5 shrink-0" />
                        {t("download")}
                      </a>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
          <p className="text-xs leading-relaxed text-white/40 break-words">
            {t("recordings_expiry", { days: RETENTION_DAYS })}
          </p>
        </div>
      </div>
    </div>
  );
}
