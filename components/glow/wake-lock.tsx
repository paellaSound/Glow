'use client';

import { useEffect } from 'react';

export function WakeLock() {
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;

    async function requestWakeLock() {
      try {
        if ('wakeLock' in navigator) {
          wakeLock = await navigator.wakeLock.request('screen');
        }
      } catch {
        // Best effort only
      }
    }

    void requestWakeLock();

    return () => {
      void wakeLock?.release();
    };
  }, []);

  return null;
}
