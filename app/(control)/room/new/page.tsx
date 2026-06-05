'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
        matrix: { rows, cols },
      });

      if (response.error || !response.roomCode) {
        alert(response.error ?? 'Failed to create room');
        return;
      }

      router.push(`/room/${response.roomCode}/control`);
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
    <main className="mx-auto max-w-lg px-4 py-10">
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

      <Card className="border-white/10 bg-zinc-900 text-white">
        <CardHeader>
          <CardTitle>Create Matrix Room</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label htmlFor="rows">Rows</Label>
            <Input
              id="rows"
              type="number"
              min={1}
              max={entitlements?.maxGridRows ?? 5}
              value={rows}
              onChange={(e) => setRows(Number(e.target.value))}
              className="mt-2"
            />
          </div>
          <div>
            <Label htmlFor="cols">Columns</Label>
            <Input
              id="cols"
              type="number"
              min={1}
              max={entitlements?.maxGridCols ?? 5}
              value={cols}
              onChange={(e) => setCols(Number(e.target.value))}
              className="mt-2"
            />
          </div>
          <p className="text-sm text-zinc-400">
            Plan limit: {entitlements?.maxDevices ?? 10} devices ·{' '}
            {entitlements?.maxGridRows ?? 5}x{entitlements?.maxGridCols ?? 5} max grid
          </p>
          <Button onClick={handleCreateClick} disabled={creating}>
            {creating ? 'Creating...' : 'Create Room'}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
