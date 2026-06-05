'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MockAd } from '@/components/glow/mock-ad';

export default function JoinPage() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState('');
  const [nickname, setNickname] = useState('');
  const [showAd, setShowAd] = useState(false);

  function handleJoin() {
    if (!roomCode.trim()) return;
    setShowAd(true);
  }

  function continueToPlayer() {
    const params = new URLSearchParams();
    if (nickname.trim()) params.set('nickname', nickname.trim());
    router.push(`/room/${roomCode.toUpperCase()}/play?${params.toString()}`);
  }

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-4 py-10">
      {showAd ? (
        <MockAd
          placement="room_join"
          onComplete={() => {
            setShowAd(false);
            continueToPlayer();
          }}
          onTrack={() => {
            void fetch('/api/ads', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ placement: 'room_join', viewerType: 'player' }),
            });
          }}
        />
      ) : null}

      <Card className="border-white/10 bg-zinc-900 text-white">
        <CardHeader>
          <CardTitle>Join a Room</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div>
            <Label htmlFor="roomCode">Room Code</Label>
            <Input
              id="roomCode"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              placeholder="A7B9"
              className="mt-2 uppercase"
              maxLength={6}
            />
          </div>
          <div>
            <Label htmlFor="nickname">Nickname (optional)</Label>
            <Input
              id="nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="Phone 1"
              className="mt-2"
            />
          </div>
          <Button onClick={handleJoin} disabled={!roomCode.trim()}>
            Join Room
          </Button>
          <Link href="/" className="text-center text-sm text-zinc-400 hover:text-white">
            Back home
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
