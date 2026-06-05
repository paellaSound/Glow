'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { NeonButton, NeonCard, NeonTitle, PageTransitionWrapper, SectionGlow } from '@/components/ui/neon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MockAd } from '@/components/glow/mock-ad';
import { useGlowSocket } from '@/lib/glow/socket';
import { createClient } from '@/lib/supabase/client';
import type { PlanEntitlements } from '@/lib/glow/types';

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export default function CreateRoomPage() {
  const router = useRouter();
  const { data } = useSWR<{ team: { id: string }; entitlements: PlanEntitlements }>(
    '/api/team',
    fetcher
  );
  const { emitWithCallback } = useGlowSocket();
  const [positionRequired, setPositionRequired] = useState(false);
  const [rows, setRows] = useState(3);
  const [cols, setCols] = useState(3);
  const [creating, setCreating] = useState(false);
  const [showAd, setShowAd] = useState(false);
  const [pendingCreate, setPendingCreate] = useState(false);

  const entitlements = data?.entitlements;
  const adsEnabled = entitlements?.adsEnabled ?? true;

  async function createRoom() {
    setCreating(true);
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        router.push('/sign-in?redirect=/room/new');
        return;
      }

      const response = await emitWithCallback<{
        roomCode?: string;
        error?: string;
      }>('orchestrator:create_room', {
        accessToken: session.access_token,
        matrix: positionRequired ? { rows, cols } : { rows: 1, cols: 1 },
      });

      if (response.error || !response.roomCode) {
        alert(response.error ?? 'Failed to create room');
        return;
      }

      const matrixQuery = positionRequired ? 'matrix=1' : 'matrix=0';
      router.push(`/room/${response.roomCode}/control?${matrixQuery}`);
    } finally {
      setCreating(false);
      setPendingCreate(false);
    }
  }

  function handleCreateClick() {
    if (adsEnabled) {
      setShowAd(true);
      setPendingCreate(true);
      return;
    }
    void createRoom();
  }

  return (
    <main className="relative mx-auto max-w-lg px-6 py-12 min-h-[100dvh] flex flex-col justify-center overflow-hidden">
      <SectionGlow glowColor="magenta" position="center" />

      {showAd && pendingCreate ? (
        <MockAd
          placement="room_create"
          onComplete={() => {
            setShowAd(false);
            void createRoom();
          }}
          onTrack={() => {
            void fetch('/api/ads', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ placement: 'room_create', viewerType: 'orchestrator' }),
            });
          }}
        />
      ) : null}

      <PageTransitionWrapper>
        <NeonCard glowColor="magenta" borderVariant="magenta" className="p-8">
          <div className="text-center mb-8">
            <NeonTitle as="h2" color="magenta" className="text-2xl font-black tracking-widest animate-pulse">
              GLOW YOUR RAVE
            </NeonTitle>
            <p className="text-[10px] font-cyber tracking-widest text-muted-foreground uppercase mt-1">
              SET UP THE LIGHTROOM GRID
            </p>
          </div>

          <div className="flex flex-col gap-6">
            <div className="rounded-xl border border-white/5 dark:bg-white/5 bg-zinc-50 p-4 transition-all duration-300">
              <label className="flex cursor-pointer items-start gap-3">
                <input
                  type="checkbox"
                  checked={positionRequired}
                  onChange={(e) => setPositionRequired(e.target.checked)}
                  className="mt-1 rounded-full border-border bg-transparent text-neon-magenta focus:ring-neon-magenta"
                />
                <span className="flex flex-col gap-1">
                  <span className="font-cyber text-sm font-semibold tracking-wide text-foreground">Position Screens in a Grid Matrix?</span>
                  <span className="text-xs text-muted-foreground leading-normal">
                    {positionRequired
                      ? 'Screens will lock to specific coordinates. Perfect for scrolling wave patterns and visual gradients.'
                      : 'Screens join as one unified strobe unit. Colors and flashes sync globally.'}
                  </span>
                </span>
              </label>
            </div>

            {positionRequired ? (
              <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="space-y-2">
                  <Label htmlFor="rows" className="font-cyber text-xs uppercase tracking-wider text-zinc-300">Grid Rows</Label>
                  <Input
                    id="rows"
                    type="number"
                    min={1}
                    max={entitlements?.maxGridRows ?? 5}
                    value={rows}
                    onChange={(e) => setRows(Number(e.target.value))}
                    className="font-cyber tracking-wide text-center"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cols" className="font-cyber text-xs uppercase tracking-wider text-zinc-300">Grid Columns</Label>
                  <Input
                    id="cols"
                    type="number"
                    min={1}
                    max={entitlements?.maxGridCols ?? 5}
                    value={cols}
                    onChange={(e) => setCols(Number(e.target.value))}
                    className="font-cyber tracking-wide text-center"
                  />
                </div>
              </div>
            ) : null}

            <p className="text-xs font-cyber tracking-wide text-muted-foreground text-center">
              Rave Limit: Up to {entitlements?.maxDevices ?? 10} synced screens
              {positionRequired
                ? ` · ${entitlements?.maxGridRows ?? 5}x${entitlements?.maxGridCols ?? 5} max grid`
                : ''}
            </p>
            
            <NeonButton onClick={handleCreateClick} color="magenta" variant="solid" className="w-full text-xs uppercase tracking-widest h-11" disabled={creating}>
              {creating ? 'DEPLOYING RIG...' : 'LAUNCH RAVE LIGHTSHOW'}
            </NeonButton>
          </div>
        </NeonCard>
      </PageTransitionWrapper>
    </main>
  );
}
