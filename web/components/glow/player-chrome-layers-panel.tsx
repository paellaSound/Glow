'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp, ImageIcon, Lock, Smile } from 'lucide-react';
import {
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
    <div className="flex items-start justify-between gap-3 rounded-xl border border-white/10 bg-muted/50 px-3 py-2.5">
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
  logoUrl: _logoUrl,
  uploadingLogo: _uploadingLogo,
  onLogoUpload: _onLogoUpload,
  className,
}: PlayerChromeLayersPanelProps) {
  const [hudOpen, setHudOpen] = useState(false);
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

  return (
    <div className={cn('mt-4 space-y-4 border-t border-white/10 pt-4', className)}>
      <div>
        <h3 className="text-xs font-cyber font-bold uppercase tracking-widest text-neon-violet">
          Player screen
        </h3>
        <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
          Layout guide for connected phones. Toggle HUD, flash, delay, and reactions on or off.
        </p>
      </div>

      <section className="space-y-2">
        <p className="text-[9px] font-cyber uppercase tracking-widest text-zinc-500">On screen</p>

        {/* TODO: implement logo support in the future — disabled for now because it doesn't work yet */}
        <LayerRow
          title="Your logo"
          description="Custom logo upload and placement on player screens. Coming soon."
          locked
        >
          <span className="text-[10px] font-cyber uppercase tracking-widest text-zinc-600">
            Soon
          </span>
        </LayerRow>

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
          className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-muted/50 px-3 py-2.5 text-left transition-colors hover:border-white/20"
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

    </div>
  );
}

export function PlayerChromeOperateHint({ onEditLayout }: { onEditLayout: () => void }) {
  return (
    <div className="mt-3 rounded-xl border border-white/10 bg-muted/40 px-3 py-2.5">
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
