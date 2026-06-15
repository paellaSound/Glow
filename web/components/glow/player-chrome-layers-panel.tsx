'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronDown, ChevronUp, ImageIcon, Lock, Smile, Upload } from 'lucide-react';
import { PlanGateUpsell } from '@/components/glow/plan-gate';
import {
  getUserLogoLayer,
  isPlayerMenuItemVisible,
  PLAYER_MENU_ITEMS,
  setPlayerMenuItemVisible,
  shouldShowFlashButton,
  shouldShowReactionsToolbar,
  shouldShowSyncDelay,
  type PlayerChromeConfig,
  type PlayerMenuItemId,
} from '@/lib/glow/player-chrome-config';
import type { PlanEntitlements } from '@/lib/glow/types';
import { cn } from '@/lib/utils';

type PlayerChromeLayersPanelProps = {
  playerChrome: PlayerChromeConfig;
  onPlayerChromeChange: (next: PlayerChromeConfig) => void;
  entitlements: PlanEntitlements;
  logoUrl: string | null;
  uploadingLogo: boolean;
  onLogoUpload: (file: File) => void;
  className?: string;
};

function LayerRow({
  title,
  description,
  children,
  locked,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
  locked?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-black/30 px-3 py-2.5">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {locked ? <Lock className="size-3 shrink-0 text-zinc-500" /> : null}
          <span className="text-[10px] font-cyber uppercase tracking-widest text-zinc-200">{title}</span>
        </div>
        <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function ToggleSwitch({
  checked,
  disabled,
  onChange,
  label,
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2',
        disabled && 'cursor-not-allowed opacity-50'
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-neon-violet size-4"
        aria-label={label}
      />
      <span className="text-[10px] font-cyber uppercase tracking-widest text-zinc-400">
        {checked ? 'On' : 'Off'}
      </span>
    </label>
  );
}

export function PlayerChromeLayersPanel({
  playerChrome,
  onPlayerChromeChange,
  entitlements,
  logoUrl,
  uploadingLogo,
  onLogoUpload,
  className,
}: PlayerChromeLayersPanelProps) {
  const [hudOpen, setHudOpen] = useState(false);
  const userLogo = getUserLogoLayer(playerChrome);
  const reactionsAvailable = entitlements.audienceReactions;
  const reactionsOn = shouldShowReactionsToolbar(playerChrome, entitlements);
  const flashOn = shouldShowFlashButton(playerChrome);
  const syncDelayOn = shouldShowSyncDelay(playerChrome);
  const hudVisibleCount = PLAYER_MENU_ITEMS.filter((item) =>
    isPlayerMenuItemVisible(playerChrome, item.id)
  ).length;

  function patchMenuItem(itemId: PlayerMenuItemId, visible: boolean) {
    onPlayerChromeChange(setPlayerMenuItemVisible(playerChrome, itemId, visible));
  }

  function patchUserLogo(patch: Partial<typeof userLogo>) {
    onPlayerChromeChange({
      ...playerChrome,
      layers: {
        ...playerChrome.layers,
        userLogo: { ...userLogo, ...patch },
      },
    });
  }

  return (
    <div className={cn('mt-4 space-y-4 border-t border-white/10 pt-4', className)}>
      <div>
        <h3 className="text-xs font-cyber font-bold uppercase tracking-widest text-neon-violet">
          Player screen
        </h3>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          Layout guide for connected phones. Drag the logo on the preview to place it — every other
          element is just on or off.
        </p>
      </div>

      <section className="space-y-2">
        <p className="text-[9px] font-cyber uppercase tracking-widest text-zinc-500">On screen</p>

        <LayerRow
          title="Your logo"
          description={
            entitlements.customRigLogo
              ? logoUrl
                ? 'Upload a new image or toggle visibility. Drag on the preview to move.'
                : 'Upload PNG/JPG/WebP/SVG (max 256KB). Then position it on the preview.'
              : 'Upgrade to Venue to replace the watermark with your logo on player screens.'
          }
        >
          {entitlements.customRigLogo ? (
            <div className="flex flex-col items-end gap-2">
              <label
                className={cn(
                  'inline-flex h-8 cursor-pointer items-center justify-center gap-1 rounded-full border border-neon-violet/40',
                  'bg-transparent px-2.5 text-[10px] font-cyber uppercase tracking-widest text-neon-violet',
                  'transition-colors hover:border-neon-violet hover:bg-neon-violet/10',
                  uploadingLogo && 'pointer-events-none opacity-50'
                )}
              >
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                  className="sr-only"
                  disabled={uploadingLogo}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) onLogoUpload(file);
                    event.target.value = '';
                  }}
                />
                <Upload className="size-3" />
                {uploadingLogo ? 'Uploading…' : logoUrl ? 'Replace' : 'Upload'}
              </label>
              {logoUrl ? (
                <ToggleSwitch
                  checked={userLogo.visible}
                  onChange={(visible) => patchUserLogo({ visible })}
                  label="Show logo on player"
                />
              ) : null}
            </div>
          ) : (
            <PlanGateUpsell feature="customRigLogo" roomEntitlements={entitlements} />
          )}
        </LayerRow>

        {logoUrl && entitlements.customRigLogo ? (
          <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.02] px-2 py-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="" className="size-8 rounded object-contain bg-black/40" />
            <span className="text-[10px] text-zinc-500">Current logo · select on preview to resize</span>
          </div>
        ) : null}

        <LayerRow
          title="Emoji reactions"
          description={
            reactionsAvailable
              ? 'Floating toolbar at the bottom of the player screen.'
              : 'Requires a plan with audience reactions.'
          }
        >
          <ToggleSwitch
            checked={reactionsOn}
            disabled={!reactionsAvailable}
            onChange={(on) =>
              onPlayerChromeChange({
                ...playerChrome,
                showReactionsToolbar: on,
              })
            }
            label="Show emoji reactions toolbar"
          />
        </LayerRow>

        <LayerRow
          title="Flash button"
          description="Hold-to-flash control at the bottom-right of the player screen."
        >
          <ToggleSwitch
            checked={flashOn}
            onChange={(on) =>
              onPlayerChromeChange({
                ...playerChrome,
                showFlashButton: on,
              })
            }
            label="Show hold-to-flash button"
          />
        </LayerRow>
      </section>

      <section className="space-y-2">
        <button
          type="button"
          onClick={() => setHudOpen((value) => !value)}
          aria-expanded={hudOpen}
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-left transition-colors hover:border-white/20"
        >
          <span className="text-[10px] font-cyber uppercase tracking-widest text-zinc-200">
            Player menu (HUD)
          </span>
          <span className="flex items-center gap-1.5 text-[9px] font-cyber uppercase tracking-widest text-zinc-500">
            {hudVisibleCount}/{PLAYER_MENU_ITEMS.length} on
            {hudOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
          </span>
        </button>

        {hudOpen ? (
          <div className="space-y-2">
            {(['toolbar', 'sheet'] as const).map((group) => (
              <div key={group} className="space-y-2">
                <p className="text-[9px] font-cyber uppercase tracking-widest text-zinc-600">
                  {group === 'toolbar' ? 'Top-right toolbar' : 'More menu sheet'}
                </p>
                {PLAYER_MENU_ITEMS.filter((item) => item.group === group).map((item) => (
                  <LayerRow key={item.id} title={item.label} description={item.description}>
                    <ToggleSwitch
                      checked={isPlayerMenuItemVisible(playerChrome, item.id)}
                      onChange={(visible) => patchMenuItem(item.id, visible)}
                      label={`Show ${item.label}`}
                    />
                  </LayerRow>
                ))}
              </div>
            ))}
            <p className="text-[10px] leading-relaxed text-zinc-500">
              The “More” button shows automatically whenever the sheet has items, so Exit rave stays
              reachable.
            </p>
          </div>
        ) : null}
      </section>

      <section className="space-y-2">
        <p className="text-[9px] font-cyber uppercase tracking-widest text-zinc-500">Status</p>
        <LayerRow
          title="Sync delay"
          description='Status readout next to "Online", e.g. "(85ms)" — orchestrator latency.'
        >
          <ToggleSwitch
            checked={syncDelayOn}
            onChange={(on) =>
              onPlayerChromeChange({
                ...playerChrome,
                showSyncDelay: on,
              })
            }
            label="Show sync delay in status bar"
          />
        </LayerRow>
      </section>

      {!entitlements.customRigLogo ? (
        <p className="text-[10px] text-zinc-500">
          <Link href="/billing" className="text-neon-cyan underline underline-offset-2">
            Upgrade plan
          </Link>{' '}
          to use a custom logo on phones instead of the watermark.
        </p>
      ) : null}
    </div>
  );
}

export function PlayerChromeOperateHint({ onEditLayout }: { onEditLayout: () => void }) {
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
      <div className="flex items-start gap-2">
        <ImageIcon className="mt-0.5 size-3.5 shrink-0 text-neon-cyan" />
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-cyber uppercase tracking-wider text-zinc-300">
            Player screen
          </p>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
            Logo, HUD menu, flash, delay, and reactions are configured in Edit layout.
          </p>
          <button
            type="button"
            onClick={onEditLayout}
            className="mt-1.5 text-[10px] font-cyber uppercase tracking-widest text-neon-violet hover:text-neon-violet/80"
          >
            Edit layout →
          </button>
        </div>
        <Smile className="size-3.5 shrink-0 text-zinc-600" aria-hidden />
      </div>
    </div>
  );
}
