'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { Socket } from 'socket.io-client';
import type {
  DeviceTarget,
  LiveCallStatePayload,
  RoomStatePayload,
  PlanEntitlements,
} from '@/lib/glow/types';
import { buildLayoutPreset, type LiveLayoutPreset } from '@/lib/glow/webrtc';

export interface LiveCallDeskContextType {
  target: DeviceTarget;
  setTarget: (target: DeviceTarget) => void;
  liveState: LiveCallStatePayload | null;
  setLiveState: (state: LiveCallStatePayload | null) => void;
  layoutPreset: LiveLayoutPreset;
  setLayoutPreset: (preset: LiveLayoutPreset) => void;
  starting: boolean;
  error: string | null;
  selectedIds: string[];
  handleGoLive: () => Promise<void>;
  handleStopAll: () => void;
  handleStopOne: (publicId: string) => void;
  handleApplyLayout: () => void;
}

const LiveCallDeskContext = createContext<LiveCallDeskContextType | null>(null);

function resolveDevicePublicIds(
  devices: Array<{ publicId: string; joinedAt: number }>,
  target: DeviceTarget
): string[] {
  if (target.kind === 'all') return devices.map((d) => d.publicId);
  if (target.kind === 'devices') return target.publicIds;
  if (target.kind === 'fraction') {
    const sorted = [...devices].sort(
      (a, b) => a.joinedAt - b.joinedAt || a.publicId.localeCompare(b.publicId)
    );
    const start = Math.floor(target.from * sorted.length);
    const end = Math.min(sorted.length, Math.round(target.to * sorted.length));
    return sorted.slice(start, end).map((d) => d.publicId);
  }
  return [];
}

export function LiveCallDeskProvider({
  roomCode,
  roomState,
  entitlements,
  socket,
  connected,
  children,
}: {
  roomCode: string;
  roomState: RoomStatePayload | null;
  entitlements: PlanEntitlements;
  socket: React.MutableRefObject<Socket | null>;
  connected: boolean;
  children: React.ReactNode;
}) {
  const code = roomCode.toUpperCase();
  const gated = !entitlements.webrtcLiveCall;
  const maxDevices = entitlements.maxLiveCallDevices;

  const [target, setTarget] = useState<DeviceTarget>({ kind: 'devices', publicIds: [] });
  const [liveState, setLiveState] = useState<LiveCallStatePayload | null>(null);
  const [layoutPreset, setLayoutPreset] = useState<LiveLayoutPreset>('pip');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state from server on mount/connection
  useEffect(() => {
    const s = socket.current;
    if (!s || !connected) return;

    // Resync current live call state
    s.emit(
      'orchestrator:get_live_call_state',
      { roomCode: code },
      (response: LiveCallStatePayload | null) => {
        if (response) {
          setLiveState(response);
        }
      }
    );

    const onState = (payload: LiveCallStatePayload) => {
      setLiveState(payload);
    };

    s.on('orchestrator:live_call_state', onState);
    return () => {
      s.off('orchestrator:live_call_state', onState);
    };
  }, [socket, connected, code]);

  const selectedIds = useMemo(
    () => {
      if (!roomState) return [];
      return resolveDevicePublicIds(roomState.devices, target).slice(0, maxDevices);
    },
    [roomState, target, maxDevices]
  );

  const handleGoLive = useCallback(async () => {
    if (gated || !connected || selectedIds.length === 0) return;
    setStarting(true);
    setError(null);

    try {
      const s = socket.current;
      if (!s) throw new Error('Socket not connected');

      s.timeout(10_000).emit(
        'orchestrator:live_call_start',
        { roomCode: code, publisherIds: selectedIds },
        (err: Error | null, response: { ok: boolean; reason?: string; callId?: string }) => {
          setStarting(false);
          if (err) {
            setError('Request timed out');
            return;
          }
          if (!response.ok) {
            const messages: Record<string, string> = {
              gated: 'Live call requires a Pro plan.',
              over_cap: `Maximum ${maxDevices} devices per live call.`,
              no_publishers: 'Select at least one device.',
              no_connected_publishers: 'Selected devices are not connected.',
            };
            setError(messages[response.reason ?? ''] ?? 'Could not start live call.');
            return;
          }
          if (response.callId) {
            const tiles = buildLayoutPreset(selectedIds, layoutPreset);
            s.emit('orchestrator:live_layout', { roomCode: code, tiles });
          }
        }
      );
    } catch (e: unknown) {
      setStarting(false);
      setError(e instanceof Error ? e.message : 'Could not start live call.');
    }
  }, [gated, connected, selectedIds, socket, code, layoutPreset, maxDevices]);

  const handleStopAll = useCallback(() => {
    socket.current?.emit('orchestrator:live_call_stop', { roomCode: code });
    setLiveState(null);
  }, [socket, code]);

  const handleStopOne = useCallback(
    (publicId: string) => {
      socket.current?.emit('orchestrator:live_call_stop', {
        roomCode: code,
        publisherIds: [publicId],
      });
    },
    [socket, code]
  );

  const handleApplyLayout = useCallback(() => {
    if (!liveState?.active) return;
    const liveIds = liveState.publishers
      .filter((p) => p.status === 'live')
      .map((p) => p.publicId);
    if (liveIds.length === 0) return;
    const tiles = buildLayoutPreset(liveIds, layoutPreset);
    socket.current?.emit('orchestrator:live_layout', { roomCode: code, tiles });
  }, [liveState, layoutPreset, socket, code]);

  const contextValue = useMemo(() => ({
    target,
    setTarget,
    liveState,
    setLiveState,
    layoutPreset,
    setLayoutPreset,
    starting,
    error,
    selectedIds,
    handleGoLive,
    handleStopAll,
    handleStopOne,
    handleApplyLayout,
  }), [
    target,
    liveState,
    layoutPreset,
    starting,
    error,
    selectedIds,
    handleGoLive,
    handleStopAll,
    handleStopOne,
    handleApplyLayout,
  ]);

  return (
    <LiveCallDeskContext.Provider value={contextValue}>
      {children}
    </LiveCallDeskContext.Provider>
  );
}

export function useLiveCallDesk() {
  const context = useContext(LiveCallDeskContext);
  if (!context) {
    throw new Error('useLiveCallDesk must be used within a LiveCallDeskProvider');
  }
  return context;
}
