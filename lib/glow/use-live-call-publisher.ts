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

  const cleanupPublisher = useCallback(() => {
    stopMediaStream(streamRef.current);
    streamRef.current = null;
    closePeerConnection(pcRef.current);
    pcRef.current = null;
    callIdRef.current = null;
    setIsLive(false);
    setPublishRequest(null);
    setPublishing(false);
  }, []);

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

  const startPublishing = useCallback(
    async (callId: string, includeAudio: boolean) => {
      if (!devicePublicId || publishing) return;
      setPublishing(true);
      setPublishError(null);

      try {
        const stream = await requestPublisherMedia(includeAudio);
        streamRef.current = stream;

        const pc = createPeerConnection((candidate) => {
          sendSignal(callId, { type: 'ice', candidate });
        });
        pcRef.current = pc;
        addLocalTracks(pc, stream);

        const offerSdp = await createPublisherOffer(pc);
        emit('webrtc:publish_ready', { roomCode, callId });
        sendSignal(callId, { type: 'offer', sdp: offerSdp });

        callIdRef.current = callId;
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
    [devicePublicId, publishing, sendSignal, emit, roomCode, cleanupPublisher]
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
        if (payload.callId !== callIdRef.current || !pcRef.current || !streamRef.current) return;
        void (async () => {
          closePeerConnection(pcRef.current);
          const pc = createPeerConnection((candidate) => {
            sendSignal(payload.callId, { type: 'ice', candidate });
          });
          pcRef.current = pc;
          addLocalTracks(pc, streamRef.current!);
          const offerSdp = await createPublisherOffer(pc);
          sendSignal(payload.callId, { type: 'offer', sdp: offerSdp });
        })();
      }),
      on('room:closed', () => {
        cleanupPublisher();
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub?.());
      cleanupPublisher();
    };
  }, [joined, devicePublicId, on, cleanupPublisher, sendSignal]);

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
