'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  measureOneWayLatency,
  measureOrchestratorMessageDelay,
} from './orchestrator-delay';

type UseOrchestratorDelayOptions = {
  connected: boolean;
  enabled: boolean;
  emit: (event: string, payload: unknown) => void;
  on: (event: string, handler: (...args: unknown[]) => void) => (() => void) | undefined;
};

const PING_INTERVAL_MS = 3000;

export function useOrchestratorDelay({
  connected,
  enabled,
  emit,
  on,
}: UseOrchestratorDelayOptions) {
  const [delayMs, setDelayMs] = useState<number | null>(null);

  const trackOrchestratorMessage = useCallback(
    (targetTimestamp: number, seedTimestamp?: number) => {
      setDelayMs(measureOrchestratorMessageDelay(targetTimestamp, seedTimestamp));
    },
    []
  );

  useEffect(() => {
    if (!connected || !enabled) {
      setDelayMs(null);
      return;
    }

    const ping = () => emit('latency:ping', { sentAt: Date.now() });
    ping();
    const pingInterval = window.setInterval(ping, PING_INTERVAL_MS);

    const unsubPong = on('latency:pong', (payload) => {
      const { sentAt } = payload as { sentAt: number; serverTime: number };
      setDelayMs(measureOneWayLatency(sentAt));
    });

    return () => {
      window.clearInterval(pingInterval);
      unsubPong?.();
    };
  }, [connected, enabled, emit, on]);

  return { delayMs, trackOrchestratorMessage };
}
