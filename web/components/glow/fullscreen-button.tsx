'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Maximize2 } from 'lucide-react';

export function FullscreenButton() {
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const isSupported = !!(
      document.fullscreenEnabled ||
      (document as any).webkitFullscreenEnabled ||
      (document as any).mozFullScreenEnabled ||
      (document as any).msFullscreenEnabled
    );
    setSupported(isSupported);
  }, []);

  async function enterFullscreen() {
    try {
      const el = document.documentElement as any;
      const reqFs = el.requestFullscreen || el.webkitRequestFullscreen || el.mozRequestFullScreen || el.msRequestFullscreen;
      if (reqFs) {
        await reqFs.call(el);
      }
    } catch {
      // Best effort only
    }
  }

  if (!supported) return null;

  return (
    <Button variant="outline" size="sm" onClick={enterFullscreen}>
      <Maximize2 data-icon="inline-start" />
      Fullscreen
    </Button>
  );
}
