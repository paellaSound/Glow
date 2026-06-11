'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Socket } from 'socket.io-client';
import {
  VISUALS_VIEWER_ID,
  addIceCandidate,
  applyRemoteDescription,
  closePeerConnection,
  createPeerConnection,
  createViewerAnswer,
} from './webrtc';
import type { LiveTile, WebrtcSignal } from './types';

const FAILED_CLEANUP_DELAY_MS = 8000;

type UseLiveCallViewerOptions = {
  socketRef: React.MutableRefObject<Socket | null>;
  subscribed: boolean;
};

type SignalingTask = () => Promise<void>;

export function useLiveCallViewer({ socketRef, subscribed }: UseLiveCallViewerOptions) {
  const [tiles, setTiles] = useState<LiveTile[]>([]);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});

  const callIdRef = useRef<string | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const signalQueuesRef = useRef<Map<string, Promise<void>>>(new Map());
  const failedTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const sendSignal = useCallback(
    (callId: string, to: string, signal: WebrtcSignal) => {
      socketRef.current?.emit('webrtc:signal', {
        callId,
        from: VISUALS_VIEWER_ID,
        to,
        signal,
      });
    },
    [socketRef]
  );

  const clearFailedTimer = useCallback((publicId: string) => {
    const timer = failedTimersRef.current.get(publicId);
    if (timer) {
      clearTimeout(timer);
      failedTimersRef.current.delete(publicId);
    }
  }, []);

  const removePublisher = useCallback(
    (publicId: string, options?: { keepStreamDuringRecovery?: boolean }) => {
      clearFailedTimer(publicId);
      signalQueuesRef.current.delete(publicId);

      const pc = pcsRef.current.get(publicId);
      if (pc) {
        closePeerConnection(pc);
        pcsRef.current.delete(publicId);
      }

      if (options?.keepStreamDuringRecovery) return;

      setStreams((prev) => {
        if (!prev[publicId]) return prev;
        const next = { ...prev };
        delete next[publicId];
        return next;
      });
    },
    [clearFailedTimer]
  );

  const cleanupAll = useCallback(() => {
    for (const publicId of pcsRef.current.keys()) {
      removePublisher(publicId);
    }
    pcsRef.current.clear();
    signalQueuesRef.current.clear();
    for (const timer of failedTimersRef.current.values()) {
      clearTimeout(timer);
    }
    failedTimersRef.current.clear();
    callIdRef.current = null;
    setStreams({});
    setTiles([]);
  }, [removePublisher]);

  const enqueueSignaling = useCallback((publicId: string, task: SignalingTask) => {
    const previous = signalQueuesRef.current.get(publicId) ?? Promise.resolve();
    const next = previous
      .catch(() => undefined)
      .then(() => task())
      .catch(() => undefined);
    signalQueuesRef.current.set(publicId, next);
    return next;
  }, []);

  const scheduleFailedCleanup = useCallback(
    (publicId: string) => {
      clearFailedTimer(publicId);
      const timer = setTimeout(() => {
        const pc = pcsRef.current.get(publicId);
        if (
          pc &&
          (pc.connectionState === 'failed' ||
            pc.connectionState === 'closed' ||
            pc.iceConnectionState === 'failed' ||
            pc.iceConnectionState === 'closed')
        ) {
          removePublisher(publicId);
        }
        failedTimersRef.current.delete(publicId);
      }, FAILED_CLEANUP_DELAY_MS);
      failedTimersRef.current.set(publicId, timer);
    },
    [clearFailedTimer, removePublisher]
  );

  const attachConnectionHandlers = useCallback(
    (publicId: string, pc: RTCPeerConnection) => {
      pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (stream) {
          clearFailedTimer(publicId);
          setStreams((prev) => ({ ...prev, [publicId]: stream }));
        }
      };

      pc.oniceconnectionstatechange = () => {
        const state = pc.iceConnectionState;
        if (state === 'connected' || state === 'completed') {
          clearFailedTimer(publicId);
          return;
        }
        if (state === 'disconnected') {
          // Keep tile/stream during transient network changes; publisher will ICE-restart
          return;
        }
        if (state === 'failed' || state === 'closed') {
          removePublisher(publicId, { keepStreamDuringRecovery: true });
          scheduleFailedCleanup(publicId);
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') {
          clearFailedTimer(publicId);
          return;
        }
        if (state === 'disconnected') {
          return;
        }
        if (state === 'failed' || state === 'closed') {
          removePublisher(publicId, { keepStreamDuringRecovery: true });
          scheduleFailedCleanup(publicId);
        }
      };
    },
    [clearFailedTimer, removePublisher, scheduleFailedCleanup]
  );

  const ensurePeerConnection = useCallback(
    async (publicId: string, callId: string): Promise<RTCPeerConnection> => {
      let pc = pcsRef.current.get(publicId);
      if (pc && pc.connectionState !== 'closed') return pc;

      if (pc) {
        closePeerConnection(pc);
        pcsRef.current.delete(publicId);
      }

      pc = await createPeerConnection({
        onIceCandidate: (candidate) => {
          sendSignal(callId, publicId, { type: 'ice', candidate });
        },
      });
      attachConnectionHandlers(publicId, pc);
      pcsRef.current.set(publicId, pc);
      return pc;
    },
    [sendSignal, attachConnectionHandlers]
  );

  const handleOffer = useCallback(
    async (publicId: string, callId: string, offerSdp: string) => {
      let pc = pcsRef.current.get(publicId);
      if (!pc || pc.signalingState === 'closed' || pc.connectionState === 'closed') {
        pc = await ensurePeerConnection(publicId, callId);
      }

      const answerSdp = await createViewerAnswer(pc, offerSdp);
      sendSignal(callId, publicId, { type: 'answer', sdp: answerSdp });
    },
    [ensurePeerConnection, sendSignal]
  );

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !subscribed) return;

    const onLayout = (payload: { tiles: LiveTile[]; callId?: string }) => {
      const nextTiles = Array.isArray(payload.tiles) ? payload.tiles : [];
      if (payload.callId) callIdRef.current = payload.callId;

      const activeIds = new Set(nextTiles.map((t) => t.publicId));
      for (const publicId of pcsRef.current.keys()) {
        if (!activeIds.has(publicId)) {
          removePublisher(publicId);
        }
      }

      if (nextTiles.length === 0) {
        cleanupAll();
        return;
      }

      setTiles(nextTiles);
    };

    const onSignal = (payload: {
      callId: string;
      from: string;
      to: string;
      signal: WebrtcSignal;
    }) => {
      if (payload.to !== VISUALS_VIEWER_ID) return;
      if (payload.from === VISUALS_VIEWER_ID) return;

      callIdRef.current = payload.callId;
      const publicId = payload.from;
      const { signal } = payload;

      void enqueueSignaling(publicId, async () => {
        if (signal.type === 'offer') {
          await handleOffer(publicId, payload.callId, signal.sdp);
        } else {
          const pc =
            pcsRef.current.get(publicId) ??
            (await ensurePeerConnection(publicId, payload.callId));

          if (signal.type === 'ice') {
            await addIceCandidate(pc, signal.candidate);
          } else if (signal.type === 'answer') {
            await applyRemoteDescription(pc, 'answer', signal.sdp);
          }
        }
      });
    };

    const onRoomClosed = () => {
      cleanupAll();
    };

    socket.on('visuals:live_layout', onLayout);
    socket.on('webrtc:signal', onSignal);
    socket.on('room:closed', onRoomClosed);

    return () => {
      socket.off('visuals:live_layout', onLayout);
      socket.off('webrtc:signal', onSignal);
      socket.off('room:closed', onRoomClosed);
      cleanupAll();
    };
  }, [
    socketRef,
    subscribed,
    ensurePeerConnection,
    handleOffer,
    enqueueSignaling,
    removePublisher,
    cleanupAll,
  ]);

  return { tiles, streams };
}
