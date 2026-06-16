'use client';

import type { ReactNode } from 'react';
import type { ConsoleMode } from '@/lib/glow/console-mode';
import {
  parsePlayerChromeConfig,
  type PlayerChromeConfig,
  type PlayerChromeUserLogoLayer,
} from '@/lib/glow/player-chrome-config';
import type { PlanEntitlements } from '@/lib/glow/types';
import type { PatternSequenceDraft } from '@/lib/glow/pattern-sequences';
import { NeonCard } from '@/components/ui/neon';
import {
  PlayerChromeLayersPanel,
  PlayerChromeOperateHint,
} from '@/components/glow/player-chrome-layers-panel';
import { PlayerChromePreviewShell } from '@/components/glow/player-chrome-preview-shell';
import { ResizableTwoColumn } from '@/components/glow/resizable-two-column';
import { cn } from '@/lib/utils';

type PlayDevicesDeskProps = {
  roomCode: string;
  mode: ConsoleMode;
  previewBackgroundColor: string;
  playerChrome: PlayerChromeConfig;
  entitlements: PlanEntitlements;
  logoUrl: string | null;
  previewDraft?: PatternSequenceDraft | null;
  uploadingLogo?: boolean;
  onLogoUpload?: (file: File) => void;
  onEnterEditLayout?: () => void;
  onPlayerChromeChange: (next: PlayerChromeConfig) => void;
  children: ReactNode;
};

export function PlayDevicesDesk({
  roomCode,
  mode,
  previewBackgroundColor,
  playerChrome,
  entitlements,
  logoUrl,
  previewDraft,
  uploadingLogo = false,
  onLogoUpload,
  onEnterEditLayout,
  onPlayerChromeChange,
  children,
}: PlayDevicesDeskProps) {
  const editing = mode === 'edit';

  function handleUserLogoChange(layer: PlayerChromeUserLogoLayer) {
    onPlayerChromeChange({
      ...playerChrome,
      layers: {
        ...playerChrome.layers,
        userLogo: layer,
      },
    });
  }

  return (
    <ResizableTwoColumn
      storageKey="glow_desk_preview_w"
      left={
        <NeonCard
          glowColor={editing ? 'violet' : 'cyan'}
          borderVariant={editing ? 'violet' : 'cyan'}
          hoverEffect={false}
          className={cn('p-5 sm:p-6 lg:sticky lg:top-6', editing && 'ring-1 ring-neon-violet/30')}
        >
          <PlayerChromePreviewShell
            roomCode={roomCode}
            renderMode="embedded"
            backgroundColor={previewBackgroundColor}
            playerChrome={playerChrome}
            entitlements={entitlements}
            logoUrl={logoUrl}
            editMode={editing}
            draft={previewDraft}
            onUserLogoChange={editing ? handleUserLogoChange : undefined}
          />
          {editing && onLogoUpload ? (
            <PlayerChromeLayersPanel
              playerChrome={playerChrome}
              onPlayerChromeChange={onPlayerChromeChange}
              entitlements={entitlements}
              logoUrl={logoUrl}
              uploadingLogo={uploadingLogo}
              onLogoUpload={onLogoUpload}
            />
          ) : !editing && onEnterEditLayout ? (
            <PlayerChromeOperateHint onEditLayout={onEnterEditLayout} />
          ) : null}
        </NeonCard>
      }
      right={<div className="flex min-w-0 flex-col gap-6">{children}</div>}
    />
  );
}

export function getPlayerChromeFromRig(
  consoleConfig: Record<string, unknown> | undefined
): PlayerChromeConfig {
  return parsePlayerChromeConfig(consoleConfig?.playerChrome);
}
