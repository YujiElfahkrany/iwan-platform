"use client";

import { useEffect, useRef } from "react";
import { JITSI_DOMAIN } from "@/lib/jitsi";

declare global {
  interface Window {
    JitsiMeetExternalAPI: new (
      domain: string,
      options: Record<string, unknown>
    ) => { dispose: () => void };
  }
}

interface JitsiRoomProps {
  roomName: string;
  displayName: string;
  email?: string;
}

export function JitsiRoom({ roomName, displayName, email }: JitsiRoomProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<{ dispose: () => void } | null>(null);

  useEffect(() => {
    if (!containerRef.current || typeof window === "undefined") return;

    // Load Jitsi script dynamically
    const script = document.createElement("script");
    script.src = `https://${JITSI_DOMAIN}/external_api.js`;
    script.async = true;
    script.onload = () => {
      if (!containerRef.current || !window.JitsiMeetExternalAPI) return;
      apiRef.current = new window.JitsiMeetExternalAPI(JITSI_DOMAIN, {
        roomName,
        width: "100%",
        height: "100%",
        parentNode: containerRef.current,
        userInfo: { displayName, email },
        configOverwrite: {
          startWithAudioMuted: false,
          startWithVideoMuted: false,
          prejoinPageEnabled: false,
        },
        interfaceConfigOverwrite: {
          SHOW_JITSI_WATERMARK: false,
          SHOW_WATERMARK_FOR_GUESTS: false,
          TOOLBAR_BUTTONS: ["microphone", "camera", "closedcaptions", "desktop", "chat", "raisehand", "tileview", "hangup"],
        },
      });
    };
    document.head.appendChild(script);

    return () => {
      apiRef.current?.dispose();
      script.remove();
    };
  }, [roomName, displayName, email]);

  return <div ref={containerRef} className="w-full h-full rounded-xl overflow-hidden" />;
}
