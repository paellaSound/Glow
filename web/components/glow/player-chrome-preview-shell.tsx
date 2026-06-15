'use client';

import { useEffect, useRef, useState } from 'react';
import type { PlayerChromePreviewProps } from '@/components/glow/player-chrome-preview';
import { PlayerChromePreview } from '@/components/glow/player-chrome-preview';
import { cn } from '@/lib/utils';

export type PlayerChromePreviewShellProps = PlayerChromePreviewProps & {
  roomCode: string;
  renderMode?: 'embedded' | 'iframe';
};

type PreviewMessage =
  | { type: 'player-chrome-ready' }
  | {
      type: 'player-chrome-update';
      payload: {
        backgroundColor?: string;
        playerChrome: PlayerChromePreviewProps['playerChrome'];
        logoUrl?: string | null;
        editMode?: boolean;
      };
    };

export function PlayerChromePreviewShell({
  roomCode,
  renderMode = 'embedded',
  ...previewProps
}: PlayerChromePreviewShellProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeReady, setIframeReady] = useState(false);

  useEffect(() => {
    if (renderMode !== 'iframe' || !iframeReady || !iframeRef.current?.contentWindow) return;

    const message: PreviewMessage = {
      type: 'player-chrome-update',
      payload: {
        backgroundColor: previewProps.backgroundColor,
        playerChrome: previewProps.playerChrome,
        logoUrl: previewProps.logoUrl,
        editMode: previewProps.editMode,
      },
    };
    iframeRef.current.contentWindow.postMessage(message, window.location.origin);
  }, [renderMode, iframeReady, previewProps]);

  useEffect(() => {
    if (renderMode !== 'iframe') return;

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === 'player-chrome-ready') {
        setIframeReady(true);
      }
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [renderMode]);

  if (renderMode === 'iframe') {
    return (
      <div className={cn('flex flex-col gap-2', previewProps.className)}>
        <iframe
          ref={iframeRef}
          title="Player chrome preview"
          src={`/room/${roomCode.toLowerCase()}/play-preview?embedded=1`}
          className="mx-auto w-full max-w-[280px] rounded-[1.75rem] border border-white/15 bg-black shadow-lg"
          style={{ aspectRatio: '19.5 / 9', minHeight: 140 }}
        />
        <p className="text-center text-[10px] font-cyber uppercase tracking-wider text-muted-foreground">
          Player preview (iframe)
        </p>
      </div>
    );
  }

  return <PlayerChromePreview {...previewProps} />;
}
