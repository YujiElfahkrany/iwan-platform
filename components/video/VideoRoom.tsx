"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";

// Agora SDK touches window/navigator at import time — load client-side only
const AgoraRoom = dynamic(() => import("./AgoraRoom"), {
  ssr: false,
  loading: () => <RoomStatus message="Loading video…" />,
});

interface VideoRoomProps {
  bookingId: string;
  displayName: string;
  leaveHref: string;
}

interface Credentials {
  appId: string;
  channel: string;
  token: string;
  uid: string;
}

export function VideoRoom({ bookingId, displayName, leaveHref }: VideoRoomProps) {
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/agora/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
    })
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Failed to join session");
        if (!cancelled) setCreds(data);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [bookingId]);

  if (error) return <RoomStatus message={error} isError />;
  if (!creds) return <RoomStatus message="Joining session…" />;

  return <AgoraRoom {...creds} displayName={displayName} leaveHref={leaveHref} />;
}

function RoomStatus({ message, isError }: { message: string; isError?: boolean }) {
  return (
    <div className="h-full flex items-center justify-center">
      <p className={`text-sm ${isError ? "text-red-400" : "text-white/50"}`}>{message}</p>
    </div>
  );
}
