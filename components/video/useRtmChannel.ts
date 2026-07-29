"use client";

// Agora Signaling (RTM 2.x) lifecycle for one room. Captions and other small
// room messages travel here, on a channel named exactly like the RTC channel.
//
// This hook is deliberately fail-soft: Signaling is a separate service that has
// to be enabled on the Agora app id, so login can legitimately fail on an
// otherwise healthy project. When that happens the video call must carry on
// without captions, so every error is logged and surfaced as `failed` instead of
// thrown.
//
// Connections are shared per room and torn down only after a short delay,
// because Agora rejects repeated logins for the same user with "login too
// frequent". Without sharing, React's development double-mount (and a user who
// leaves a room and immediately rejoins) would open a second client and get that
// rejection, which would silently disable captions for the session.

import { useCallback, useEffect, useRef, useState } from "react";
import AgoraRTM, { type RTMClient, type RTMEvents } from "agora-rtm";
import { parseRoomMessage, type RoomMessage } from "@/lib/captions";

export interface UseRtmChannelOptions {
  appId: string;
  channel: string;
  /** Same uid as the RTC join (the user's Mongo id as a string). */
  uid: string;
  rtmToken: string;
  /** Used to ask the token endpoint for a fresh token before this one expires. */
  bookingId: string;
  onMessage: (publisherId: string, msg: RoomMessage) => void;
}

export interface RtmChannel {
  /** Fire-and-forget send; a no-op while disconnected. */
  publish: (msg: RoomMessage) => void;
  connected: boolean;
  /** Signaling could not be reached — captions are off for this session. */
  failed: boolean;
}

type MessageHandler = (publisherId: string, msg: RoomMessage) => void;
type StatusHandler = (connected: boolean) => void;

interface SharedConnection {
  client: RTMClient;
  /** Resolves true once logged in and subscribed, false if Signaling failed. */
  ready: Promise<boolean>;
  messageHandlers: Set<MessageHandler>;
  statusHandlers: Set<StatusHandler>;
  mounts: number;
  pendingTeardown: ReturnType<typeof setTimeout> | null;
  token: string;
}

/** Live connections keyed by room, so remounts reuse one login. */
const connections = new Map<string, SharedConnection>();

/**
 * How long a connection outlives its last user. Long enough to cover an unmount
 * followed immediately by a remount, short enough that a real departure frees
 * the Signaling seat quickly (the free tier counts concurrent users).
 */
const TEARDOWN_DELAY_MS = 3000;

function connect(
  key: string,
  opts: { appId: string; channel: string; uid: string; token: string; bookingId: string },
): SharedConnection {
  const client: RTMClient = new AgoraRTM.RTM(opts.appId, opts.uid);

  const conn: SharedConnection = {
    client,
    messageHandlers: new Set(),
    statusHandlers: new Set(),
    mounts: 0,
    pendingTeardown: null,
    token: opts.token,
    // Assigned below; the object has to exist first so the listeners can fan out.
    ready: Promise.resolve(false),
  };

  client.addEventListener("message", (event: RTMEvents.MessageEvent) => {
    // One client can be subscribed to several channels; ignore other rooms.
    if (event.channelName !== opts.channel) return;
    const msg = parseRoomMessage(event.message);
    if (!msg) return;
    for (const handler of conn.messageHandlers) handler(event.publisher, msg);
  });

  client.addEventListener(
    "status",
    (
      event:
        | RTMEvents.RTMConnectionStatusChangeEvent
        | RTMEvents.StreamChannelConnectionStatusChangeEvent,
    ) => {
      const isConnected = event.state === "CONNECTED";
      for (const handler of conn.statusHandlers) handler(isConnected);
    },
  );

  client.addEventListener("tokenPrivilegeWillExpire", () => {
    void renewToken(conn, opts.bookingId);
  });

  conn.ready = (async () => {
    await client.login({ token: opts.token });
    // Presence, metadata and locks are unused here, and asking for them fails on
    // projects where only messaging is enabled.
    await client.subscribe(opts.channel, {
      withMessage: true,
      withPresence: false,
      withMetadata: false,
      withLock: false,
    });
    return true;
  })().catch((err: unknown) => {
    console.error("[captions] Agora Signaling unavailable", err);
    // A failed connection must not be reused by the next mount.
    connections.delete(key);
    return false;
  });

  connections.set(key, conn);
  return conn;
}

function acquire(
  key: string,
  opts: { appId: string; channel: string; uid: string; token: string; bookingId: string },
): SharedConnection {
  const existing = connections.get(key);
  if (!existing) return connect(key, opts);

  // Reclaim a connection that was about to be dropped.
  if (existing.pendingTeardown) {
    clearTimeout(existing.pendingTeardown);
    existing.pendingTeardown = null;
  }
  // A remount arrives with a freshly minted token; hand it to the live client
  // rather than reconnecting, which would trip the login rate limit.
  if (existing.token !== opts.token) {
    existing.token = opts.token;
    void existing.ready.then((ok) => {
      if (!ok) return;
      existing.client.renewToken(opts.token).catch((err: unknown) => {
        console.error("[captions] failed to hand a new Signaling token to the client", err);
      });
    });
  }
  return existing;
}

function release(key: string, channel: string): void {
  const conn = connections.get(key);
  if (!conn || conn.mounts > 0 || conn.pendingTeardown) return;

  conn.pendingTeardown = setTimeout(() => {
    // Someone may have re-acquired it in the meantime.
    if (conn.mounts > 0) {
      conn.pendingTeardown = null;
      return;
    }
    connections.delete(key);
    void conn.ready.then(async (ok) => {
      if (!ok) return;
      try {
        await conn.client.unsubscribe(channel);
      } catch {
        // Already gone — nothing to undo.
      }
      try {
        await conn.client.logout();
      } catch {
        // Same: not logged in, so there is nothing to log out of.
      }
    });
  }, TEARDOWN_DELAY_MS);
}

export function useRtmChannel({
  appId,
  channel,
  uid,
  rtmToken,
  bookingId,
  onMessage,
}: UseRtmChannelOptions): RtmChannel {
  const [connected, setConnected] = useState(false);
  // Failure is remembered per credential set (rather than reset in the effect)
  // so a new token clears it without an extra render pass.
  const [failedFor, setFailedFor] = useState<string | null>(null);
  const clientRef = useRef<RTMClient | null>(null);

  const credentials = `${appId}|${channel}|${uid}`;
  const credentialsMissing = !appId || !channel || !uid || !rtmToken;
  const failed = credentialsMissing || failedFor === credentials;

  // Callbacks and values that must not restart the connection live in refs:
  // the effect below is keyed only on the room identity.
  const onMessageRef = useRef(onMessage);
  const bookingIdRef = useRef(bookingId);
  const tokenRef = useRef(rtmToken);
  useEffect(() => {
    onMessageRef.current = onMessage;
    bookingIdRef.current = bookingId;
    tokenRef.current = rtmToken;
  }, [onMessage, bookingId, rtmToken]);

  useEffect(() => {
    // Nothing to connect with (e.g. Signaling not configured server-side);
    // `failed` already reflects that.
    if (credentialsMissing) return;

    const conn = acquire(credentials, {
      appId,
      channel,
      uid,
      token: tokenRef.current,
      bookingId: bookingIdRef.current,
    });
    conn.mounts += 1;

    let cancelled = false;
    const handleMessage: MessageHandler = (publisherId, msg) => {
      onMessageRef.current(publisherId, msg);
    };
    const handleStatus: StatusHandler = (isConnected) => {
      if (!cancelled) setConnected(isConnected);
    };
    conn.messageHandlers.add(handleMessage);
    conn.statusHandlers.add(handleStatus);

    void conn.ready.then((ok) => {
      if (cancelled) return;
      if (ok) {
        clientRef.current = conn.client;
        setConnected(true);
      } else {
        setFailedFor(credentials);
      }
    });

    return () => {
      cancelled = true;
      conn.messageHandlers.delete(handleMessage);
      conn.statusHandlers.delete(handleStatus);
      conn.mounts -= 1;
      clientRef.current = null;
      setConnected(false);
      release(credentials, channel);
    };
  }, [appId, channel, uid, credentials, credentialsMissing]);

  const publish = useCallback(
    (msg: RoomMessage) => {
      const client = clientRef.current;
      // Captions are ephemeral: if we are not connected the line is simply
      // dropped rather than queued, so nobody gets stale text on reconnect.
      if (!client) return;
      client.publish(channel, JSON.stringify(msg)).catch((err: unknown) => {
        console.error("[captions] failed to publish room message", err);
      });
    },
    [channel],
  );

  return { publish, connected, failed };
}

/** Fetch a fresh Signaling token and hand it to the SDK before the old one dies. */
async function renewToken(conn: SharedConnection, bookingId: string): Promise<void> {
  try {
    const res = await fetch("/api/agora/token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookingId }),
    });
    if (!res.ok) throw new Error(`token endpoint returned ${res.status}`);
    const data: { rtmToken?: string } = await res.json();
    if (!data.rtmToken) throw new Error("token endpoint returned no rtmToken");
    await conn.client.renewToken(data.rtmToken);
    conn.token = data.rtmToken;
  } catch (err) {
    // Losing the renewal only costs captions: the RTC call has its own token.
    console.error("[captions] failed to renew Signaling token", err);
  }
}
