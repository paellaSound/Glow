'use client';

import { useEffect } from 'react';

export function WakeLock() {
  useEffect(() => {
    let wakeLock: WakeLockSentinel | null = null;
    let disposed = false;

    async function requestWakeLock() {
      try {
        if (!('wakeLock' in navigator)) return;
        if (document.visibilityState !== 'visible') return;
        if (wakeLock && !wakeLock.released) return;

        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => {
          if (!disposed && document.visibilityState === 'visible') {
            void requestWakeLock();
          }
        });
      } catch {
        // Best effort only — some browsers require a user gesture first
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void requestWakeLock();
      } else {
        void wakeLock?.release();
        wakeLock = null;
      }
    }

    function handleUserGesture() {
      void requestWakeLock();
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('pointerdown', handleUserGesture);
    document.addEventListener('touchstart', handleUserGesture, { passive: true });
    void requestWakeLock();

    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('pointerdown', handleUserGesture);
      document.removeEventListener('touchstart', handleUserGesture);
      void wakeLock?.release();
    };
  }, []);

  return null;
}
