'use client';

import { Suspense, use, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useGlowSocket } from '@/lib/glow/socket';
import { useVisualEngine } from '@/lib/glow/visual-engine';
import { FullscreenButton } from '@/components/glow/fullscreen-button';
import { WakeLock } from '@/components/glow/wake-lock';
import { Button } from '@/components/ui/button';
import { NeonButton, NeonCard, NeonTitle, PageTransitionWrapper, SectionGlow } from '@/components/ui/neon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { labelFromPosition } from '@/lib/glow/matrix';
import { parseMatrixParam } from '@/lib/glow/join-url';
import { cn } from '@/lib/utils';
import {
  clearStoredDeviceId,
  getStoredDeviceId,
  storeDeviceId,
  getStoredNickname,
  storeNickname,
  clearStoredNickname,
} from '@/lib/glow/player-session';
import { useOrchestratorDelay } from '@/lib/glow/use-orchestrator-delay';
import { PlayerMenu } from '@/components/glow/player-menu';
import { ReactionsToolbar } from '@/components/glow/reactions-toolbar';
import { useTheme } from 'next-themes';
import { getSocialLabel, SOCIAL_KINDS, type RigSocial } from '@/lib/glow/social-kinds';
import type {
  EffectDistribution,
  FallbackModeEvent,
  VisualAudioFeaturesEvent,
  VisualColorEvent,
  VisualPresetEvent,
} from '@/lib/glow/types';

type JoinResponse = {
  accepted: boolean;
  reason?: string;
  reconnected?: boolean;
  devicePublicId?: string;
  label?: string;
  row?: number;
  col?: number;
  matrix?: { rows: number; cols: number };
};

function NicknameGate({
  roomCode,
  hostName,
  hostSocials,
  onSubmit,
}: {
  roomCode: string;
  hostName?: string;
  hostSocials?: RigSocial[];
  onSubmit: (nickname: string) => void;
}) {
  const [nick, setNick] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = nick.trim();
    if (!trimmed) {
      setError('Nickname is required');
      return;
    }
    if (trimmed.length > 24) {
      setError('Nickname must be 24 characters or less');
      return;
    }
    onSubmit(trimmed);
  };

  return (
    <div className="dark relative flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 py-10 overflow-hidden">
      <SectionGlow glowColor="cyan" position="center" />
      <PageTransitionWrapper className="w-full max-w-sm">
        <NeonCard glowColor="cyan" borderVariant="cyan" className="p-8">
          {/* Who is inviting you section */}
          {(hostName || (hostSocials && hostSocials.length > 0)) && (
            <div className="mb-6 rounded-xl border border-white/5 bg-zinc-900/50 p-4">
              <div className="text-center mb-2">
                <span className="text-[9px] font-cyber tracking-widest text-zinc-500 uppercase">
                  WHO IS INVITING YOU?
                </span>
                {hostName && (
                  <h4 className="text-sm font-bold text-neon-cyan mt-1 uppercase tracking-wide">
                    {hostName}
                  </h4>
                )}
              </div>
              {hostSocials && hostSocials.length > 0 && (
                <div className="flex flex-wrap justify-center gap-1.5 mt-2">
                  {hostSocials.map((social, idx) => {
                    const label = getSocialLabel(social);
                    return (
                      <a
                        key={idx}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-white/10 bg-white/5 text-[10px] text-zinc-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all font-cyber uppercase tracking-wider cursor-pointer"
                      >
                        {label}
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="text-center mb-6">
            <NeonTitle as="h2" color="cyan" className="text-2xl font-black tracking-widest">
              WHO ARE YOU?
            </NeonTitle>
            <p className="text-[10px] font-cyber tracking-widest text-muted-foreground uppercase mt-1">
              Enter nickname to join room {roomCode}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="space-y-2">
              <Label htmlFor="nickname" className="font-cyber text-xs uppercase tracking-wider text-zinc-300">
                Nickname
              </Label>
              <Input
                id="nickname"
                value={nick}
                onChange={(e) => {
                  setNick(e.target.value);
                  if (error) setError(null);
                }}
                placeholder="Rave Dancer"
                className="font-cyber tracking-wide text-center"
                maxLength={24}
                autoFocus
              />
              {error && (
                <p className="text-[10px] text-red-500 font-cyber tracking-wide text-center mt-1 uppercase">
                  {error}
                </p>
              )}
            </div>
            
            <NeonButton type="submit" color="cyan" variant="solid" className="w-full text-xs uppercase tracking-widest h-11 mt-2">
              Enter the Grid
            </NeonButton>
          </form>
        </NeonCard>
      </PageTransitionWrapper>
    </div>
  );
}

function PlayerContent({
  code,
  nickname,
  matrixRequired,
  hostName,
  hostSocials,
}: {
  code: string;
  nickname?: string;
  matrixRequired: boolean;
  hostName?: string;
  hostSocials?: RigSocial[];
}) {
  const roomCode = code.toUpperCase();
  const router = useRouter();
  const { setTheme } = useTheme();

  // Force dark theme on mount
  useEffect(() => {
    setTheme('dark');
  }, [setTheme]);

  const { connected, emit, emitWithCallback, on, socket, roomState } = useGlowSocket();
  const [joined, setJoined] = useState(false);

  const handleExit = useCallback(() => {
    clearStoredDeviceId(roomCode);
    clearStoredNickname(roomCode);
    socket.current?.disconnect();
    router.push('/join');
  }, [roomCode, socket, router]);
  const { delayMs, trackOrchestratorMessage } = useOrchestratorDelay({
    connected,
    enabled: joined,
    emit,
    on,
  });
  const [devicePublicId, setDevicePublicId] = useState<string | null>(null);
  const [connectionLost, setConnectionLost] = useState(false);
  const [reconnecting, setReconnecting] = useState(false);
  const [reconnectError, setReconnectError] = useState<string | null>(null);
  const [joinFailedReason, setJoinFailedReason] = useState<string | null>(null);
  const [position, setPosition] = useState<{ row: number; col: number; label?: string } | null>(
    null
  );
  const [matrixSize, setMatrixSize] = useState({ rows: 3, cols: 3 });
  const [pickMode, setPickMode] = useState(matrixRequired);
  const wasConnectedRef = useRef(false);

  const [activeNickname, setActiveNickname] = useState<string | null>(null);
  const [initializedNickname, setInitializedNickname] = useState(false);

  // Initialize activeNickname on mount
  useEffect(() => {
    const urlNickname = nickname?.trim();
    if (urlNickname && urlNickname.length >= 1 && urlNickname.length <= 24) {
      storeNickname(roomCode, urlNickname);
      setActiveNickname(urlNickname);
      setInitializedNickname(true);
      return;
    }

    const stored = getStoredNickname(roomCode);
    if (stored) {
      setActiveNickname(stored);
      setInitializedNickname(true);
      return;
    }

    setInitializedNickname(true);
  }, [nickname, roomCode]);

  const visual = useVisualEngine({
    roomCode,
    devicePublicId: devicePublicId ?? undefined,
    row: position?.row ?? 0,
    col: position?.col ?? 0,
    matrixRows: matrixSize.rows,
    matrixCols: matrixSize.cols,
  });

  const applyJoinResponse = useCallback(
    (response: JoinResponse) => {
      if (!response.accepted) return false;

      setJoined(true);
      setConnectionLost(false);
      setReconnectError(null);

      if (response.devicePublicId) {
        setDevicePublicId(response.devicePublicId);
        storeDeviceId(roomCode, response.devicePublicId);
      }

      if (response.matrix) setMatrixSize(response.matrix);

      if (response.row !== undefined && response.col !== undefined) {
        setPosition({ row: response.row, col: response.col, label: response.label });
        setPickMode(false);
      } else if (!matrixRequired) {
        setPickMode(false);
      }

      return true;
    },
    [matrixRequired, roomCode]
  );

  const attemptRejoin = useCallback(
    async (publicId: string) => {
      if (!activeNickname) return false;
      setReconnecting(true);
      setReconnectError(null);

      const response = await emitWithCallback<JoinResponse>('player:rejoin_room', {
        roomCode,
        devicePublicId: publicId,
        nickname: activeNickname,
      });

      setReconnecting(false);

      if (applyJoinResponse(response)) {
        return true;
      }

      clearStoredDeviceId(roomCode);
      setDevicePublicId(null);
      setReconnectError(response.reason ?? 'Could not reconnect');
      // Set reason only if server explicitly rejected with room ended/not found
      if (response.reason === 'Room not found') {
        setJoinFailedReason(response.reason);
      }
      return false;
    },
    [applyJoinResponse, emitWithCallback, activeNickname, roomCode]
  );

  const joinAsNewPlayer = useCallback(async () => {
    if (!activeNickname) return;
    const response = await emitWithCallback<JoinResponse>('player:join_room', {
      roomCode,
      nickname: activeNickname,
    });

    if (!applyJoinResponse(response)) {
      setJoinFailedReason(response.reason ?? 'Could not join room');
    }
  }, [applyJoinResponse, emitWithCallback, activeNickname, roomCode]);

  useEffect(() => {
    if (!connected || joined || !activeNickname) return;

    async function joinOrRejoin() {
      const storedId = getStoredDeviceId(roomCode);
      if (storedId) {
        const rejoined = await attemptRejoin(storedId);
        if (rejoined) return;
      }

      await joinAsNewPlayer();
    }

    void joinOrRejoin();
  }, [connected, joined, roomCode, attemptRejoin, joinAsNewPlayer, activeNickname]);

  useEffect(() => {
    if (!joined) return;

    if (connected) {
      wasConnectedRef.current = true;
      return;
    }

    if (wasConnectedRef.current) {
      setConnectionLost(true);
    }
  }, [connected, joined]);

  useEffect(() => {
    if (!connected || !connectionLost || !devicePublicId || reconnecting) return;
    void attemptRejoin(devicePublicId);
  }, [connected, connectionLost, devicePublicId, reconnecting, attemptRejoin]);

  useEffect(() => {
    const unsubscribers = [
      on('visual:color', (event) => {
        const payload = event as VisualColorEvent;
        trackOrchestratorMessage(payload.targetTimestamp);
        visual.scheduleColor(payload);
      }),
      on('visual:preset', (event) => {
        const payload = event as VisualPresetEvent;
        trackOrchestratorMessage(payload.targetTimestamp, payload.seedTimestamp);
        visual.schedulePreset(payload);
      }),
      on('visual:effect_distribution', (event) => {
        const payload = event as EffectDistribution;
        trackOrchestratorMessage(payload.targetTimestamp, payload.seedTimestamp);
        visual.scheduleEffectDistribution(payload);
      }),
      on('visual:audio_features', (event) => {
        visual.setAudioFeatures(event as VisualAudioFeaturesEvent);
      }),
      on('fallback:mode_changed', (event) => {
        const payload = event as FallbackModeEvent;
        trackOrchestratorMessage(payload.seedTimestamp, payload.seedTimestamp);
        visual.setFallbackMode(payload);
      }),
      on('device:identify', (event) => {
        const payload = event as { label: string };
        visual.triggerIdentify(payload.label);
      }),
      on('device:position_updated', (event) => {
        const payload = event as { row: number; col: number; label: string };
        setPosition(payload);
        setPickMode(false);
      }),
      on('visual:media', (event) => {
        const payload = event as any;
        visual.scheduleMedia(payload);
      }),
      on('visual:media_clear', () => {
        visual.clearMedia();
      }),
      on('media_clear', () => {
        visual.clearMedia();
      }),
      on('room:closed', (event: any) => {
        setJoined(false);
        setJoinFailedReason(
          event?.reason === 'duration_limit'
            ? 'Room session has reached its duration limit.'
            : 'The host has ended this room session.'
        );
      }),
    ];

    return () => {
      unsubscribers.forEach((unsub) => unsub?.());
    };
  }, [on, trackOrchestratorMessage, visual]);

  async function requestPosition(row: number, col: number) {
    const response = await emitWithCallback<{
      ok: boolean;
      reason?: string;
      label?: string;
      row?: number;
      col?: number;
    }>('player:request_position', {
      roomCode,
      row,
      col,
    });

    if (!response.ok) {
      alert(response.reason ?? 'Position unavailable');
      return;
    }

    setPosition({ row: response.row!, col: response.col!, label: response.label });
    setPickMode(false);
  }

  async function handleManualReconnect() {
    if (!devicePublicId) return;
    await attemptRejoin(devicePublicId);
  }

  async function handleJoinAsNew() {
    clearStoredDeviceId(roomCode);
    setDevicePublicId(null);
    setJoined(false);
    setConnectionLost(false);
    setReconnectError(null);
    await joinAsNewPlayer();
  }

  const displayLabel = visual.identifyLabel ?? position?.label;
  const statusLabel = reconnecting
    ? 'Reconnecting...'
    : connected
      ? 'Online'
      : connectionLost
        ? 'Disconnected'
        : 'Connecting...';

  if (joinFailedReason) {
    return (
      <div className="dark relative flex min-h-[100dvh] flex-col items-center justify-center bg-background px-6 py-10 overflow-hidden">
        <SectionGlow glowColor="magenta" position="center" />
        <PageTransitionWrapper className="w-full max-w-sm">
          <NeonCard glowColor="magenta" borderVariant="magenta" className="p-8">
            <div className="text-center mb-6">
              <NeonTitle as="h2" color="magenta" className="text-2xl font-black tracking-widest">
                SESSION ENDED
              </NeonTitle>
              <p className="text-sm font-cyber tracking-wide text-zinc-300 mt-4 uppercase">
                {joinFailedReason}
              </p>
            </div>

            <NeonButton
              type="button"
              color="magenta"
              variant="solid"
              className="w-full text-xs uppercase tracking-widest h-11"
              onClick={() => {
                clearStoredDeviceId(roomCode);
                clearStoredNickname(roomCode);
                router.push('/join');
              }}
            >
              Return to Home
            </NeonButton>
          </NeonCard>
        </PageTransitionWrapper>
      </div>
    );
  }

  if (initializedNickname && !activeNickname) {
    return (
      <NicknameGate
        roomCode={roomCode}
        hostName={hostName}
        hostSocials={hostSocials}
        onSubmit={(nick) => {
          storeNickname(roomCode, nick);
          setActiveNickname(nick);
        }}
      />
    );
  }

  return (
    <div
      className="relative flex min-h-[100dvh] flex-col bg-background"
      style={!pickMode ? { backgroundColor: visual.identifying ? '#ffffff' : visual.color } : undefined}
    >
      <WakeLock />

      {/* Media Overlay */}
      {!pickMode && visual.activeMedia && (
        <div className="absolute inset-0 z-0 pointer-events-none flex items-center justify-center overflow-hidden">
          {visual.activeMedia.kind === 'image' && visual.activeMedia.url && (
            <img
              src={visual.activeMedia.url}
              alt="Broadcast media"
              className={cn(
                "w-full h-full",
                visual.activeMedia.fit === 'contain' ? 'object-contain bg-black' : 'object-cover'
              )}
            />
          )}
          {visual.activeMedia.kind === 'gif' && visual.activeMedia.url && (
            <img
              src={visual.activeMedia.url}
              alt="Broadcast GIF"
              className="w-full h-full object-contain bg-black"
            />
          )}
          {visual.activeMedia.kind === 'text' && visual.activeMedia.text && (
            <div className="w-full h-full flex items-center justify-center p-4">
              <SequencedTextRenderer
                text={visual.activeMedia.text}
                mode={visual.activeMedia.mode || 'marquee'}
                speed={visual.activeMedia.speed || 5}
                colorHex={visual.activeMedia.colorHex}
                loop={visual.activeMedia.loop ?? true}
                row={position?.row}
                col={position?.col}
                matrix={matrixSize}
                fontSize={visual.activeMedia.fontSize}
              />
            </div>
          )}
        </div>
      )}

      <div className="dark absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4">
        <div className="rounded bg-black/40 px-3 py-1 text-xs text-white">
          {statusLabel}
          {joined && connected && delayMs !== null ? ` (${delayMs}ms)` : ''}
        </div>
        {!joined && <FullscreenButton />}
      </div>

      {!pickMode && (displayLabel || visual.identifying) ? (
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center p-4">
          {visual.identifying ? (
            <>
              <span className="font-bold text-black text-5xl md:text-7xl tracking-wide animate-pulse">
                {activeNickname}
              </span>
              {displayLabel && (
                <span className="font-cyber text-black/60 text-xl md:text-2xl mt-4 tracking-widest uppercase">
                  {displayLabel}
                </span>
              )}
            </>
          ) : (
            displayLabel && (
              <span
                className="font-bold text-white/20"
                style={{ fontSize: '30vw' }}
              >
                {displayLabel}
              </span>
            )
          )}
        </div>
      ) : null}

      {matrixRequired && pickMode && joined && connected ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4">
          <p className="text-center text-white">Pick your position</p>
          <div
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${matrixSize.cols}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: matrixSize.rows * matrixSize.cols }).map((_, index) => {
              const row = Math.floor(index / matrixSize.cols);
              const col = index % matrixSize.cols;
              return (
                <Button
                  key={`${row}-${col}`}
                  variant="outline"
                  className="aspect-square border-white/20 bg-black/30 text-white"
                  onClick={() => void requestPosition(row, col)}
                >
                  {labelFromPosition(row, col)}
                </Button>
              );
            })}
          </div>
        </div>
      ) : null}

      {connectionLost && !reconnecting ? (
        <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-3 p-4">
          <div className="w-full max-w-sm rounded-xl border border-white/20 bg-black/70 p-4 text-center text-white backdrop-blur">
            <p className="text-sm">Connection lost. Rejoin!</p>
            {reconnectError ? (
              <p className="mt-2 text-xs text-amber-300">{reconnectError}</p>
            ) : null}
            <div className="mt-4 flex flex-col gap-2">
              <Button onClick={() => void handleManualReconnect()} disabled={!devicePublicId}>
                Reconnect
              </Button>
              <Button variant="outline" onClick={() => void handleJoinAsNew()}>
                Join as new player
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      {joined && activeNickname && (
        <>
          <PlayerMenu
            roomCode={roomCode}
            nickname={activeNickname}
            displayLabel={displayLabel}
            onExit={handleExit}
          />
          <ReactionsToolbar
            roomCode={roomCode}
            roomState={roomState}
            onEmit={emit}
          />
        </>
      )}
    </div>
  );
}

function PlayerSearchParams({ code }: { code: string }) {
  const searchParams = useSearchParams();
  const nickname = searchParams.get('nickname') ?? undefined;
  const matrixRequired = parseMatrixParam(searchParams.get('matrix'));
  const hostName = searchParams.get('hostName') ?? undefined;

  const hostSocials = useMemo(() => {
    const socials: RigSocial[] = [];
    SOCIAL_KINDS.forEach((kind, index) => {
      const urlVal = searchParams.get(kind.value);
      if (urlVal) {
        socials.push({
          kind: kind.value,
          url: urlVal,
          enabled: true,
          sortOrder: index,
        });
      }
    });
    return socials;
  }, [searchParams]);

  return (
    <PlayerContent
      code={code}
      nickname={nickname}
      matrixRequired={matrixRequired}
      hostName={hostName}
      hostSocials={hostSocials}
    />
  );
}

export default function PlayerPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = use(params);

  return (
    <Suspense fallback={<div className="min-h-[100dvh] bg-black" />}>
      <PlayerSearchParams code={code} />
    </Suspense>
  );
}

type SequencedTextRendererProps = {
  text: string;
  mode: 'marquee' | 'word_by_word' | 'spread_grid';
  speed: number;
  colorHex?: string;
  loop: boolean;
  row?: number;
  col?: number;
  matrix: { rows: number; cols: number };
  fontSize?: number;
};

function SequencedTextRenderer({
  text,
  mode,
  speed,
  colorHex = '#ffffff',
  loop,
  row,
  col,
  matrix,
  fontSize,
}: SequencedTextRendererProps) {
  const [wordIdx, setWordIdx] = useState(0);
  const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

  // Handle word_by_word mode
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

  // Handle spread_grid mode
  const gridWord = useMemo(() => {
    if (mode !== 'spread_grid' || row === undefined || col === undefined || words.length === 0) {
      return null;
    }
    const cellIndex = row * matrix.cols + col;
    const pageSize = matrix.rows * matrix.cols;
    const numPages = Math.ceil(words.length / pageSize);
    const pageDurationMs = (pageSize / Math.max(0.1, speed)) * 1000;
    
    return { cellIndex, pageSize, numPages, pageDurationMs };
  }, [mode, row, col, words.length, matrix.rows, matrix.cols, speed]);

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
            !fontSize && "text-3xl md:text-5xl"
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
          !fontSize && "text-4xl md:text-6xl"
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
    if (row === undefined || col === undefined) {
      const duration = Math.max(3, text.length / Math.max(1, speed));
      return (
        <div className="w-full whitespace-nowrap overflow-hidden">
          <span
            className={cn(
              "inline-block font-cyber font-black tracking-widest uppercase",
              !fontSize && "text-3xl md:text-5xl"
            )}
            style={{
              color: colorHex,
              fontSize: fontSize ? `${fontSize}px` : undefined,
              animation: `marquee ${duration}s linear ${loop ? 'infinite' : '1'}`,
            }}
          >
            {text}
          </span>
        </div>
      );
    }

    if (!gridWord) return null;
    const wordIndex = gridPage * gridWord.pageSize + gridWord.cellIndex;
    const currentWord = words[wordIndex] || '';

    return (
      <span
        className={cn(
          "font-cyber font-black tracking-widest uppercase",
          !fontSize && "text-4xl md:text-6xl"
        )}
        style={{
          color: colorHex,
          fontSize: fontSize ? `${fontSize}px` : undefined,
        }}
        key={wordIndex}
      >
        {currentWord}
      </span>
    );
  }

  return null;
}
