"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";
import {
  Mic,
  MicOff,
  Video,
  VideoOff,
  MonitorUp,
  PhoneOff,
  Captions as CaptionsIcon,
  Disc,
  Square,
} from "lucide-react";
import type { CaptionMessage, PlatformLocale, RoomMessage } from "@/lib/captions";
import { useRtmChannel } from "./useRtmChannel";
import { useCaptions } from "./useCaptions";
import { CaptionsOverlay } from "./CaptionsOverlay";
import { CaptionsMenu, readStoredSpokenLocale } from "./CaptionsMenu";
import { useSessionRecorder, type CompositeSources } from "./useSessionRecorder";
import RecordingIndicator from "./RecordingIndicator";
import { useTranscriptSaver } from "./useTranscriptSaver";

export interface AgoraRoomProps {
  appId: string;
  channel: string;
  token: string;
  rtmToken: string;
  uid: string;
  bookingId: string;
  displayName: string;
  leaveHref: string;
  isTeacher: boolean;
  /** The booking's teacher id — only their recording signal is trusted. */
  teacherUid: string;
  isClass: boolean;
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

function Room({
  appId,
  channel,
  token,
  rtmToken,
  uid,
  bookingId,
  displayName,
  leaveHref,
  isTeacher,
  teacherUid,
  isClass,
}: AgoraRoomProps) {
  const router = useRouter();
  const t = useTranslations("session");
  const tCaptions = useTranslations("captions");
  const viewerLocale = useLocale() as PlatformLocale;
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

  // --- Captions -----------------------------------------------------------
  const [showCaptions, setShowCaptions] = useState(true);
  const [transcribing, setTranscribing] = useState(false);
  const [captionsMenuOpen, setCaptionsMenuOpen] = useState(false);
  const [spokenLocale, setSpokenLocale] = useState<PlatformLocale>(() =>
    readStoredSpokenLocale(viewerLocale)
  );
  // Someone else started recording: the badge appears the moment their message
  // arrives, while RecordingIndicator's polling covers people who joined later.
  const [remoteRecording, setRemoteRecording] = useState(false);

  // Captions need `publish` from the RTM channel, and the channel needs to hand
  // incoming captions back — this ref breaks that circle.
  const ingestRef = useRef<((publisher: string, msg: CaptionMessage) => void) | null>(null);

  const handleRoomMessage = useCallback(
    (publisherId: string, msg: RoomMessage) => {
      if (msg.type === "recording") {
        // Only the teacher records, so only their signal counts — otherwise any
        // participant could clear the badge and hide that recording is running.
        if (publisherId === teacherUid) setRemoteRecording(msg.active);
        return;
      }
      // Own captions are rendered locally without a round-trip, so echoing our
      // own publisher id back in would show every line twice.
      if (publisherId === uid) return;
      ingestRef.current?.(publisherId, msg);
    },
    [uid, teacherUid]
  );

  const { publish, failed: rtmFailed } = useRtmChannel({
    appId,
    channel,
    uid,
    rtmToken,
    bookingId,
    onMessage: handleRoomMessage,
  });

  // Only group classes keep a transcript, and only for people who opted into
  // having their speech transcribed.
  const { recordLine } = useTranscriptSaver({ bookingId, enabled: isClass && transcribing });

  const { captions, ingest, sttSupported, sttDenied, translatorStatus } = useCaptions({
    publish,
    displayName,
    micOn,
    viewerLocale,
    spokenLocale,
    transcribing,
    onFinalLine: recordLine,
  });
  useEffect(() => {
    ingestRef.current = ingest;
  }, [ingest]);

  // --- Recording ----------------------------------------------------------
  const recorder = useSessionRecorder({
    bookingId,
    // Read fresh on every sync tick, so joins/leaves, a screen share replacing
    // the camera, and mic mute all reach the recording without extra plumbing.
    getSources: (): CompositeSources => ({
      video: [
        {
          track: (screenTrack ?? localCameraTrack)?.getMediaStreamTrack() ?? null,
          label: `${displayName} (${t("you")})${screenOn ? ` — ${t("sharing_screen")}` : ""}`,
        },
        ...remoteUsers.map((user) => ({
          track: user.videoTrack?.getMediaStreamTrack() ?? null,
          label: String(user.uid),
        })),
      ],
      audio: [
        // Muting only stops what is published, so the recording has to drop the
        // mic explicitly or it would capture speech the room never heard.
        micOn ? localMicrophoneTrack?.getMediaStreamTrack() : undefined,
        ...remoteUsers.map((user) => user.audioTrack?.getMediaStreamTrack()),
      ].filter((track): track is MediaStreamTrack => Boolean(track)),
    }),
  });

  const isRecording = recorder.state === "recording" || recorder.state === "stopping";

  // Tell the room whenever our recording starts or stops.
  const publishedRecording = useRef<boolean | null>(null);
  useEffect(() => {
    if (!isTeacher) return;
    const active = recorder.state === "recording";
    if (publishedRecording.current === active) return;
    publishedRecording.current = active;
    publish({ v: 1, type: "recording", active });
  }, [isTeacher, recorder.state, publish]);

  async function leave() {
    // Finish the upload before navigating away, so the last part isn't lost.
    if (isRecording) await recorder.stop();
    router.push(leaveHref);
  }

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
      {/* Video area — the relative parent that captions and the badge sit over */}
      <div className="relative flex-1 min-h-0">
        <div className={`h-full grid ${gridCols} auto-rows-fr gap-2`}>
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
            <span className="absolute bottom-2 start-2 max-w-[calc(100%-1rem)] truncate px-2 py-0.5 rounded bg-black/50 text-white text-xs">
              {displayName} ({t("you")}){screenOn ? ` — ${t("sharing_screen")}` : ""}
            </span>
          </div>
          {remoteUsers.map((user) => (
            <div key={user.uid} className="relative rounded-xl overflow-hidden bg-[#1e293b]">
              <RemoteUser user={user} videoPlayerConfig={REMOTE_VIDEO_CONFIG} className="h-full w-full" />
            </div>
          ))}
        </div>

        <RecordingIndicator
          bookingId={bookingId}
          localActive={isTeacher ? isRecording : remoteRecording}
          poll={!isTeacher}
        />
        {showCaptions && <CaptionsOverlay captions={captions} viewerLocale={viewerLocale} />}
      </div>

      {!isConnected && (
        <p className="text-center text-white/50 text-sm">{t("connecting")}</p>
      )}
      {(hasMic === false || hasCamera === false || micError || cameraError || screenError) && (
        <p className="text-center text-amber-400 text-sm px-4 break-words">
          {[
            (hasMic === false || micError) && t("mic_unavailable"),
            (hasCamera === false || cameraError) && t("camera_unavailable"),
            screenError && t("screen_failed"),
          ]
            .filter(Boolean)
            .join(" · ")}
          . {t("check_devices")}
        </p>
      )}
      {recorder.error && (
        <p className="text-center text-red-400 text-sm px-4 break-words">{t("recording_error")}</p>
      )}

      {/* Controls */}
      {/* `relative` here (not on the button) is what lets the captions panel
          centre over the whole row instead of hanging off the screen edge. */}
      <div className="relative flex flex-wrap items-center justify-center gap-3 py-2">
        <ControlButton
          active={micOn}
          onClick={() => setMicOn((v) => !v)}
          label={micOn ? t("mic_mute") : t("mic_unmute")}
        >
          {micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </ControlButton>
        <ControlButton
          active={cameraOn}
          onClick={() => setCameraOn((v) => !v)}
          label={cameraOn ? t("camera_off") : t("camera_on")}
        >
          {cameraOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </ControlButton>
        <ControlButton
          active={!screenOn}
          onClick={toggleScreenShare}
          label={screenOn ? t("stop_share_screen") : t("share_screen")}
        >
          <MonitorUp className="h-5 w-5" />
        </ControlButton>

        {/* Captions: one button opens the settings panel above the row */}
        <div>
          <ControlButton
            active={!transcribing}
            onClick={() => setCaptionsMenuOpen((open) => !open)}
            label={tCaptions("title")}
          >
            <CaptionsIcon className="h-5 w-5" />
          </ControlButton>
          <CaptionsMenu
            open={captionsMenuOpen}
            onClose={() => setCaptionsMenuOpen(false)}
            showCaptions={showCaptions}
            onToggleShow={() => setShowCaptions((v) => !v)}
            transcribing={transcribing}
            onToggleTranscribe={() => setTranscribing((v) => !v)}
            spokenLocale={spokenLocale}
            onSpokenLocaleChange={setSpokenLocale}
            sttSupported={sttSupported}
            sttDenied={sttDenied}
            translatorStatus={translatorStatus}
            rtmFailed={rtmFailed}
            transcriptSaved={isClass}
          />
        </div>

        {/* Recording is the teacher's decision, and only where the browser can do it */}
        {isTeacher && recorder.supported && (
          <ControlButton
            active={!isRecording}
            onClick={() => (isRecording ? void recorder.stop() : recorder.start())}
            label={isRecording ? t("record_stop") : t("record_start")}
          >
            {isRecording ? <Square className="h-5 w-5" /> : <Disc className="h-5 w-5" />}
          </ControlButton>
        )}

        <button
          onClick={() => void leave()}
          aria-label={t("leave")}
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
