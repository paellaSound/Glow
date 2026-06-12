'use client';

/**
 * YouTube mode base layer for the visuals surface.
 *
 * Renders a chrome-less, fullscreen-cropped YouTube IFrame player driven
 * entirely by server state (visuals:youtube events). The DJ never interacts
 * with the player directly — a transparent shield blocks all pointer events
 * so YouTube UI is unreachable.
 *
 * Autoplay policy: the player always boots muted. Once the user has produced
 * a gesture on the surface (any pointerdown/keydown), the desired mute/volume
 * state is applied.
 */

import { useEffect, useRef, useState } from 'react';

export type YoutubeVisualsState = {
  videoId: string | null;
  queue: { videoId: string; title?: string }[];
  queueIndex: number;
  playing: boolean;
  muted: boolean;
  volume: number;
  seekToSec?: number | null;
  updatedAt: number;
};

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadIframeApi(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.YT?.Player) return Promise.resolve();
  if (!apiPromise) {
    apiPromise = new Promise<void>((resolve) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve();
      };
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    });
  }
  return apiPromise;
}

export function YoutubeSurface({ state }: { state: YoutubeVisualsState | null }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [gestureDone, setGestureDone] = useState(false);
  const lastSeekRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;

  // Unlock audio on the first user gesture anywhere on the surface
  useEffect(() => {
    if (gestureDone) return;
    const unlock = () => setGestureDone(true);
    window.addEventListener('pointerdown', unlock, { once: true });
    window.addEventListener('keydown', unlock, { once: true });
    return () => {
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [gestureDone]);

  // Create the player once
  useEffect(() => {
    let cancelled = false;
    void loadIframeApi().then(() => {
      if (cancelled || !hostRef.current || playerRef.current) return;
      playerRef.current = new window.YT.Player(hostRef.current, {
        videoId: stateRef.current?.videoId ?? undefined,
        playerVars: {
          autoplay: 1,
          controls: 0,
          rel: 0,
          modestbranding: 1,
          iv_load_policy: 3,
          playsinline: 1,
          disablekb: 1,
          fs: 0,
          loop: 0,
        },
        events: {
          onReady: () => {
            playerRef.current?.mute(); // always boot muted (autoplay policy)
            setReady(true);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, []);

  // Apply server state to the player
  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player || !state) return;

    if (state.videoId) {
      const currentId = player.getVideoData?.()?.video_id;
      if (currentId !== state.videoId) {
        player.loadVideoById(state.videoId);
        lastSeekRef.current = null;
      }
    }

    if (state.playing) player.playVideo?.();
    else player.pauseVideo?.();

    // Mute/volume — only unmute after a user gesture
    if (state.muted || !gestureDone) player.mute?.();
    else player.unMute?.();
    player.setVolume?.(state.volume);

    // One-shot seek: dedupe on updatedAt so re-renders don't re-seek
    if (
      typeof state.seekToSec === 'number' &&
      lastSeekRef.current !== state.updatedAt
    ) {
      lastSeekRef.current = state.updatedAt;
      player.seekTo?.(state.seekToSec, true);
    }
  }, [state, ready, gestureDone]);

  const wantsSound = Boolean(state && !state.muted);

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* Oversized + centered to crop YouTube's title/gradient edges (cover fit) */}
      <div className="absolute left-1/2 top-1/2 aspect-video h-[120%] min-w-[120%] -translate-x-1/2 -translate-y-1/2">
        <div ref={hostRef} className="h-full w-full" />
      </div>
      {/* Shield: block every interaction with the YouTube UI */}
      <div className="absolute inset-0 z-[5]" />
      {wantsSound && !gestureDone && (
        <div className="absolute bottom-6 left-1/2 z-[6] -translate-x-1/2 rounded-full border border-white/20 bg-black/70 px-4 py-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-300">
            Tap anywhere to enable sound
          </p>
        </div>
      )}
    </div>
  );
}
