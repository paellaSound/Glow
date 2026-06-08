'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  VISUALS_VIEWER_ID,
  addIceCandidate,
  applyRemoteDescription,
  closePeerConnection,
  createPeerConnection,
  createPublisherOffer,
  addLocalTracks,
  requestPublisherMedia,
  stopMediaStream,
} from './webrtc';
import type { WebrtcSignal } from './types';

const ICE_DISCONNECTED_GRACE_MS = 3000;
const ICE_RESTART_MAX_ATTEMPTS = 3;
const SURFACE_RECONNECT_COOLDOWN_MS = 5000;
const RECOVERY_COOLDOWN_MS = 2000;

type PublishRequest = {
  callId: string;
  withAudio: boolean;
};

type UseLiveCallPublisherOptions = {
  roomCode: string;
  devicePublicId: string | null;
  joined: boolean;
  emit: (event: string, payload: unknown) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => (() => void) | undefined;
};

export function useLiveCallPublisher({
  roomCode,
  devicePublicId,
  joined,
  emit,
  on,
}: UseLiveCallPublisherOptions) {
  const [publishRequest, setPublishRequest] = useState<PublishRequest | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [withAudio, setWithAudio] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);

  const callIdRef = useRef<string | null>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const iceRestartAttemptsRef = useRef(0);
  const disconnectedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recoveryLockRef = useRef(false);
  const lastSurfaceReconnectRef = useRef(0);
  const lastRecoveryAtRef = useRef(0);
  const handleIceStateChangeRef = useRef<(state: RTCIceConnectionState) => void>(() => {});
  const handleConnectionStateChangeRef =
    useRef<(state: RTCPeerConnectionState) => void>(() => {});

  const clearDisconnectedTimer = useCallback(() => {
    if (disconnectedTimerRef.current) {
      clearTimeout(disconnectedTimerRef.current);
      disconnectedTimerRef.current = null;
    }
  }, []);

  const cleanupPublisher = useCallback(() => {
    clearDisconnectedTimer();
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    closePeerConnection(pcRef.current);
    pcRef.current = null;
    callIdRef.current = null;
    iceRestartAttemptsRef.current = 0;
    recoveryLockRef.current = false;
    setIsLive(false);
    setPublishRequest(null);
    setPublishing(false);
  }, [clearDisconnectedTimer]);

  const sendSignal = useCallback(
    (callId: string, signal: WebrtcSignal) => {
      if (!devicePublicId) return;
      emit('webrtc:signal', {
        callId,
        from: devicePublicId,
        to: VISUALS_VIEWER_ID,
        signal,
      });
    },
    [devicePublicId, emit]
  );

  const sendOffer = useCallback(
    async (callId: string, options?: { iceRestart?: boolean; recreatePc?: boolean }) => {
      const stream = streamRef.current;
      if (!stream) return;

      if (options?.recreatePc) {
        closePeerConnection(pcRef.current);
        pcRef.current = null;
      }

      let pc = pcRef.current;
      if (!pc) {
        pc = await createPeerConnection({
          onIceCandidate: (candidate) => {
            sendSignal(callId, { type: 'ice', candidate });
          },
          onIceConnectionStateChange: (state) => {
            handleIceStateChangeRef.current(state);
          },
          onConnectionStateChange: (state) => {
            handleConnectionStateChangeRef.current(state);
          },
        });
        pcRef.current = pc;
        addLocalTracks(pc, stream);
      }

      const offerSdp = await createPublisherOffer(pc, { iceRestart: options?.iceRestart });
      sendSignal(callId, { type: 'offer', sdp: offerSdp });
    },
    [sendSignal]
  );

  const runRecovery = useCallback(
    async (mode: 'ice_restart' | 'recreate') => {
      const callId = callIdRef.current;
      if (!callId || !streamRef.current || recoveryLockRef.current) return;

      const now = Date.now();
      if (now - lastRecoveryAtRef.current < RECOVERY_COOLDOWN_MS) return;
      lastRecoveryAtRef.current = now;

      recoveryLockRef.current = true;
      try {
        if (mode === 'ice_restart') {
          iceRestartAttemptsRef.current += 1;
          await sendOffer(callId, { iceRestart: true });
        } else {
          iceRestartAttemptsRef.current = 0;
          await sendOffer(callId, { recreatePc: true });
        }
      } catch {
        // Recovery failed; viewer may send a new offer path via surface_reconnect
      } finally {
        recoveryLockRef.current = false;
      }
    },
    [sendOffer]
  );

  const handleIceStateChange = useCallback(
    (state: RTCIceConnectionState) => {
      const callId = callIdRef.current;
      if (!callId) return;

      if (state === 'connected' || state === 'completed') {
        clearDisconnectedTimer();
        iceRestartAttemptsRef.current = 0;
        return;
      }

      if (state === 'disconnected') {
        clearDisconnectedTimer();
        disconnectedTimerRef.current = setTimeout(() => {
          const pc = pcRef.current;
          if (!pc || pc.iceConnectionState !== 'disconnected') return;
          void runRecovery('ice_restart');
        }, ICE_DISCONNECTED_GRACE_MS);
        return;
      }

      if (state === 'failed') {
        clearDisconnectedTimer();
        if (iceRestartAttemptsRef.current < ICE_RESTART_MAX_ATTEMPTS) {
          void runRecovery('ice_restart');
        } else {
          void runRecovery('recreate');
        }
      }
    },
    [clearDisconnectedTimer, runRecovery]
  );

  const handleConnectionStateChange = useCallback(
    (state: RTCPeerConnectionState) => {
      if (state === 'connected') {
        iceRestartAttemptsRef.current = 0;
      }
      if (state === 'failed') {
        const callId = callIdRef.current;
        if (!callId) return;
        if (iceRestartAttemptsRef.current < ICE_RESTART_MAX_ATTEMPTS) {
          void runRecovery('ice_restart');
        } else {
          void runRecovery('recreate');
        }
      }
    },
    [runRecovery]
  );

  handleIceStateChangeRef.current = handleIceStateChange;
  handleConnectionStateChangeRef.current = handleConnectionStateChange;

  const reofferIdempotent = useCallback(() => {
    const callId = callIdRef.current;
    if (!callId || !pcRef.current || !streamRef.current || recoveryLockRef.current) return;
    void sendOffer(callId, { iceRestart: false });
  }, [sendOffer]);

  const handleSurfaceReconnect = useCallback(() => {
    const callId = callIdRef.current;
    if (!callId || !streamRef.current) return;

    const now = Date.now();
    if (now - lastSurfaceReconnectRef.current < SURFACE_RECONNECT_COOLDOWN_MS) return;
    lastSurfaceReconnectRef.current = now;

    if (recoveryLockRef.current) return;
    void sendOffer(callId, { recreatePc: true });
  }, [sendOffer]);

  const startPublishing = useCallback(
    async (callId: string, includeAudio: boolean) => {
      if (!devicePublicId || publishing) return;
      setPublishing(true);
      setPublishError(null);

      try {
        const stream = await requestPublisherMedia(includeAudio);
        streamRef.current = stream;
        callIdRef.current = callId;
        iceRestartAttemptsRef.current = 0;

        await sendOffer(callId);
        emit('webrtc:publish_ready', { roomCode, callId });

        setIsLive(true);
        setPublishRequest(null);
      } catch (err: unknown) {
        setPublishError(
          err instanceof Error ? err.message : 'Could not access camera or microphone.'
        );
        cleanupPublisher();
      } finally {
        setPublishing(false);
      }
    },
    [devicePublicId, publishing, sendOffer, emit, roomCode, cleanupPublisher]
  );

  const handleAllow = useCallback(() => {
    if (!publishRequest) return;
    void startPublishing(publishRequest.callId, withAudio);
  }, [publishRequest, withAudio, startPublishing]);

  const handleDecline = useCallback(() => {
    if (!publishRequest) return;
    emit('player:live_decline', { roomCode, callId: publishRequest.callId });
    setPublishRequest(null);
  }, [publishRequest, emit, roomCode]);

  const handleStop = useCallback(() => {
    const callId = callIdRef.current;
    if (callId) {
      emit('player:live_stop', { roomCode, callId });
    }
    cleanupPublisher();
  }, [emit, roomCode, cleanupPublisher]);

  useEffect(() => {
    if (!joined || !devicePublicId) return;

    const unsubscribers = [
      on('webrtc:publish_request', (event) => {
        const payload = event as { callId: string; withAudio?: boolean };
        if (!payload.callId) return;
        setPublishRequest({
          callId: payload.callId,
          withAudio: Boolean(payload.withAudio),
        });
        setWithAudio(false);
        setPublishError(null);
      }),
      on('webrtc:signal', (event) => {
        const payload = event as {
          callId: string;
          from: string;
          to: string;
          signal: WebrtcSignal;
        };
        if (!pcRef.current || payload.callId !== callIdRef.current) return;
        if (payload.to !== devicePublicId) return;

        const { signal } = payload;
        if (signal.type === 'answer') {
          void applyRemoteDescription(pcRef.current, 'answer', signal.sdp);
        } else if (signal.type === 'ice') {
          void addIceCandidate(pcRef.current, signal.candidate);
        }
      }),
      on('webrtc:publish_stop', (event) => {
        const payload = event as { callId: string };
        if (payload.callId === callIdRef.current) {
          cleanupPublisher();
        }
      }),
      on('webrtc:surface_reconnect', (event) => {
        const payload = event as { callId: string };
        if (payload.callId !== callIdRef.current) return;
        handleSurfaceReconnect();
      }),
      on('room:closed', () => {
        cleanupPublisher();
      }),
    ];

    const onOnline = () => {
      if (callIdRef.current && streamRef.current) {
        reofferIdempotent();
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && callIdRef.current && streamRef.current) {
        reofferIdempotent();
      }
    };

    window.addEventListener('online', onOnline);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      unsubscribers.forEach((unsub) => unsub?.());
      window.removeEventListener('online', onOnline);
      document.removeEventListener('visibilitychange', onVisibility);
      cleanupPublisher();
    };
  }, [
    joined,
    devicePublicId,
    on,
    cleanupPublisher,
    handleSurfaceReconnect,
    reofferIdempotent,
  ]);

  return {
    publishRequest,
    isLive,
    withAudio,
    setWithAudio,
    publishing,
    publishError,
    handleAllow,
    handleDecline,
    handleStop,
  };
}
