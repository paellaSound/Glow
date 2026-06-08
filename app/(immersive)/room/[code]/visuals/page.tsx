'use client';

import { use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getVisualArt, EMOJI_GLYPHS } from 'glow-visuals';
import type { VisualArtController, VisualArtInput, VisualArtId, ReactionEmoji } from 'glow-visuals';
import type { AudioFeatures } from 'glow-visuals';
import QRCode from 'qrcode';
import { buildPlayerJoinUrl } from '@/lib/glow/join-url';
import { FullscreenButton } from '@/components/glow/fullscreen-button';
import { WakeLock } from '@/components/glow/wake-lock';
import { getRealtimeUrl } from '@/lib/glow/matrix';
import { cn } from '@/lib/utils';

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
  const [artId, setArtId] = useState<VisualArtId>('glow-branded');
  // Live input for the art (updated by realtime events)
  const inputRef = useRef<VisualArtInput>(makeDefaultInput(roomCode));

  // Logo overlay state
  const [logo, setLogo] = useState<{
    url: string;
    opacity: number;
    position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    effect?: 'none' | 'pulse' | 'spin' | 'float' | 'neon';
  } | null>(null);

  // QR periodic overlay state
  const [qrConfig, setQrConfig] = useState<{ enabled: boolean; intervalSeconds: number; durationSeconds: number } | null>(null);
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

  const [showInfo, setShowInfo] = useState(false);
  const [activeMedia, setActiveMedia] = useState<any | null>(null);
  const [matrixSize, setMatrixSize] = useState({ rows: 3, cols: 3 });

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

    const definition = getVisualArt(id);
    if (!definition) {
      console.warn(`[visuals] Unknown art id: ${id}`);
      return;
    }
    controllerRef.current = definition.mount(canvas, () => inputRef.current);
  }, []);

  const canvasCallbackRef = useCallback(
    (el: HTMLCanvasElement | null) => {
      canvasRef.current = el;
      if (el) mountArt(artId);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Swap art when artId changes
  useEffect(() => {
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

  // ── Subscribe helper (called on connect and on reconnect) ─────────────────
  const subscribe = useCallback((socket: Socket, tok: string) => {
    setConnectionState('subscribing');
    socket.emit(
      'visuals:subscribe',
      { roomCode, token: tok },
      (response: { ok: boolean; sessionId?: string; reason?: string; matrix?: { rows: number; cols: number } }) => {
        if (response.ok) {
          setConnectionState('subscribed');
          if (response.matrix) {
            setMatrixSize(response.matrix);
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
  }, [roomCode]);

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
      if (payload.palette) {
        inputRef.current = { ...inputRef.current, palette: payload.palette, roomCode };
      }
      if (payload.artId && payload.artId !== artId) {
        setArtId(payload.artId as VisualArtId);
      }
      if (payload.logo !== undefined) {
        setLogo(payload.logo);
        inputRef.current = { ...inputRef.current, logo: payload.logo };
      }
      if (payload.qrConfig !== undefined) {
        setQrConfig(payload.qrConfig);
      }
    });

    // ── visuals:palette ───────────────────────────────────────────────────
    socket.on('visuals:palette', (payload: { palette: string[] }) => {
      inputRef.current = { ...inputRef.current, palette: payload.palette };
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
        } | null;
      }) => {
        setLogo(payload.logo);
        inputRef.current = { ...inputRef.current, logo: payload.logo };
      },
    );

    // ── visuals:audio_features ─────────────────────────────────────────────
    socket.on('visuals:audio_features', (payload: { features: AudioFeatures }) => {
      inputRef.current = { ...inputRef.current, audio: payload.features };
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
    socket.on('room:closed', () => {
      setConnectionState('room_closed');
    });

    // ── visuals:media ─────────────────────────────────────────────────────
    socket.on('visuals:media', (payload: any) => {
      if (payload.kind === 'clear') {
        setActiveMedia(null);
      } else {
        setActiveMedia(payload);
      }
    });

    socket.on('visuals:media_clear', () => {
      setActiveMedia(null);
    });

    socket.on('media_clear', () => {
      setActiveMedia(null);
    });

    return () => {
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

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
    connectionState === 'room_not_found' ||
    connectionState === 'room_closed'
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

      {/* ── Art canvas ── */}
      <canvas
        ref={canvasCallbackRef}
        className="absolute inset-0 h-full w-full"
        style={{ display: 'block' }}
      />

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

      {/* ── Branding Logo Overlay ── */}
      {logo && logo.url && (
        <div
          className={`absolute pointer-events-none z-10 transition-all duration-500 ${
            logo.position === 'center' ? 'inset-0 flex items-center justify-center' :
            logo.position === 'top-left' ? 'top-8 left-8 max-w-[12%] max-h-[12%]' :
            logo.position === 'top-right' ? 'top-8 right-8 max-w-[12%] max-h-[12%]' :
            logo.position === 'bottom-left' ? 'bottom-8 left-8 max-w-[12%] max-h-[12%]' :
            'bottom-8 right-8 max-w-[12%] max-h-[12%]'
          }`}
          style={{ opacity: logo.opacity }}
        >
          <img
            src={logo.url}
            alt="Branding Logo"
            className={`object-contain ${
              logo.position === 'center' ? 'max-w-[30%] max-h-[30%]' : 'w-full h-full'
            } ${
              logo.effect === 'pulse' ? 'animate-[pulse_2s_ease-in-out_infinite]' :
              logo.effect === 'spin' ? 'animate-[spin_8s_linear_infinite]' :
              logo.effect === 'float' ? 'animate-[float_4s_ease-in-out_infinite]' :
              logo.effect === 'neon' ? 'animate-[neon-glow_3s_ease-in-out_infinite]' :
              ''
            }`}
          />
        </div>
      )}

      {/* ── Periodic QR Code Overlay ── */}
      {showQrOverlay && qrDataUrl && (
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
              className="w-64 h-64 rounded-2xl border-4 border-white shadow-2xl"
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

      {/* ── Info badge (corner, hover) ── */}
      <div className="absolute right-3 top-3 z-20 flex items-center gap-2">
        <button
          onClick={() => setShowInfo((v) => !v)}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-white/10 text-xs text-white/40 transition hover:bg-white/20 hover:text-white"
          aria-label="Connection info"
        >
          ℹ
        </button>
        <FullscreenButton />
      </div>

      {showInfo && (
        <div className="absolute right-14 top-3 z-20 min-w-[160px] rounded-xl border border-white/10 bg-black/75 px-3 py-2 text-xs backdrop-blur-sm">
          <p className="font-mono font-semibold text-white">Room: {roomCode}</p>
          <p className={`mt-0.5 ${connectionState === 'subscribed' ? 'text-green-400' : isError ? 'text-red-400' : 'text-white/50'}`}>
            {statusLabel[connectionState]}
          </p>
          <p className="mt-0.5 text-white/30">Art: {artId}</p>
          {token && (
            <p className="mt-0.5 font-mono text-white/20">
              Token: {token.slice(0, 14)}…
            </p>
          )}
        </div>
      )}

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

export default function VisualsPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);
  return <VisualsContent code={code} />;
}

function VisualsSequencedTextRenderer({
  text,
  mode,
  speed,
  colorHex = '#ffffff',
  loop,
  matrix,
  fontSize,
}: {
  text: string;
  mode: 'marquee' | 'word_by_word' | 'spread_grid';
  speed: number;
  colorHex?: string;
  loop: boolean;
  matrix: { rows: number; cols: number };
  fontSize?: number;
}) {
  const [wordIdx, setWordIdx] = useState(0);
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  useEffect(() => {
    if (mode !== 'word_by_word' || words.length === 0) return;
    setWordIdx(0);
    const interval = setInterval(() => {
      setWordIdx((prev) => {
        if (prev + 1 >= words.length) {
          if (loop) return 0;
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / Math.max(0.1, speed));
    return () => clearInterval(interval);
  }, [words, speed, loop, mode]);

  const gridWord = useMemo(() => {
    if (mode !== 'spread_grid' || words.length === 0) return null;
    const pageSize = matrix.rows * matrix.cols;
    const numPages = Math.ceil(words.length / pageSize);
    const pageDurationMs = (pageSize / Math.max(0.1, speed)) * 1000;
    return { pageSize, numPages, pageDurationMs };
  }, [mode, words.length, matrix.rows, matrix.cols, speed]);

  const [gridPage, setGridPage] = useState(0);

  useEffect(() => {
    if (!gridWord) return;
    setGridPage(0);
    const interval = setInterval(() => {
      setGridPage((prev) => {
        if (prev + 1 >= gridWord.numPages) {
          if (loop) return 0;
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, gridWord.pageDurationMs);
    return () => clearInterval(interval);
  }, [gridWord, loop]);

  if (mode === 'marquee') {
    const duration = Math.max(3, text.length / Math.max(1, speed));
    return (
      <div className="w-full whitespace-nowrap overflow-hidden">
        <span
          className={cn(
            "inline-block font-cyber font-black tracking-widest uppercase",
            !fontSize && "text-6xl md:text-8xl"
          )}
          style={{
            color: colorHex,
            fontSize: fontSize ? `${fontSize}px` : undefined,
            animation: `marquee ${duration}s linear ${loop ? 'infinite' : '1'}`,
          }}
        >
          {text}
        </span>
        <style>{`
          @keyframes marquee {
            0% { transform: translateX(100vw); }
            100% { transform: translateX(-100%); }
          }
        `}</style>
      </div>
    );
  }

  if (mode === 'word_by_word') {
    const currentWord = words[wordIdx] || '';
    return (
      <span
        className={cn(
          "font-cyber font-black tracking-widest uppercase",
          !fontSize && "text-7xl md:text-9xl"
        )}
        style={{
          color: colorHex,
          fontSize: fontSize ? `${fontSize}px` : undefined,
        }}
        key={wordIdx}
      >
        {currentWord}
      </span>
    );
  }

  if (mode === 'spread_grid') {
    if (!gridWord) return null;
    return (
      <div
        className="grid w-full h-full gap-4 p-8 animate-in fade-in duration-300"
        style={{
          gridTemplateColumns: `repeat(${matrix.cols}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${matrix.rows}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: matrix.rows * matrix.cols }).map((_, idx) => {
          const wordIndex = gridPage * gridWord.pageSize + idx;
          const currentWord = words[wordIndex] || '';
          return (
            <div
              key={idx}
              className="flex items-center justify-center border border-white/5 rounded-2xl bg-black/40 p-4 min-h-24"
            >
              <span
                className={cn(
                  "font-cyber font-black tracking-widest uppercase text-center",
                  !fontSize && "text-2xl md:text-4xl"
                )}
                style={{
                  color: colorHex,
                  fontSize: fontSize ? `${fontSize}px` : undefined,
                }}
                key={wordIndex}
              >
                {currentWord}
              </span>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}
