'use client';

/**
 * YouTube mode base layer for the visuals surface.
 *
 * Renders a chrome-less, fullscreen-cropped YouTube IFrame player driven
 * entirely by server state (visuals:youtube events). The DJ never interacts
 * with the player directly — a transparent shield blocks all pointer events
 * so YouTube UI is unreachable.
 *
 * Video switches are masked by a transition overlay (glitch / dip-black /
 * pixel-melt) so YouTube's loading spinner never shows on the projection.
 * While playing, the surface reports currentTime/duration upstream via
 * `onStatus` so the desk can render a real seek slider.
 *
 * Autoplay policy: the player always boots muted. Once the user has produced
 * a gesture on the surface (any pointerdown/keydown), the desired mute/volume
 * state is applied.
 */

import { useEffect, useRef, useState } from 'react';
import type { YoutubeQueueItem, YoutubeTransitionEffect } from '@/lib/glow/types';

export type YoutubeVisualsState = {
  videoId: string | null;
  queue: YoutubeQueueItem[];
  queueIndex: number;
  playing: boolean;
  muted: boolean;
  volume: number;
  seekToSec?: number | null;
  pendingTransition?: YoutubeTransitionEffect | null;
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

// ── Transition overlay ────────────────────────────────────────────────────

const TRANSITION_CSS = `
@keyframes yt-dip-black {
  0% { opacity: 0; }
  25% { opacity: 1; }
  75% { opacity: 1; }
  100% { opacity: 0; }
}
@keyframes yt-glitch-shift {
  0% { transform: translate(0, 0); clip-path: inset(0 0 85% 0); }
  10% { transform: translate(-12px, 4px); clip-path: inset(30% 0 50% 0); }
  20% { transform: translate(10px, -6px); clip-path: inset(60% 0 20% 0); }
  30% { transform: translate(-8px, 2px); clip-path: inset(10% 0 70% 0); }
  40% { transform: translate(14px, -3px); clip-path: inset(45% 0 35% 0); }
  50% { transform: translate(-10px, 6px); clip-path: inset(75% 0 5% 0); }
  60% { transform: translate(8px, -2px); clip-path: inset(20% 0 60% 0); }
  70% { transform: translate(-14px, 5px); clip-path: inset(55% 0 25% 0); }
  80% { transform: translate(12px, -4px); clip-path: inset(5% 0 80% 0); }
  90% { transform: translate(-6px, 3px); clip-path: inset(40% 0 40% 0); }
  100% { transform: translate(0, 0); clip-path: inset(0 0 85% 0); }
}
@keyframes yt-pixel-melt {
  0% { backdrop-filter: blur(0px) contrast(1); opacity: 0; }
  30% { backdrop-filter: blur(24px) contrast(3); opacity: 1; }
  70% { backdrop-filter: blur(24px) contrast(3); opacity: 1; }
  100% { backdrop-filter: blur(0px) contrast(1); opacity: 0; }
}
`;

function TransitionOverlay({ effect }: { effect: YoutubeTransitionEffect }) {
  if (effect === 'glitch') {
    return (
      <div className="absolute inset-0 z-[8] overflow-hidden bg-black">
        <div
          className="absolute inset-0 bg-[#0ff] mix-blend-screen opacity-40"
          style={{ animation: 'yt-glitch-shift 0.18s steps(2) infinite' }}
        />
        <div
          className="absolute inset-0 bg-[#f0c] mix-blend-screen opacity-40"
          style={{ animation: 'yt-glitch-shift 0.22s steps(3) infinite reverse' }}
        />
        <div
          className="absolute inset-0 bg-white/10"
          style={{ animation: 'yt-glitch-shift 0.13s steps(2) infinite' }}
        />
      </div>
    );
  }
  if (effect === 'pixel-melt') {
    return (
      <div className="absolute inset-0 z-[8]">
        <div
          className="absolute inset-0 bg-black/60"
          style={{ animation: 'yt-pixel-melt 1.4s ease-in-out infinite' }}
        />
      </div>
    );
  }
  // dip-black
  return (
    <div
      className="absolute inset-0 z-[8] bg-black"
      style={{ animation: 'yt-dip-black 1.4s ease-in-out infinite' }}
    />
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export function YoutubeSurface({
  state,
  onStatus,
  onEnded,
}: {
  state: YoutubeVisualsState | null;
  onStatus?: (status: { currentTime: number; duration: number }) => void;
  onEnded?: (videoId: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [gestureDone, setGestureDone] = useState(false);
  const [activeTransition, setActiveTransition] = useState<YoutubeTransitionEffect | null>(null);
  const lastSeekRef = useRef<number | null>(null);
  const lastVideoIdRef = useRef<string | null>(null);
  const transitionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const onEndedRef = useRef(onEnded);
  onEndedRef.current = onEnded;

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

  const endTransition = () => {
    if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
    transitionTimeoutRef.current = setTimeout(() => setActiveTransition(null), 400);
  };

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
          onStateChange: (e: { data: number }) => {
            // 1 = PLAYING — the new video is rendering, drop the mask.
            // Also drop it on PAUSED/CUED so the surface never sticks black.
            if (e.data === 1 || e.data === 2 || e.data === 5) endTransition();
            // 0 = ENDED — let the server advance to the next queued video
            if (e.data === 0) {
              const vid = stateRef.current?.videoId;
              if (vid) onEndedRef.current?.(vid);
            }
          },
          onError: () => endTransition(),
        },
      });
    });
    return () => {
      cancelled = true;
      if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
      playerRef.current?.destroy?.();
      playerRef.current = null;
    };
  }, []);

  // Report playback position upstream (drives the desk seek slider)
  useEffect(() => {
    if (!ready || !onStatus) return;
    const interval = setInterval(() => {
      const player = playerRef.current;
      if (!player?.getDuration) return;
      const duration = player.getDuration() || 0;
      if (duration <= 0) return;
      onStatus({ currentTime: player.getCurrentTime() || 0, duration });
    }, 1000);
    return () => clearInterval(interval);
  }, [ready, onStatus]);

  // Apply server state to the player
  useEffect(() => {
    const player = playerRef.current;
    if (!ready || !player || !state) return;

    if (state.videoId && state.videoId !== lastVideoIdRef.current) {
      const isFirstVideo = lastVideoIdRef.current === null;
      lastVideoIdRef.current = state.videoId;
      const currentId = player.getVideoData?.()?.video_id;
      if (currentId !== state.videoId) {
        // Mask the swap (YouTube spinner) with the queued transition effect
        if (!isFirstVideo) {
          setActiveTransition(state.pendingTransition ?? 'dip-black');
          // Safety net: never leave the mask up more than 5s
          if (transitionTimeoutRef.current) clearTimeout(transitionTimeoutRef.current);
          transitionTimeoutRef.current = setTimeout(() => setActiveTransition(null), 5000);
        }
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
      <style>{TRANSITION_CSS}</style>
      {/* Oversized + centered to crop YouTube's title/gradient edges (cover fit) */}
      <div className="absolute left-1/2 top-1/2 aspect-video h-[120%] min-w-[120%] -translate-x-1/2 -translate-y-1/2">
        <div ref={hostRef} className="h-full w-full" />
      </div>
      {/* Shield: block every interaction with the YouTube UI */}
      <div className="absolute inset-0 z-[5]" />
      {activeTransition && <TransitionOverlay effect={activeTransition} />}
      {wantsSound && !gestureDone && (
        <div className="absolute bottom-6 left-1/2 z-[9] -translate-x-1/2 rounded-full border border-white/20 bg-black/70 px-4 py-2">
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-300">
            Tap anywhere to enable sound
          </p>
        </div>
      )}
    </div>
  );
}
