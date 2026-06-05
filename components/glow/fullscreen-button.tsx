'use client';

import { Button } from '@/components/ui/button';
import { Maximize2 } from 'lucide-react';

export function FullscreenButton() {
  async function enterFullscreen() {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Best effort only
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={enterFullscreen}>
      <Maximize2 data-icon="inline-start" />
      Fullscreen
    </Button>
  );
}
