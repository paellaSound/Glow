'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useState } from 'react';
import useSWR from 'swr';
import { cn } from '@/lib/utils';
import { useGlowSocket } from '@/lib/glow/socket';

const fetcher = (url: string) => fetch(url).then((res) => (res.ok ? res.json() : null));

export type ActiveRoomResponse = { roomCode: string } | null;

export function useActiveRoom() {
  return useSWR<ActiveRoomResponse>('/api/rooms/active', fetcher, {
    refreshInterval: 30_000,
    revalidateOnFocus: true,
  });
}

export function useEndActiveRoom(roomCode: string | undefined) {
  const router = useRouter();
  const pathname = usePathname();
  const { mutate } = useActiveRoom();
  const { emitWithCallback, connected } = useGlowSocket();
  const [ending, setEnding] = useState(false);

  async function endSession() {
    if (!roomCode) return;
    const confirmed = window.confirm(`End session ${roomCode}?`);
    if (!confirmed) return;

    setEnding(true);
    try {
      if (connected) {
        const response = await emitWithCallback<{ ok: boolean; reason?: string }>(
          'orchestrator:close_room',
          { roomCode }
        );
        if (!response.ok && response.reason !== 'Room not found') {
          alert(response.reason ?? 'Could not end the session. Open the control desk to terminate it manually.');
          return;
        }
      }
      await mutate(null, { revalidate: true });

      if (/^\/room\/[^/]+\/(control|control-device)(\/|$)/.test(pathname)) {
        router.push('/');
      }
    } catch {
      alert('Could not end the session. Open the control desk to terminate it manually.');
    } finally {
      setEnding(false);
    }
  }

  return { endSession, ending };
}

type OngoingSessionIndicatorProps = {
  className?: string;
};

/** Compact pill — home header only */
export function OngoingSessionIndicator({ className }: OngoingSessionIndicatorProps) {
  const { data } = useActiveRoom();
  const { endSession, ending } = useEndActiveRoom(data?.roomCode);

  if (!data?.roomCode) {
    return null;
  }

  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-full border border-neon-cyan/25 bg-neon-cyan/10 px-2.5 py-1',
        className
      )}
    >
      <span className="hidden text-[10px] font-cyber uppercase tracking-widest text-neon-cyan sm:inline whitespace-nowrap">
        Ongoing · {data.roomCode}
      </span>
      <span className="text-[10px] font-cyber uppercase tracking-widest text-neon-cyan sm:hidden">
        Live
      </span>
      <div className="flex items-center gap-1">
        <Link
          href={`/room/${data.roomCode}/control`}
          className="rounded-full bg-neon-cyan/20 px-2.5 py-0.5 text-[9px] font-cyber uppercase tracking-widest text-neon-cyan transition hover:bg-neon-cyan/30"
        >
          Resume
        </Link>
        <button
          type="button"
          disabled={ending}
          onClick={() => void endSession()}
          className="rounded-full border border-red-500/25 px-2.5 py-0.5 text-[9px] font-cyber uppercase tracking-widest text-red-400 transition hover:border-red-500/50 hover:text-red-300 disabled:opacity-50"
        >
          {ending ? '…' : 'End'}
        </button>
      </div>
    </div>
  );
}
