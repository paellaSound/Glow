'use client';

import { use, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getVisualArt, DEFAULT_VISUAL_ART_ID, EMOJI_GLYPHS } from 'glow-visuals';
import type { VisualsMode } from '@/lib/glow/types';
import { YoutubeSurface, type YoutubeVisualsState } from '@/components/visuals/youtube-surface';
import { ThreeDSurface, type ThreeDAction } from '@/components/visuals/three-d-surface';
import type { VisualArtController, VisualArtInput, VisualArtId, ReactionEmoji } from 'glow-visuals';
import type { AudioFeatures } from 'glow-visuals';
import { useAudioAnalyzer } from '@/lib/glow/audio-analyzer';
import QRCode from 'qrcode';
import { buildPlayerJoinUrl } from '@/lib/glow/join-url';
import { FullscreenButton } from '@/components/glow/fullscreen-button';
import { GlowWatermark } from '@/components/glow/glow-watermark';
import { WakeLock } from '@/components/glow/wake-lock';
import { getRealtimeUrl } from '@/lib/glow/matrix';
import { useLiveCallViewer } from '@/lib/glow/use-live-call-viewer';
import { cn } from '@/lib/utils';
import { NeonCard, NeonTitle, PageTransitionWrapper, SectionGlow } from '@/components/ui/neon';
import { VisualsSequencedTextRenderer } from '@/components/glow/visuals-sequenced-text-renderer';

// ─── Types ────────────────────────────────────────────────────────────────────

type ConnectionState =
  | 'connecting'       // socket connecting
  | 'subscribing'      // socket connected, handshake in-flight
  | 'subscribed'       // joined visuals:{code} topic — receiving events
  | 'token_missing'    // no #token= in URL hash
  | 'token_expired'    // server rejected: token_invalid_or_expired
  | 'room_not_found'   // server rejected: room_not_found
  | 'room_closed';     // room:closed event received

type ScenePayload = {
  artId: string;
  params?: Record<string, unknown>;
  palette?: string[];
  logo?: {
    url: string;
    opacity: number;
    position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    effect?: 'none' | 'pulse' | 'spin' | 'float' | 'neon';
  } | null;
  transition?: 'cut' | 'fade';
  qrConfig?: { enabled: boolean; intervalSeconds: number; durationSeconds: number } | null;
};

// ─── Reaction type ───────────────────────────────────────────────────────────

type Reaction = {
  id: string;
  emoji: string;
  nickname?: string;
  boost: number;
  x: number; // random position excluding center focal point
  count: number;
  receivedAt: number;
};

// ─── Default input ────────────────────────────────────────────────────────────

function makeDefaultInput(roomCode: string): VisualArtInput {
  return {
    timeMs: 0,
    palette: ['#7c3aed', '#06b6d4'],
    roomCode,
  };
}

// ─── Position helper ─────────────────────────────────────────────────────────

function getNonCenterPosition() {
  const isLeft = Math.random() < 0.5;
  if (isLeft) {
    return 10 + Math.random() * 25; // 10% to 35%
  } else {
    return 65 + Math.random() * 25; // 65% to 90%
  }
}

// ─── Main component ──────────────────────────────────────────────────────────

function VisualsContent({ code }: { code: string }) {
  const roomCode = code.toUpperCase();

  const [token, setToken] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('connecting');

  // Current art id
  const [artId, setArtId] = useState<VisualArtId>('audio-shader');
  // Rendering pipeline — 'standard' = 2D arts canvas; other modes swap the base layer
  const [visualsMode, setVisualsMode] = useState<VisualsMode>('standard');
  const [youtubeState, setYoutubeState] = useState<YoutubeVisualsState | null>(null);
  const [threeDEnergy, setThreeDEnergy] = useState(0);
  const [threeDAction, setThreeDAction] = useState<ThreeDAction>(null);
  // Live input for the art (updated by realtime events)
  const inputRef = useRef<VisualArtInput>(makeDefaultInput(roomCode));

  // Local audio analyzer for audio-reactive arts (like audio-shader)
  const isAudioShaderActive = visualsMode === 'standard' && artId === 'audio-shader';
  const isMicEnabled = inputRef.current.params?.micEnabled !== false;
  const localAudio = useAudioAnalyzer({ enabled: isAudioShaderActive && isMicEnabled });

  const localActiveRef = useRef(false);
  useEffect(() => {
    localActiveRef.current = localAudio.active;
  }, [localAudio.active]);

  const [roomClosedReason, setRoomClosedReason] = useState<string>('The DJ has ended the session.');

  const [displayName, setDisplayName] = useState<string>('Glow');
  const [displayNamePosition, setDisplayNamePosition] = useState<
    'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  >('center');

  const [liveText, setLiveText] = useState<{
    text: string;
    mode: 'marquee' | 'word_by_word' | 'spread_grid';
    speed: number;
    colorHex?: string;
    fontSize?: number;
    loop: boolean;
  } | null>(null);

  // Logo overlay state
  const [logo, setLogo] = useState<{
    url: string;
    opacity: number;
    position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    effect?: 'none' | 'pulse' | 'spin' | 'float' | 'neon';
    rect?: { x: number; y: number; width: number };
  } | null>(null);

  // QR periodic overlay state
  const [qrConfig, setQrConfig] = useState<{
    enabled: boolean;
    intervalSeconds: number;
    durationSeconds: number;
    position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    size?: 'small' | 'medium' | 'large';
  } | null>(null);
  const [showQrOverlay, setShowQrOverlay] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  // Reaction overlay state
  const [reactions, setReactions] = useState<Reaction[]>([]);

  // Canvas and art controller refs
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<VisualArtController | null>(null);

  // Socket ref
  const socketRef = useRef<Socket | null>(null);
  const tokenRef = useRef<string | null>(null);

  const [activeMedia, setActiveMedia] = useState<any | null>(null);
  const [matrixSize, setMatrixSize] = useState({ rows: 3, cols: 3 });
  // Branding: show the Glow watermark unless the room's plan removes it (Venue+).
  const [removeWatermark, setRemoveWatermark] = useState(false);

  const liveCall = useLiveCallViewer({
    socketRef,
    subscribed: connectionState === 'subscribed',
  });

  useEffect(() => {
    if (activeMedia && activeMedia.durationMs && activeMedia.durationMs > 0) {
      const elapsed = Date.now() - activeMedia.timestamp;
      const remaining = activeMedia.durationMs - elapsed;
      if (remaining <= 0) {
        setActiveMedia(null);
      } else {
        const timer = setTimeout(() => {
          setActiveMedia(null);
        }, remaining);
        return () => clearTimeout(timer);
      }
    }
  }, [activeMedia]);

  // ── Read token from URL fragment ──────────────────────────────────────────
  useEffect(() => {
    const hash = window.location.hash;
    const match = hash.match(/[#&]token=([^&]+)/);
    if (match?.[1]) {
      setToken(match[1]);
      tokenRef.current = match[1];
    } else {
      setConnectionState('token_missing');
    }
  }, []);

  // ── Generate join QR code data URL ─────────────────────────────────────────
  useEffect(() => {
    const joinUrl = buildPlayerJoinUrl(roomCode, { matrix: false });
    void QRCode.toDataURL(joinUrl, {
      width: 512,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setQrDataUrl);
  }, [roomCode]);

  // ── Periodic QR Code Overlay timer cycle ───────────────────────────────────
  useEffect(() => {
    if (!qrConfig || !qrConfig.enabled) {
      setShowQrOverlay(false);
      return;
    }

    if (qrConfig.durationSeconds === 0) {
      setShowQrOverlay(true);
      return;
    }

    const intervalMs = qrConfig.intervalSeconds * 1000;
    const durationMs = qrConfig.durationSeconds * 1000;

    let showTimeout: NodeJS.Timeout;
    let hideTimeout: NodeJS.Timeout;

    const startCycle = () => {
      showTimeout = setTimeout(() => {
        setShowQrOverlay(true);
        hideTimeout = setTimeout(() => {
          setShowQrOverlay(false);
          startCycle();
        }, durationMs);
      }, intervalMs);
    };

    startCycle();

    return () => {
      clearTimeout(showTimeout);
      clearTimeout(hideTimeout);
    };
  }, [qrConfig]);

  // ── Mount / swap art ──────────────────────────────────────────────────────
  const mountArt = useCallback((id: VisualArtId) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    controllerRef.current?.destroy();
    controllerRef.current = null;

    // Unknown/removed art ids (e.g. legacy rigs) fall back to the default art
    const definition = getVisualArt(id) ?? getVisualArt(DEFAULT_VISUAL_ART_ID);
    if (!definition) {
      console.warn(`[visuals] Unknown art id: ${id}`);
      return;
    }
    controllerRef.current = definition.mount(canvas, () => {
      const baseInput = inputRef.current;
      if (localActiveRef.current) {
        return {
          ...baseInput,
          audio: localAudio.featuresRef.current,
        };
      }
      return baseInput;
    });
  }, [localAudio.featuresRef]);

  const canvasCallbackRef = useCallback((el: HTMLCanvasElement | null) => {
    canvasRef.current = el;
    if (!el) {
      // Canvas unmounted (mode switch) — tear down the active art
      controllerRef.current?.destroy();
      controllerRef.current = null;
    }
  }, []);

  // Swap art when artId changes (layout effect: ref is set during commit, before this runs)
  useLayoutEffect(() => {
    if (canvasRef.current) mountArt(artId);
  }, [artId, mountArt]);

  // Resize handler
  useEffect(() => {
    const handler = () => controllerRef.current?.resize();
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      controllerRef.current?.destroy();
      socketRef.current?.disconnect();
    };
  }, []);

  // Prune reactions older than 2.8s
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setReactions((prev) => prev.filter((r) => now - r.receivedAt < 2800));
    }, 200);
    return () => clearInterval(interval);
  }, []);

  // ── Apply state helper ──────────────────────────────────────────────────
  const applyVisualsState = useCallback((state: any) => {
    const nextInput = { ...inputRef.current, roomCode };
    if (state.palette) {
      nextInput.palette = state.palette;
    }
    if (state.logo !== undefined) {
      setLogo(state.logo);
      nextInput.logo = state.logo;
    }
    if (state.displayName !== undefined) {
      setDisplayName(state.displayName || 'Glow');
    }
    if (state.displayNamePosition !== undefined) {
      setDisplayNamePosition(state.displayNamePosition || 'center');
    }
    if (state.text !== undefined) {
      setLiveText(state.text || null);
    }
    if (state.params !== undefined) {
      nextInput.params = state.params;
    }
    inputRef.current = nextInput;
    controllerRef.current?.setInput(nextInput);

    if (state.artId) {
      setArtId(prev => state.artId && state.artId !== prev ? (state.artId as VisualArtId) : prev);
    }
    if (state.mode) {
      setVisualsMode(state.mode as VisualsMode);
    }
    if (state.youtube !== undefined) {
      setYoutubeState(state.youtube);
    }
    if (state.threeD?.energy !== undefined) {
      setThreeDEnergy(state.threeD.energy);
    }
    if (state.qrConfig !== undefined) {
      setQrConfig(state.qrConfig);
    }
  }, [roomCode]);

  // Relay playback position to the server so the desk seek slider has duration
  const reportYoutubeStatus = useCallback(
    (status: { currentTime: number; duration: number }) => {
      socketRef.current?.emit('visuals:youtube_status', { roomCode, ...status });
    },
    [roomCode],
  );

  // Tell the server the current video finished so it can auto-advance the queue
  const reportYoutubeEnded = useCallback(
    (videoId: string) => {
      socketRef.current?.emit('visuals:youtube_ended', { roomCode, videoId });
    },
    [roomCode],
  );

  const resync = useCallback((socket: Socket) => {
    socket.emit('visuals:resync', { roomCode }, (response: { ok: boolean; visualsState?: any; reason?: string; removeWatermark?: boolean }) => {
      if (response.ok && response.visualsState) {
        applyVisualsState(response.visualsState);
        setRemoveWatermark(Boolean(response.removeWatermark));
      }
    });
  }, [roomCode, applyVisualsState]);

  // ── Subscribe helper (called on connect and on reconnect) ─────────────────
  const subscribe = useCallback((socket: Socket, tok: string) => {
    setConnectionState('subscribing');
    socket.emit(
      'visuals:subscribe',
      { roomCode, token: tok },
      (response: {
        ok: boolean;
        sessionId?: string;
        reason?: string;
        matrix?: { rows: number; cols: number };
        visualsState?: any;
        removeWatermark?: boolean;
      }) => {
        if (response.ok) {
          setConnectionState('subscribed');
          setRemoveWatermark(Boolean(response.removeWatermark));
          if (response.matrix) {
            setMatrixSize(response.matrix);
          }
          if (response.visualsState) {
            applyVisualsState(response.visualsState);
          }
        } else {
          const reason = response.reason ?? 'unknown';
          if (reason === 'token_invalid_or_expired') {
            setConnectionState('token_expired');
          } else if (reason === 'room_not_found') {
            setConnectionState('room_not_found');
          } else {
            setConnectionState('token_expired'); // fallback
          }
        }
      },
    );
  }, [roomCode, applyVisualsState]);

  // ── Connect socket when token is available ────────────────────────────────
  useEffect(() => {
    const tok = token;
    if (!tok) return;

    const socket = io(getRealtimeUrl(), {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      const currentToken = tokenRef.current;
      if (currentToken) subscribe(socket, currentToken);
    });

    socket.on('disconnect', () => {
      // Don't change state to error on disconnect — reconnect will re-subscribe
    });

    // Reconnect: re-subscribe when socket reconnects
    socket.on('reconnect', () => {
      const currentToken = tokenRef.current;
      if (currentToken) subscribe(socket, currentToken);
    });

    // ── visuals:scene ─────────────────────────────────────────────────────
    socket.on('visuals:scene', (payload: ScenePayload) => {
      applyVisualsState(payload);
    });

    // ── visuals:mode ──────────────────────────────────────────────────────
    socket.on('visuals:mode', (payload: { mode: VisualsMode }) => {
      setVisualsMode(payload.mode);
    });

    // ── visuals:youtube ───────────────────────────────────────────────────
    socket.on('visuals:youtube', (payload: { youtube: YoutubeVisualsState | null }) => {
      setYoutubeState(payload.youtube);
    });

    // ── visuals:3d ────────────────────────────────────────────────────────
    socket.on(
      'visuals:3d',
      (payload: { kind: 'energy'; level: number } | { kind: 'action'; action: 'shockwave' | 'burst' }) => {
        if (payload.kind === 'energy') {
          setThreeDEnergy(payload.level);
        } else {
          setThreeDAction({ action: payload.action, nonce: Date.now() });
        }
      },
    );

    // ── visuals:palette ───────────────────────────────────────────────────
    socket.on('visuals:palette', (payload: { palette: string[] }) => {
      const nextInput = { ...inputRef.current, palette: payload.palette };
      inputRef.current = nextInput;
      controllerRef.current?.setInput(nextInput);
    });

    // ── visuals:logo ──────────────────────────────────────────────────────
    socket.on(
      'visuals:logo',
      (payload: {
        logo: {
          url: string;
          opacity: number;
          position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
          effect?: 'none' | 'pulse' | 'spin' | 'float' | 'neon';
          rect?: { x: number; y: number; width: number };
        } | null;
      }) => {
        setLogo(payload.logo);
        const nextInput = { ...inputRef.current, logo: payload.logo };
        inputRef.current = nextInput;
        controllerRef.current?.setInput(nextInput);
      },
    );

    // ── visuals:text overlay ──────────────────────────────────────────────
    socket.on('visuals:text', (payload: any) => {
      setLiveText(payload);
    });

    socket.on('visuals:text_clear', () => {
      setLiveText(null);
    });

    // ── visuals:qr overlay ────────────────────────────────────────────────
    socket.on('visuals:qr', (payload: { qrConfig: any }) => {
      setQrConfig(payload.qrConfig);
    });

    // ── visuals:audio_features ─────────────────────────────────────────────
    socket.on('visuals:audio_features', (payload: { features: AudioFeatures }) => {
      const nextInput = { ...inputRef.current, audio: payload.features };
      inputRef.current = nextInput;
      controllerRef.current?.setInput(nextInput);
    });

    // ── visuals:reaction ──────────────────────────────────────────────────
    socket.on(
      'visuals:reaction',
      (payload: { emoji: string; nickname?: string; boost: number }) => {
        const emojiGlyph = EMOJI_GLYPHS[payload.emoji as ReactionEmoji] || payload.emoji;
        setReactions((prev) => {
          // Coalesce identical emojis on bursts (when approaching capacity of 30)
          const shouldCoalesce = prev.length >= 20;
          if (shouldCoalesce) {
            const existingIdx = prev.findIndex(
              (r) => r.emoji === emojiGlyph && r.nickname === payload.nickname
            );
            if (existingIdx !== -1) {
              const next = [...prev];
              const existing = next[existingIdx]!;
              next[existingIdx] = {
                ...existing,
                count: existing.count + 1,
                boost: Math.min(existing.boost + 1, 3),
                receivedAt: Date.now(),
                id: `${Date.now()}-${Math.random()}`, // Resetting ID forces re-animation
              };
              return next;
            }
          }

          const reaction: Reaction = {
            id: `${Date.now()}-${Math.random()}`,
            emoji: emojiGlyph,
            nickname: payload.nickname,
            boost: payload.boost ?? 1,
            x: getNonCenterPosition(),
            count: 1,
            receivedAt: Date.now(),
          };

          const next = [...prev, reaction];
          return next.length > 30 ? next.slice(next.length - 30) : next;
        });
      },
    );

    // ── room:closed ────────────────────────────────────────────────────────
    socket.on('room:closed', (payload?: { reason?: string }) => {
      if (payload?.reason === 'duration_limit') {
        setRoomClosedReason('Room session has reached its duration limit.');
      } else {
        setRoomClosedReason('The host has ended this room session.');
      }
      setConnectionState('room_closed');
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && socket.connected) {
        resync(socket);
      }
    };
    const handleFocus = () => {
      if (socket.connected) {
        resync(socket);
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, applyVisualsState, resync, subscribe]);

  // ── Status helpers ────────────────────────────────────────────────────────
  const statusLabel: Record<ConnectionState, string> = {
    connecting: 'Connecting…',
    subscribing: 'Subscribing…',
    subscribed: 'Live ●',
    token_missing: 'No token',
    token_expired: 'Token expired',
    room_not_found: 'Room not found',
    room_closed: 'Room closed',
  };

  const isError = (
    connectionState === 'token_missing' ||
    connectionState === 'token_expired' ||
    connectionState === 'room_not_found'
  );

  const errorMessages: Partial<Record<ConnectionState, { title: string; body: string }>> = {
    token_missing: {
      title: '🔗 No visuals token',
      body: 'Open this page from the control desk to get a valid link.',
    },
    token_expired: {
      title: '⏱ Token expired',
      body: 'Re-open the visuals link from the control desk.',
    },
    room_not_found: {
      title: '🔍 Room not found',
      body: 'The room may have ended. Check the control desk.',
    },
    room_closed: {
      title: '🚪 Room closed',
      body: 'The DJ has ended the session.',
    },
  };

  return (
    <div className="relative h-[100dvh] w-screen overflow-hidden bg-black">
      <WakeLock />

      {/* ── Glow watermark (Free / Party) ── */}
      {!removeWatermark ? <GlowWatermark position="bottom-right" /> : null}

      {/* ── Media Overlay ── */}
      {activeMedia && (
        <div className="absolute inset-0 z-5 pointer-events-none flex items-center justify-center overflow-hidden bg-black/30">
          {activeMedia.kind === 'image' && activeMedia.url && (
            <img
              src={activeMedia.url}
              alt="Broadcast media"
              className={
                activeMedia.fit === 'contain' ? 'w-full h-full object-contain bg-black' : 'w-full h-full object-cover'
              }
            />
          )}
          {activeMedia.kind === 'gif' && activeMedia.url && (
            <img
              src={activeMedia.url}
              alt="Broadcast GIF"
              className="w-full h-full object-contain bg-black"
            />
          )}
          {activeMedia.kind === 'text' && activeMedia.text && (
            <div className="w-full h-full flex items-center justify-center p-4">
              <VisualsSequencedTextRenderer
                text={activeMedia.text}
                mode={activeMedia.mode || 'marquee'}
                speed={activeMedia.speed || 5}
                colorHex={activeMedia.colorHex}
                loop={activeMedia.loop ?? true}
                matrix={matrixSize}
                fontSize={activeMedia.fontSize}
              />
            </div>
          )}
        </div>
      )}

      {/* ── Custom Live Text Overlay ── */}
      {liveText && liveText.text && (
        <div className="absolute inset-0 z-[8] pointer-events-none flex items-center justify-center overflow-hidden bg-black/30 animate-in fade-in duration-300">
          <div className="w-full h-full flex items-center justify-center p-4">
            <VisualsSequencedTextRenderer
              text={liveText.text}
              mode={liveText.mode || 'marquee'}
              speed={liveText.speed || 5}
              colorHex={liveText.colorHex}
              loop={liveText.loop ?? true}
              matrix={matrixSize}
              fontSize={liveText.fontSize}
            />
          </div>
        </div>
      )}

      {/* ── Base layer: art canvas (standard) or alternate pipeline ── */}
      {visualsMode === 'standard' ? (
        <canvas
          ref={canvasCallbackRef}
          className="absolute inset-0 h-full w-full"
          style={{ display: 'block' }}
        />
      ) : visualsMode === 'youtube' ? (
        <YoutubeSurface state={youtubeState} onStatus={reportYoutubeStatus} onEnded={reportYoutubeEnded} />
      ) : visualsMode === '3d' ? (
        <ThreeDSurface inputRef={inputRef} energy={threeDEnergy} pendingAction={threeDAction} />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <p className="font-mono text-xs uppercase tracking-widest text-zinc-600">
            {visualsMode} mode — coming soon
          </p>
        </div>
      )}

      {/* ── Live-call mosaic tiles ── */}
      {liveCall.tiles.length > 0 ? (
        <div className="pointer-events-none absolute inset-0 z-[15] overflow-hidden">
          {liveCall.tiles.map((tile) => {
            const stream = liveCall.streams[tile.publicId];
            if (!stream) return null;
            return (
              <LiveVideoTile
                key={tile.publicId}
                stream={stream}
                x={tile.x}
                y={tile.y}
                w={tile.w}
                h={tile.h}
                z={tile.z}
              />
            );
          })}
        </div>
      ) : null}

      {/* ── Reaction overlay ── */}
      <div className="pointer-events-none absolute inset-0 z-10 overflow-hidden">
        {reactions.map((reaction) => (
          <div
            key={reaction.id}
            className="absolute animate-[rise_2.5s_ease-out_forwards]"
            style={{
              left: `${reaction.x}%`,
              bottom: '10%',
              lineHeight: 1,
            }}
          >
            <div className="flex flex-col items-center gap-1 select-none">
              <div className="flex items-center gap-1.5">
                <span style={{ fontSize: `${40 + (reaction.boost - 1) * 20}px` }}>{reaction.emoji}</span>
                {reaction.count > 1 && (
                  <span className="font-cyber font-black tracking-wider text-xs text-yellow-400 bg-black/60 px-1.5 py-0.5 rounded border border-yellow-400/30 shadow-[0_0_8px_rgba(234,179,8,0.3)] animate-pulse">
                    ×{reaction.count}
                  </span>
                )}
              </div>
              {reaction.nickname && (
                <span className="block text-center text-[10px] font-cyber tracking-wide text-white/80 bg-black/50 px-1.5 py-0.5 rounded backdrop-blur-[1px] border border-white/5 whitespace-nowrap">
                  {reaction.emoji} by {reaction.nickname}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ── Branding / Show Name Overlays ──
          Logo and show name position independently; when they share a
          position they stack in one container so they never overlap. */}
      {(() => {
        const positionClasses = (pos: string) =>
          pos === 'center' ? 'inset-0 flex items-center justify-center' :
            pos === 'top-left' ? 'top-8 left-8 items-start max-w-[30%]' :
              pos === 'top-right' ? 'top-8 right-8 items-end max-w-[30%]' :
                pos === 'bottom-left' ? 'bottom-8 left-8 items-start max-w-[30%]' :
                  'bottom-8 right-8 items-end max-w-[30%]';

        const logoPos = logo?.position ?? 'center';
        const logoRect = logo?.rect;
        const stacked =
          Boolean(logo?.url) && displayName && logoPos === displayNamePosition && !logoRect;

        const logoImg = logo?.url ? (
          <img
            src={logo.url}
            alt="Branding Logo"
            className={`object-contain ${logoRect ? 'w-full h-auto' : logoPos === 'center' ? 'max-w-[30%] max-h-[30%]' : 'w-24 h-24'
              } ${logo.effect === 'pulse' ? 'animate-[pulse_2s_ease-in-out_infinite]' :
                logo.effect === 'spin' ? 'animate-[spin_8s_linear_infinite]' :
                  logo.effect === 'float' ? 'animate-[float_4s_ease-in-out_infinite]' :
                    logo.effect === 'neon' ? 'animate-[neon-glow_3s_ease-in-out_infinite]' :
                      ''
              }`}
          />
        ) : null;

        const nameSpan = displayName ? (
          <span className={cn(
            'font-cyber font-black tracking-widest uppercase text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)] text-center',
            displayNamePosition === 'center' ? 'text-3xl md:text-5xl neon-text-magenta' : 'text-sm md:text-base neon-text-cyan'
          )}>
            {displayName}
          </span>
        ) : null;

        return (
          <>
            {logoImg && (
              <div
                className={cn(
                  'absolute pointer-events-none z-10 transition-all duration-500 flex flex-col items-center gap-2',
                  !logoRect && positionClasses(logoPos)
                )}
                style={
                  logoRect
                    ? {
                      left: `${logoRect.x}%`,
                      top: `${logoRect.y}%`,
                      width: `${logoRect.width}%`,
                      opacity: logo!.opacity,
                    }
                    : { opacity: logo!.opacity }
                }
              >
                {logoImg}
                {stacked && nameSpan}
              </div>
            )}
            {nameSpan && !stacked && (
              <div
                className={`absolute pointer-events-none z-10 transition-all duration-500 flex flex-col items-center gap-2 ${positionClasses(displayNamePosition)}`}
                style={{ opacity: 0.85 }}
              >
                {nameSpan}
              </div>
            )}
          </>
        );
      })()}

      {/* ── QR Code Overlay ── */}
      {showQrOverlay && qrDataUrl && (
        qrConfig?.position && qrConfig.position !== 'center' ? (
          <div
            className={cn(
              "absolute z-20 p-4 rounded-2xl border border-neon-magenta/25 bg-black/80 shadow-[0_0_20px_rgba(255,0,229,0.15)] flex flex-col items-center gap-2",
              qrConfig.position === 'top-left' && 'top-8 left-8',
              qrConfig.position === 'top-right' && 'top-8 right-8',
              qrConfig.position === 'bottom-left' && 'bottom-8 left-8',
              qrConfig.position === 'bottom-right' && 'bottom-8 right-8'
            )}
          >
            <img
              src={qrDataUrl}
              alt={`QR code for room ${roomCode}`}
              className={cn(
                "rounded-lg border-2 border-white bg-white",
                qrConfig.size === 'small' ? 'w-20 h-20' :
                  qrConfig.size === 'large' ? 'w-48 h-48' :
                    'w-32 h-32' // medium
              )}
            />
            <span className="font-cyber font-black tracking-widest text-[9px] text-neon-cyan neon-text-cyan">
              ROOM: {roomCode}
            </span>
          </div>
        ) : (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md animate-in fade-in zoom-in duration-300">
            <div className="relative p-8 rounded-3xl border border-neon-magenta/30 bg-black/85 shadow-[0_0_50px_rgba(255,0,229,0.25)] flex flex-col items-center gap-4 max-w-sm">
              <div className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-full border border-neon-cyan/40 bg-black px-6 py-1.5 shadow-[0_0_15px_rgba(0,229,255,0.2)]">
                <span className="font-cyber font-black tracking-widest text-xs text-neon-cyan neon-text-cyan uppercase">
                  JOIN THE RAVE
                </span>
              </div>
              <img
                src={qrDataUrl}
                alt={`QR code for room ${roomCode}`}
                className={cn(
                  "rounded-2xl border-4 border-white shadow-2xl",
                  qrConfig?.size === 'small' ? 'w-48 h-48' :
                    qrConfig?.size === 'large' ? 'w-80 h-80' :
                      'w-64 h-64' // medium
                )}
              />
              <div className="text-center mt-2 space-y-1">
                <h4 className="font-display font-black tracking-widest text-lg text-white">
                  ROOM: {roomCode}
                </h4>
                <p className="text-[10px] font-cyber tracking-wider text-muted-foreground uppercase leading-none">
                  Scan to sync your screen
                </p>
              </div>
            </div>
          </div>
        )
      )}

      {/* ── Error overlay ── */}
      {isError && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/80 backdrop-blur-sm">
          <p className="text-2xl font-semibold text-white">
            {errorMessages[connectionState]?.title}
          </p>
          <p className="text-sm text-white/60">
            {errorMessages[connectionState]?.body}
          </p>
        </div>
      )}

      {/* ── Session Ended Overlay ── */}
      {connectionState === 'room_closed' && (
        <div className="dark absolute inset-0 z-30 flex flex-col items-center justify-center bg-background px-6 py-10 overflow-hidden">
          <SectionGlow glowColor="magenta" position="center" />
          <PageTransitionWrapper className="w-full max-w-sm">
            <NeonCard glowColor="magenta" borderVariant="magenta" className="p-8">
              <div className="text-center">
                <NeonTitle as="h2" color="magenta" className="text-2xl font-black tracking-widest">
                  SESSION ENDED
                </NeonTitle>
                <p className="text-sm font-cyber tracking-wide text-zinc-300 mt-4 uppercase">
                  {roomClosedReason}
                </p>
              </div>
            </NeonCard>
          </PageTransitionWrapper>
        </div>
      )}

      <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
        <FullscreenButton />
      </div>

      {/* ── Visuals and Reaction CSS animations ── */}
      <style>{`
        @keyframes rise {
          0%   { transform: translateY(0)   scale(1);   opacity: 1; }
          70%  { transform: translateY(-60vh) scale(1.1); opacity: 0.8; }
          100% { transform: translateY(-80vh) scale(0.8); opacity: 0; }
        }
        @keyframes float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-8px); }
        }
        @keyframes neon-glow {
          0%, 100% { filter: drop-shadow(0 0 5px rgba(255, 0, 200, 0.3)) drop-shadow(0 0 15px rgba(0, 229, 255, 0.15)); }
          50% { filter: drop-shadow(0 0 15px rgba(255, 0, 200, 0.75)) drop-shadow(0 0 30px rgba(0, 229, 255, 0.4)); }
        }
      `}</style>
    </div>
  );
}

// ─── Page export ─────────────────────────────────────────────────────────────

function LiveVideoTile({
  stream,
  x,
  y,
  w,
  h,
  z,
}: {
  stream: MediaStream;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    el.srcObject = stream;
    void el.play().catch(() => {
      // Autoplay may be blocked until user gesture; surface is typically fullscreen
    });
    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className="absolute rounded-xl border-2 border-white/25 object-cover shadow-[0_8px_32px_rgba(0,0,0,0.55)] backdrop-blur-[2px]"
      style={{
        left: `${x * 100}%`,
        top: `${y * 100}%`,
        width: `${w * 100}%`,
        height: `${h * 100}%`,
        zIndex: z,
      }}
    />
  );
}

export default function VisualsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  return <VisualsContent code={code} />;
}

