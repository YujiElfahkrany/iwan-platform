"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

// Agora SDK touches window/navigator at import time — load client-side only
const AgoraRoom = dynamic(() => import("./AgoraRoom"), {
  ssr: false,
  loading: () => <RoomLoading />,
});

interface VideoRoomProps {
  bookingId: string;
  displayName: string;
  leaveHref: string;
  /** True when this viewer is the booking's teacher: only they may record. */
  isTeacher: boolean;
  /** The booking's teacher id, so only their recording signal is trusted. */
  teacherUid: string;
  /** Group classes keep a transcript for AI session notes; 1-on-1 lessons don't. */
  isClass: boolean;
}

interface Credentials {
  appId: string;
  channel: string;
  token: string;
  rtmToken: string;
  uid: string;
}

export function VideoRoom({
  bookingId,
  displayName,
  leaveHref,
  isTeacher,
  teacherUid,
  isClass,
}: VideoRoomProps) {
  const t = useTranslations("session");
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agora/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "join_failed");
        if (!cancelled) setCreds(data);
      })
      .catch((err: Error) => {
        // The API's messages — and the browser's own network errors — are
        // internal English, so they are logged rather than shown.
        console.error(err);
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  if (failed) return <RoomStatus message={t("join_failed")} isError />;
  if (!creds) return <RoomStatus message={t("joining")} />;

  return (
    <AgoraRoom
      {...creds}
      bookingId={bookingId}
      displayName={displayName}
      leaveHref={leaveHref}
      isTeacher={isTeacher}
      teacherUid={teacherUid}
      isClass={isClass}
    />
  );
}

function RoomLoading() {
  const t = useTranslations("session");
  return <RoomStatus message={t("loading_video")} />;
}

function RoomStatus({ message, isError }: { message: string; isError?: boolean }) {
  return (
    <div className="h-full flex items-center justify-center px-4">
      <p className={`text-sm text-center break-words ${isError ? "text-red-400" : "text-white/50"}`}>
        {message}
      </p>
    </div>
  );
}
