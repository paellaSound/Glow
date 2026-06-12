'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import posthog from 'posthog-js';
import { RefreshCw, X } from 'lucide-react';
import {
  getOnboardingDebugSnapshot,
  waitForPostHogPersonReady,
} from '@/lib/onboarding/person-properties';
import {
  ONBOARDING_STORAGE_KEY,
  PH_FIRST_DEVICE_KEY,
  PH_FIRST_PRESET_KEY,
} from '@/lib/onboarding/constants';
import { parseOnboardingUrl, shouldShowOnboardingInspectHud } from '@/lib/onboarding/url';
import { getOnboardingStatus } from '@/lib/onboarding/storage';
import { isPostHogEnabled } from '@/lib/posthog-config';

function formatPropValue(value: boolean | null | string | undefined): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'string') return value;
  return value ? 'true' : 'false';
}

function valueClassName(value: boolean | null | string | undefined): string {
  if (value === null || value === undefined) return 'text-zinc-400';
  if (typeof value === 'string') return 'text-neon-cyan';
  return value ? 'text-green-400' : 'text-amber-400';
}

export function OnboardingDebugPanel() {
  const searchParams = useSearchParams();
  const urlIntent = useMemo(() => parseOnboardingUrl(searchParams), [searchParams]);
  const showHud = useMemo(() => shouldShowOnboardingInspectHud(searchParams), [searchParams]);

  const [open, setOpen] = useState(true);
  const [snapshot, setSnapshot] = useState(() => getOnboardingDebugSnapshot());
  const [lastRefresh, setLastRefresh] = useState<string>('—');
  const [ready, setReady] = useState(false);

  const refresh = useCallback(async () => {
    if (isPostHogEnabled()) {
      await waitForPostHogPersonReady();
    }
    setSnapshot(getOnboardingDebugSnapshot());
    setLastRefresh(new Date().toLocaleTimeString());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!showHud) return;
    void refresh();
  }, [showHud, refresh]);

  if (!showHud || !open) return null;

  const forceShow = urlIntent.type === 'show';
  const localOnboarding = typeof window !== 'undefined' ? getOnboardingStatus() : null;
  const checklistVisible = forceShow || snapshot.shouldShowChecklist === true;

  return (
    <div
      className="fixed left-3 top-3 z-[60] max-h-[min(70vh,32rem)] w-[min(22rem,calc(100vw-1.5rem))] overflow-auto rounded-xl border border-amber-500/40 bg-zinc-950/95 p-3 font-mono text-[10px] leading-relaxed text-zinc-300 shadow-2xl backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-label="Onboarding PostHog debug"
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div>
          <p className="font-cyber text-[10px] font-bold uppercase tracking-widest text-amber-400">
            Onboarding inspect
          </p>
          <p className="text-[9px] text-zinc-500">
            ?onboarding=inspect · refreshed {lastRefresh}
          </p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Refresh PostHog snapshot"
            className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
            onClick={() => void refresh()}
          >
            <RefreshCw className="size-3.5" />
          </button>
          <button
            type="button"
            aria-label="Close debug panel"
            className="rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
            onClick={() => setOpen(false)}
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      <div className="space-y-2 border-t border-white/10 pt-2">
        <Row label="ready" value={ready ? 'true' : 'false'} raw={ready} />
        <Row label="posthog_enabled" value={formatPropValue(snapshot.posthogEnabled)} raw={snapshot.posthogEnabled} />
        <Row label="url_intent" value={urlIntent.type} raw={urlIntent.type} />
        <Row label="force_show (URL)" value={formatPropValue(forceShow)} raw={forceShow} />
        <Row
          label="→ checklist_visible"
          value={formatPropValue(checklistVisible)}
          raw={checklistVisible}
          highlight
        />
      </div>

      <p className="mt-3 mb-1 font-cyber text-[9px] uppercase tracking-widest text-zinc-500">
        PostHog person properties
      </p>
      <div className="space-y-1 rounded-lg border border-white/5 bg-black/40 p-2">
        {Object.entries(snapshot.personProps).map(([key, value]) => (
          <Row key={key} label={key} value={formatPropValue(value)} raw={value} />
        ))}
      </div>

      <p className="mt-3 mb-1 font-cyber text-[9px] uppercase tracking-widest text-zinc-500">
        Derived
      </p>
      <div className="space-y-1 rounded-lg border border-white/5 bg-black/40 p-2">
        <Row
          label="shouldShowChecklist"
          value={formatPropValue(snapshot.shouldShowChecklist ?? null)}
          raw={snapshot.shouldShowChecklist}
          highlight
        />
        <Row
          label="completed_steps"
          value={snapshot.completedSteps.length ? snapshot.completedSteps.join(', ') : 'none'}
          raw={snapshot.completedSteps.join(',')}
        />
        <Row label="checklist_complete" value={formatPropValue(snapshot.state?.checklistComplete ?? null)} raw={snapshot.state?.checklistComplete} />
        <Row label="checklist_dismissed" value={formatPropValue(snapshot.state?.checklistDismissed ?? null)} raw={snapshot.state?.checklistDismissed} />
      </div>

      <p className="mt-3 mb-1 font-cyber text-[9px] uppercase tracking-widest text-zinc-500">
        localStorage fallback
      </p>
      <div className="space-y-1 rounded-lg border border-white/5 bg-black/40 p-2">
        <Row label={ONBOARDING_STORAGE_KEY} value={localOnboarding ?? 'null'} raw={localOnboarding} />
        <Row
          label={PH_FIRST_DEVICE_KEY}
          value={typeof window !== 'undefined' && localStorage.getItem(PH_FIRST_DEVICE_KEY) ? '1' : 'null'}
          raw={null}
        />
        <Row
          label={PH_FIRST_PRESET_KEY}
          value={typeof window !== 'undefined' && localStorage.getItem(PH_FIRST_PRESET_KEY) ? '1' : 'null'}
          raw={null}
        />
      </div>

      {!snapshot.posthogEnabled ? (
        <p className="mt-2 text-amber-400/90">
          PostHog off — using localStorage only. Enable NEXT_PUBLIC_POSTHOG_ENABLED=true in prod.
        </p>
      ) : null}

      {snapshot.posthogEnabled && typeof posthog.get_property === 'function' ? (
        <p className="mt-2 text-zinc-500">
          Compare with PostHog → Persons → {String(snapshot.personProps['$distinct_id'] ?? '…')}
        </p>
      ) : null}
    </div>
  );
}

function Row({
  label,
  value,
  raw,
  highlight = false,
}: {
  label: string;
  value: string;
  raw: boolean | null | string | undefined;
  highlight?: boolean;
}) {
  return (
    <div className={highlight ? 'rounded bg-amber-500/10 px-1 py-0.5' : ''}>
      <span className="text-zinc-500">{label}</span>
      <span className="text-zinc-600"> = </span>
      <span className={valueClassName(raw)}>{value}</span>
    </div>
  );
}
