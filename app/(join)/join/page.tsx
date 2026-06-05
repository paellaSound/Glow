'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { NeonButton, NeonCard, NeonTitle, PageTransitionWrapper, SectionGlow } from '@/components/ui/neon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
    <main className="relative mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center px-6 py-10 overflow-hidden">
      <SectionGlow glowColor="cyan" position="center" />

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

      <PageTransitionWrapper>
        <NeonCard glowColor="cyan" borderVariant="cyan" className="p-8">
          <div className="text-center mb-6">
            <NeonTitle as="h2" color="cyan" className="text-2xl font-black tracking-widest">
              JOIN ROOM
            </NeonTitle>
            <p className="text-[10px] font-cyber tracking-widest text-muted-foreground uppercase mt-1">
              Connect to the lighting grid
            </p>
          </div>

          <div className="flex flex-col gap-5">
            <div className="space-y-2">
              <Label htmlFor="roomCode" className="font-cyber text-xs uppercase tracking-wider text-zinc-300">Room Code</Label>
              <Input
                id="roomCode"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="A7B9"
                className="uppercase font-cyber tracking-widest text-center"
                maxLength={6}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nickname" className="font-cyber text-xs uppercase tracking-wider text-zinc-300">Nickname (optional)</Label>
              <Input
                id="nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                placeholder="Phone 1"
                className="font-cyber tracking-wide text-center"
              />
            </div>
            
            <NeonButton onClick={handleJoin} color="cyan" variant="solid" className="w-full text-xs uppercase tracking-widest h-11 mt-2" disabled={!roomCode.trim()}>
              Connect Device
            </NeonButton>
            
            <Link href="/" className="text-center text-xs font-cyber uppercase tracking-widest text-zinc-500 hover:text-white transition-colors pt-2">
              Back home
            </Link>
          </div>
        </NeonCard>
      </PageTransitionWrapper>
    </main>
  );
}
