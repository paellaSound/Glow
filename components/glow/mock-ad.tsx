'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type MockAdProps = {
  placement: 'room_create' | 'room_join';
  onComplete: () => void;
  onTrack?: () => void;
};

export function MockAd({ placement, onComplete, onTrack }: MockAdProps) {
  const [secondsLeft, setSecondsLeft] = useState(3);

  useEffect(() => {
    onTrack?.();
  }, [onTrack]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = window.setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4">
      <Card className="w-full max-w-md border-orange-500/30 bg-zinc-950 text-white">
        <CardHeader>
          <CardTitle>Sponsored</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex h-40 items-center justify-center rounded-lg border border-dashed border-orange-500/40 bg-orange-500/10">
            <div className="text-center">
              <p className="text-lg font-semibold text-orange-400">Glow Mock Ad</p>
              <p className="text-sm text-zinc-400">
                {placement === 'room_create' ? 'Before creating your room' : 'Before joining the room'}
              </p>
            </div>
          </div>
          <Button
            className="w-full"
            disabled={secondsLeft > 0}
            onClick={onComplete}
          >
            {secondsLeft > 0 ? `Continue in ${secondsLeft}s` : 'Continue'}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
