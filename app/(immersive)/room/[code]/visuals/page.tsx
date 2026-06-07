'use client';

import { use, useCallback, useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { getVisualArt } from 'glow-visuals';
import type { VisualArtController, VisualArtInput, VisualArtId } from 'glow-visuals';
import type { AudioFeatures } from 'glow-visuals';
import QRCode from 'qrcode';
import { buildPlayerJoinUrl } from '@/lib/glow/join-url';
import { FullscreenButton } from '@/components/glow/fullscreen-button';
import { WakeLock } from '@/components/glow/wake-lock';
import { getRealtimeUrl } from '@/lib/glow/matrix';

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
  x: number; // random horizontal position 10-90%
};

// ─── Default input ────────────────────────────────────────────────────────────

function makeDefaultInput(roomCode: string): VisualArtInput {
  return {
    timeMs: 0,
    palette: ['#7c3aed', '#06b6d4'],
    roomCode,
  };
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

  // ── Subscribe helper (called on connect and on reconnect) ─────────────────
  const subscribe = useCallback((socket: Socket, tok: string) => {
    setConnectionState('subscribing');
    socket.emit(
      'visuals:subscribe',
      { roomCode, token: tok },
      (response: { ok: boolean; sessionId?: string; reason?: string }) => {
        if (response.ok) {
          setConnectionState('subscribed');
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
        const reaction: Reaction = {
          id: `${Date.now()}-${Math.random()}`,
          emoji: payload.emoji,
          nickname: payload.nickname,
          boost: payload.boost ?? 1,
          x: 10 + Math.random() * 80,
        };
        setReactions((prev) => {
          const next = [...prev, reaction];
          // Cap at 30 concurrent
          return next.length > 30 ? next.slice(next.length - 30) : next;
        });
        // Auto-remove after animation
        setTimeout(() => {
          setReactions((prev) => prev.filter((r) => r.id !== reaction.id));
        }, 2800);
      },
    );

    // ── room:closed ────────────────────────────────────────────────────────
    socket.on('room:closed', () => {
      setConnectionState('room_closed');
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
              fontSize: `${reaction.boost > 1 ? 64 : 40}px`,
              lineHeight: 1,
            }}
          >
            {reaction.emoji}
            {reaction.nickname && (
              <span className="block text-center text-xs text-white/70">
                {reaction.nickname}
              </span>
            )}
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
