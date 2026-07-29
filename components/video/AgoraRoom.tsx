"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AgoraRTC, {
  AgoraRTCProvider,
  LocalAudioTrack,
  LocalVideoTrack,
  RemoteUser,
  useIsConnected,
  useJoin,
  useLocalCameraTrack,
  useLocalMicrophoneTrack,
  usePublish,
  useRemoteUsers,
  useTrackEvent,
  type ILocalVideoTrack,
  type VideoPlayerConfig,
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

// "contain" shows the whole frame (letterboxed) instead of the SDK default
// "cover", which fills the tile by cropping — unusable for screen shares.
const REMOTE_VIDEO_CONFIG: VideoPlayerConfig = { fit: "contain" };

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
  const [screenTrack, setScreenTrack] = useState<ILocalVideoTrack | null>(null);
  const [screenError, setScreenError] = useState(false);
  const startingScreenShare = useRef(false);
  // null = still detecting devices
  const [hasMic, setHasMic] = useState<boolean | null>(null);
  const [hasCamera, setHasCamera] = useState<boolean | null>(null);

  const screenOn = screenTrack !== null;

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
  const { localCameraTrack, error: cameraError } = useLocalCameraTrack(cameraOn && hasCamera === true);

  // The screen track is created imperatively in the click handler (browsers
  // require a user gesture for the screen picker) and closed here whenever it
  // leaves state — including unmount — so the browser's "sharing your screen"
  // indicator always goes away.
  useEffect(() => {
    if (!screenTrack) return;
    return () => {
      screenTrack.close();
    };
  }, [screenTrack]);

  async function toggleScreenShare() {
    if (screenTrack) {
      setScreenTrack(null);
      return;
    }
    if (startingScreenShare.current) return;
    startingScreenShare.current = true;
    try {
      const track = await AgoraRTC.createScreenVideoTrack({}, "disable");
      setScreenTrack(track);
      setScreenError(false);
    } catch (err) {
      // PERMISSION_DENIED means the user dismissed the picker — not an error.
      if ((err as { code?: string }).code !== "PERMISSION_DENIED") {
        console.error(err);
        setScreenError(true);
      }
    } finally {
      startingScreenShare.current = false;
    }
  }

  // Stop sharing when the user ends it via the browser's own UI
  useTrackEvent(screenTrack, "track-ended", () => setScreenTrack(null));

  // A client can publish only one video track: screen share replaces the
  // camera. The switch must key on the actual track (not a flag): while the
  // screen picker is open the camera has to stay in this list, otherwise the
  // SDK forgets it is published and errors when the screen track arrives.
  usePublish([localMicrophoneTrack, screenTrack ?? localCameraTrack]);

  const remoteUsers = useRemoteUsers();

  // Memoized so the player isn't re-mounted every render. Camera preview is
  // mirrored (what people expect of themselves); a mirrored screen share
  // would show your own text backwards.
  const localVideoConfig = useMemo<VideoPlayerConfig>(
    () => ({ fit: "contain", mirror: !screenOn }),
    [screenOn]
  );

  const tileCount = remoteUsers.length + 1;
  const gridCols =
    tileCount === 1 ? "grid-cols-1" : tileCount <= 4 ? "grid-cols-2" : "grid-cols-3";

  return (
    <div className="h-full flex flex-col gap-2">
      {/* Video grid */}
      <div className={`flex-1 grid ${gridCols} auto-rows-fr gap-2 min-h-0`}>
        <div className="relative rounded-xl overflow-hidden bg-[#1e293b]">
          <LocalVideoTrack
            track={screenTrack ?? localCameraTrack}
            play={screenOn || cameraOn}
            disabled={!screenOn && !cameraOn}
            videoPlayerConfig={localVideoConfig}
            className="h-full w-full"
          />
          {/* Not rendered — applies mic mute (disabled) without playing our own audio */}
          <LocalAudioTrack track={localMicrophoneTrack} play={false} disabled={!micOn} />
          <span className="absolute bottom-2 start-2 px-2 py-0.5 rounded bg-black/50 text-white text-xs">
            {displayName} (You){screenOn ? " — sharing screen" : ""}
          </span>
        </div>
        {remoteUsers.map((user) => (
          <div key={user.uid} className="relative rounded-xl overflow-hidden bg-[#1e293b]">
            <RemoteUser user={user} videoPlayerConfig={REMOTE_VIDEO_CONFIG} className="h-full w-full" />
          </div>
        ))}
      </div>

      {!isConnected && (
        <p className="text-center text-white/50 text-sm">Connecting to session…</p>
      )}
      {(hasMic === false || hasCamera === false || micError || cameraError || screenError) && (
        <p className="text-center text-amber-400 text-sm">
          {[
            (hasMic === false || micError) && "Microphone unavailable — others can't hear you",
            (hasCamera === false || cameraError) && "Camera unavailable — others can't see you",
            screenError && "Screen sharing failed — check browser permissions",
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
          onClick={toggleScreenShare}
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
