'use client';

import { Pencil, Smartphone, Sparkles, Vibrate } from 'lucide-react';
import { NeonButton, NeonTitle } from '@/components/ui/neon';
import type { ConsoleMode } from '@/lib/glow/console-mode';
import { cn } from '@/lib/utils';
import { UserAccountMenu } from '@/components/glow/user-account-menu';

export type ActiveTab = 'patterns' | 'visuals';

export type ControlHeaderProps = {
  roomCode: string;
  connected: boolean;
  deviceCount: number;
  mode: ConsoleMode;
  onEnterEdit: () => void;
  onDoneEdit: () => void;
  onDiscardEdit: () => void;
  configDirty: boolean;
  savingConfig: boolean;
  visibleTabs: ActiveTab[];
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
  onOpenPhoneMode: () => void;
  onEndSession: () => void;
  endingSession: boolean;
  showEndButton: boolean;
  patternsShareControls?: (segmentActive: boolean) => React.ReactNode;
  visualsShareControls?: (segmentActive: boolean) => React.ReactNode;
  sequenceSelector?: React.ReactNode;
};

const TABS: { id: ActiveTab; label: string; Icon: typeof Vibrate }[] = [
  { id: 'patterns', label: 'Play Devices', Icon: Vibrate },
  { id: 'visuals', label: 'Visuals', Icon: Sparkles },
];

export function ControlHeader({
  roomCode,
  connected,
  deviceCount,
  mode,
  onEnterEdit,
  onDoneEdit,
  onDiscardEdit,
  configDirty,
  savingConfig,
  visibleTabs,
  activeTab,
  onTabChange,
  onOpenPhoneMode,
  onEndSession,
  endingSession,
  showEndButton,
  patternsShareControls,
  visualsShareControls,
  sequenceSelector,
}: ControlHeaderProps) {
  const editing = mode === 'edit';
  const visibleTabDefs = TABS.filter((tab) => visibleTabs.includes(tab.id));

  return (
    <div
      className={cn(
        'mb-5 flex flex-col gap-3 rounded-2xl border bg-muted/40 p-4 transition-colors sm:gap-4 sm:p-5',
        editing ? 'border-neon-violet/40 bg-neon-violet/[0.04]' : 'border-white/10'
      )}
    >
      {editing ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-neon-violet/40 bg-neon-violet/10 px-3 py-2">
          <span className="flex items-center gap-2 text-[10px] font-cyber uppercase tracking-widest text-neon-violet sm:text-xs">
            <Pencil className="size-3.5" />
            Editing layout — show, hide & arrange sections
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onDiscardEdit}
              disabled={savingConfig}
              className="rounded-full border border-white/15 px-3 py-1.5 text-[10px] font-cyber uppercase tracking-widest text-zinc-400 transition-colors hover:text-zinc-200 disabled:opacity-50"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={onDoneEdit}
              disabled={savingConfig}
              className="rounded-full border border-neon-violet/50 bg-neon-violet/20 px-4 py-1.5 text-[10px] font-cyber uppercase tracking-widest text-neon-violet transition-colors hover:bg-neon-violet/30 disabled:opacity-50"
            >
              {savingConfig ? 'Saving...' : configDirty ? 'Save & done' : 'Done'}
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <NeonTitle
            as="h1"
            color="cyan"
            className="shrink-0 whitespace-nowrap text-xl font-black tracking-widest sm:text-2xl"
          >
            {roomCode.toUpperCase()}
          </NeonTitle>
          <span
            className={cn(
              'size-2 shrink-0 rounded-full',
              connected ? 'bg-neon-cyan shadow-[0_0_8px_rgba(0,255,204,0.6)]' : 'bg-zinc-600'
            )}
            aria-hidden
          />
          <span className="shrink-0 text-[10px] font-cyber uppercase tracking-wider text-muted-foreground sm:text-xs">
            {connected ? 'live' : 'connecting'} · {deviceCount} screen{deviceCount === 1 ? '' : 's'}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          <NeonButton
            color="cyan"
            variant="outline"
            className="h-9 px-3 text-xs uppercase tracking-widest gap-1.5"
            onClick={onOpenPhoneMode}
          >
            <Smartphone className="size-3.5" />
            Device Mode
          </NeonButton>
          {!editing ? (
            <NeonButton
              color="violet"
              variant="outline"
              className="h-9 px-3 text-xs uppercase tracking-widest gap-1.5"
              onClick={onEnterEdit}
            >
              <Pencil className="size-3.5" />
              Edit layout
            </NeonButton>
          ) : null}
          {showEndButton ? (
            <NeonButton
              color="magenta"
              variant="outline"
              className="h-9 px-4 text-xs uppercase tracking-widest border-red-500/20 text-red-400"
              disabled={endingSession}
              onClick={onEndSession}
            >
              {endingSession ? 'Closing...' : 'End session'}
            </NeonButton>
          ) : null}
          <UserAccountMenu variant="inline" hideSessionInfo />
        </div>
      </div>

      {visibleTabDefs.length > 0 || sequenceSelector ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-2">
          {visibleTabDefs.length > 0 ? (
            <div
              role="tablist"
              aria-label="Control desk sections"
              className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1"
            >
              {visibleTabDefs.map(({ id, label, Icon }) => {
                const active = activeTab === id;
                const renderShare =
                  id === 'patterns'
                    ? patternsShareControls
                    : id === 'visuals'
                      ? visualsShareControls
                      : undefined;

                return (
                  <div
                    key={id}
                    className={cn(
                      'inline-flex items-center gap-0.5 rounded-lg transition-all duration-200',
                      active
                        ? 'bg-neon-cyan/15 text-neon-cyan shadow-[inset_0_0_0_1px_rgba(0,255,204,0.28)]'
                        : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'
                    )}
                  >
                    <button
                      type="button"
                      role="tab"
                      aria-selected={active}
                      id={`tab-${id}`}
                      data-onboarding={id === 'visuals' ? 'visuals' : id === 'patterns' ? 'share' : undefined}
                      onClick={() => onTabChange(id)}
                      className={cn(
                        'flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-cyber uppercase tracking-widest transition-colors',
                        active && '[text-shadow:0_0_8px_rgba(0,255,204,0.35)]'
                      )}
                    >
                      <Icon className="size-3.5 shrink-0" />
                      {label}
                    </button>
                    {renderShare ? (
                      <div
                        className="flex items-center pr-1"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      >
                        {renderShare(active)}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
          {sequenceSelector ? <div className="shrink-0">{sequenceSelector}</div> : null}
        </div>
      ) : null}
    </div>
  );
}
