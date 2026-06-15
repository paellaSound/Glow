'use client';

import { Suspense, use, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { PlayerChromePreview } from '@/components/glow/player-chrome-preview';
import { mergeEntitlementsForUi } from '@/lib/entitlements-defaults';
import { parsePlayerChromeConfig, rigLogoPublicUrl } from '@/lib/glow/player-chrome-config';
import { useTeamEntitlements } from '@/lib/glow/use-team-entitlements';
import type { PlanEntitlements } from '@/lib/glow/types';

type ShareInfo = {
  playerChrome?: unknown;
  logoAssetPath?: string | null;
  customRigLogo?: boolean;
  removeWatermark?: boolean;
  entitlements?: PlanEntitlements;
};

type PreviewState = {
  backgroundColor: string;
  playerChrome: ReturnType<typeof parsePlayerChromeConfig>;
  logoUrl: string | null;
  editMode: boolean;
  entitlements: PlanEntitlements;
};

function PlayPreviewContent({ code }: { code: string }) {
  const searchParams = useSearchParams();
  const embedded = searchParams.get('embedded') === '1';
  const { teamEntitlements } = useTeamEntitlements();
  const [state, setState] = useState<PreviewState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const res = await fetch(`/api/rooms/${code.toUpperCase()}/share-info`);
        if (!res.ok) return;
        const data = (await res.json()) as ShareInfo;
        if (cancelled) return;

        const roomEntitlements = data.entitlements;
        const entitlements = mergeEntitlementsForUi(roomEntitlements, teamEntitlements);
        setState({
          backgroundColor: '#1a0533',
          playerChrome: parsePlayerChromeConfig(data.playerChrome),
          logoUrl:
            data.customRigLogo && data.logoAssetPath
              ? rigLogoPublicUrl(data.logoAssetPath)
              : null,
          editMode: false,
          entitlements,
        });
      } catch {
        // ignore
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [code, teamEntitlements]);

  useEffect(() => {
    if (!embedded) return;

    window.parent.postMessage({ type: 'player-chrome-ready' }, window.location.origin);

    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type !== 'player-chrome-update') return;
      const payload = event.data.payload as PreviewState;
      setState((prev) =>
        prev
          ? {
              ...prev,
              backgroundColor: payload.backgroundColor ?? prev.backgroundColor,
              playerChrome: payload.playerChrome ?? prev.playerChrome,
              logoUrl: payload.logoUrl ?? prev.logoUrl,
              editMode: payload.editMode ?? prev.editMode,
            }
          : prev
      );
    }

    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [embedded]);

  if (!state) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-black text-[10px] font-cyber uppercase tracking-widest text-zinc-500">
        Loading preview…
      </div>
    );
  }

  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-black p-4">
      <PlayerChromePreview
        backgroundColor={state.backgroundColor}
        playerChrome={state.playerChrome}
        entitlements={state.entitlements}
        logoUrl={state.logoUrl}
        editMode={state.editMode}
        className="w-full max-w-none"
      />
    </div>
  );
}

export default function PlayPreviewPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[100dvh] items-center justify-center bg-black text-zinc-500">
          Loading…
        </div>
      }
    >
      <PlayPreviewContent code={code} />
    </Suspense>
  );
}
