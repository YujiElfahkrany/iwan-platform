"use client";

import { useEffect, useMemo, useState } from "react";
import AgoraRTC, {
  AgoraRTCProvider,
  LocalUser,
  RemoteUser,
  useIsConnected,
  useJoin,
  useLocalCameraTrack,
  useLocalMicrophoneTrack,
  useLocalScreenTrack,
  usePublish,
  useRemoteUsers,
  useTrackEvent,
} from "agora-rtc-react";
import { useRouter } from "@/i18n/navigation";
import { Mic, MicOff, Video, VideoOff, MonitorUp, PhoneOff } from "lucide-react";

export interface AgoraRoomProps {
  appId: string;
  channel: string;
  token: string;
  uid: string;
  displayName: string;
  leaveHref: string;
}

export default function AgoraRoom(props: AgoraRoomProps) {
  const client = useMemo(
    () => AgoraRTC.createClient({ mode: "rtc", codec: "vp8" }),
    []
  );
  return (
    <AgoraRTCProvider client={client}>
      <Room {...props} />
    </AgoraRTCProvider>
  );
}

function Room({ appId, channel, token, uid, displayName, leaveHref }: AgoraRoomProps) {
  const router = useRouter();
  const [micOn, setMicOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [screenOn, setScreenOn] = useState(false);
  // null = still detecting devices
  const [hasMic, setHasMic] = useState<boolean | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);

  // Only ask the SDK to open devices that actually exist — otherwise it
  // throws DEVICE_NOT_FOUND on machines without a camera/mic
  useEffect(() => {
    let cancelled = false;
    navigator.mediaDevices
      .enumerateDevices()
      .then((devices) => {
        if (cancelled) return;
        setHasMic(devices.some((d) => d.kind === "audioinput"));
        setHasCamera(devices.some((d) => d.kind === "videoinput"));
      })
      .catch(() => {
        if (cancelled) return;
        setHasMic(false);
        setHasCamera(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useJoin({ appid: appId, channel, token, uid });
  const isConnected = useIsConnected();

  const { localMicrophoneTrack, error: micError } = useLocalMicrophoneTrack(micOn && hasMic === true);
  const { localCameraTrack, error: cameraError } = useLocalCameraTrack(cameraOn && hasCamera === true && !screenOn);
  const { screenTrack } = useLocalScreenTrack(screenOn, {}, "disable");

  // Stop sharing when the user ends it via the browser's own UI
  useTrackEvent(screenTrack, "track-ended", () => setScreenOn(false));

  // A client can publish only one video track: screen share replaces the camera
  usePublish([localMicrophoneTrack, screenOn ? screenTrack : localCameraTrack]);

  const remoteUsers = useRemoteUsers();

  const tileCount = remoteUsers.length + 1;
  const gridCols =
    tileCount === 1 ? "grid-cols-1" : tileCount <= 4 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Video grid */}
      <div className={`flex-1 grid ${gridCols} auto-rows-fr gap-2 min-h-0`}>
        <div className="relative rounded-xl overflow-hidden bg-[#1e293b]">
          <LocalUser
            audioTrack={localMicrophoneTrack}
            videoTrack={screenOn ? screenTrack : localCameraTrack}
            micOn={micOn}
            cameraOn={screenOn ? !!screenTrack : cameraOn}
            playAudio={false}
            className="h-full w-full"
          />
          <span className="absolute bottom-2 start-2 px-2 py-0.5 rounded bg-black/50 text-white text-xs">
            {displayName} (You){screenOn ? " — sharing screen" : ""}
          </span>
        </div>
        {remoteUsers.map((user) => (
          <div key={user.uid} className="relative rounded-xl overflow-hidden bg-[#1e293b]">
            <RemoteUser user={user} className="h-full w-full" />
          </div>
        ))}
      </div>

      {!isConnected && (
        <p className="text-center text-white/50 text-sm">Connecting to session…</p>
      )}
      {(hasMic === false || hasCamera === false || micError || cameraError) && (
        <p className="text-center text-amber-400 text-sm">
          {[
            (hasMic === false || micError) && "Microphone unavailable — others can't hear you",
            (hasCamera === false || cameraError) && "Camera unavailable — others can't see you",
          ]
            .filter(Boolean)
            .join(" · ")}
          . Check that a device is connected and permitted.
        </p>
      )}

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 py-2">
        <ControlButton
          active={micOn}
          onClick={() => setMicOn((v) => !v)}
          label={micOn ? "Mute microphone" : "Unmute microphone"}
        >
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </ControlButton>
        <ControlButton
          active={cameraOn}
          onClick={() => setCameraOn((v) => !v)}
          label={cameraOn ? "Turn camera off" : "Turn camera on"}
        >
          {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </ControlButton>
        <ControlButton
          active={!screenOn}
          onClick={() => setScreenOn((v) => !v)}
          label={screenOn ? "Stop sharing screen" : "Share screen"}
        >
          <MonitorUp className="h-5 w-5" />
        </ControlButton>
        <button
          onClick={() => router.push(leaveHref)}
          aria-label="Leave session"
          className="h-11 w-11 flex items-center justify-center rounded-full bg-red-600 hover:bg-red-500 text-white transition-colors"
        >
          <PhoneOff className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

function ControlButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`h-11 w-11 flex items-center justify-center rounded-full transition-colors ${
        active
          ? "bg-white/10 hover:bg-white/20 text-white"
          : "bg-white text-slate-900 hover:bg-white/80"
      }`}
    >
      {children}
    </button>
  );
}
