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

type UseLiveCallViewerOptions = {
  socketRef: React.MutableRefObject<Socket | null>;
  subscribed: boolean;
};

export function useLiveCallViewer({ socketRef, subscribed }: UseLiveCallViewerOptions) {
  const [tiles, setTiles] = useState<LiveTile[]>([]);
  const [streams, setStreams] = useState<Record<string, MediaStream>>({});

  const callIdRef = useRef<string | null>(null);
  const pcsRef = useRef<Map<string, RTCPeerConnection>>(new Map());

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

  const removePublisher = useCallback((publicId: string) => {
    const pc = pcsRef.current.get(publicId);
    if (pc) {
      closePeerConnection(pc);
      pcsRef.current.delete(publicId);
    }
    setStreams((prev) => {
      if (!prev[publicId]) return prev;
      const next = { ...prev };
      delete next[publicId];
      return next;
    });
  }, []);

  const cleanupAll = useCallback(() => {
    for (const [publicId, pc] of pcsRef.current) {
      closePeerConnection(pc);
      pcsRef.current.delete(publicId);
    }
    pcsRef.current.clear();
    callIdRef.current = null;
    setStreams({});
    setTiles([]);
  }, []);

  const ensurePeerConnection = useCallback(
    (publicId: string, callId: string): RTCPeerConnection => {
      let pc = pcsRef.current.get(publicId);
      if (pc) return pc;

      pc = createPeerConnection((candidate) => {
        sendSignal(callId, publicId, { type: 'ice', candidate });
      });

      pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (stream) {
          setStreams((prev) => ({ ...prev, [publicId]: stream }));
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
          removePublisher(publicId);
        }
      };

      pcsRef.current.set(publicId, pc);
      return pc;
    },
    [sendSignal, removePublisher]
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
      const pc = ensurePeerConnection(publicId, payload.callId);

      void (async () => {
        const { signal } = payload;
        if (signal.type === 'offer') {
          const answerSdp = await createViewerAnswer(pc, signal.sdp);
          sendSignal(payload.callId, publicId, { type: 'answer', sdp: answerSdp });
        } else if (signal.type === 'ice') {
          await addIceCandidate(pc, signal.candidate);
        } else if (signal.type === 'answer') {
          await applyRemoteDescription(pc, 'answer', signal.sdp);
        }
      })();
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
  }, [socketRef, subscribed, ensurePeerConnection, sendSignal, removePublisher, cleanupAll]);

  return { tiles, streams };
}
