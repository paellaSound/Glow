'use client';

import { useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { cn } from '@/lib/utils';
import { NeonButton } from '@/components/ui/neon';
import { usePlanGate, type UsePlanGateOptions } from '@/lib/plans/use-plan-gate';
import type { GateFeature, PlanGateState } from '@/lib/plans/plan-meta';
import { UpgradeModal } from './upgrade-modal';

type PlanGateProps = UsePlanGateOptions & {
  feature: GateFeature;
  children: ReactNode;
  className?: string;
  returnUrl?: string;
  overlay?: boolean;
  onUpgradeClick?: () => void;
};

function buildReturnUrl(pathname: string, search: string): string {
  return search ? `${pathname}?${search}` : pathname;
}

export function PlanGate({
  feature,
  children,
  className,
  returnUrl,
  overlay = true,
  onUpgradeClick,
  ...gateOptions
}: PlanGateProps) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gate = usePlanGate(feature, gateOptions);
  const [modalOpen, setModalOpen] = useState(false);

  const resolvedReturnUrl =
    returnUrl ?? buildReturnUrl(pathname, searchParams.toString());

  if (gate.state === 'allowed') {
    return <>{children}</>;
  }

  function openModal() {
    onUpgradeClick?.();
    // PostHog stub — wire billing_upgrade_modal_shown in Part 05
    setModalOpen(true);
  }

  if (gate.state === 'limited' || gate.state === 'preview') {
    return (
      <div className={cn('relative', className)}>
        {children}
        <div className="mt-2 rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs text-violet-200 flex items-center justify-between gap-3">
          <span>{gate.limitReason}</span>
          <NeonButton
            type="button"
            color="violet"
            variant="outline"
            className="h-7 text-[9px] uppercase tracking-widest px-3 shrink-0"
            onClick={openModal}
          >
            Upgrade
          </NeonButton>
        </div>
        <UpgradeModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          title={gate.limitReason}
          body={gate.limitBody}
          requiredPlan={gate.requiredPlan}
          returnUrl={resolvedReturnUrl}
          hasActiveSubscription={gate.hasActiveSubscription}
        />
      </div>
    );
  }

  // blocked
  return (
    <div className={cn('relative', className)}>
      <div
        className={cn(
          overlay && 'pointer-events-none opacity-50',
          !overlay && 'pointer-events-none'
        )}
      >
        {children}
      </div>

      {overlay ? (
        <button
          type="button"
          onClick={openModal}
          className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl bg-black/85 p-6 text-center backdrop-blur-xs cursor-pointer border-0"
        >
          <span className="text-2xl" aria-hidden>
            🔒
          </span>
          <h4 className="mt-2 font-display font-black text-sm text-white uppercase tracking-widest">
            {gate.limitReason}
          </h4>
          <p className="mt-1 text-xs text-zinc-400 max-w-[260px]">{gate.limitBody}</p>
          <NeonButton
            type="button"
            color="magenta"
            variant="solid"
            className="mt-4 text-[10px] uppercase tracking-widest h-8 px-4 pointer-events-auto"
            onClick={(event) => {
              event.stopPropagation();
              openModal();
            }}
          >
            View plans
          </NeonButton>
        </button>
      ) : null}

      <UpgradeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={gate.limitReason}
        body={gate.limitBody}
        requiredPlan={gate.requiredPlan}
        returnUrl={resolvedReturnUrl}
        hasActiveSubscription={gate.hasActiveSubscription}
      />
    </div>
  );
}

/** Inline upsell card — no child content, opens upgrade modal on CTA. */
export function PlanGateUpsell({
  feature,
  className,
  returnUrl,
  ...gateOptions
}: Omit<PlanGateProps, 'children' | 'overlay'> & { description?: string }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gate = usePlanGate(feature, gateOptions);
  const [modalOpen, setModalOpen] = useState(false);

  const resolvedReturnUrl =
    returnUrl ?? buildReturnUrl(pathname, searchParams.toString());

  if (gate.state === 'allowed') return null;

  return (
    <>
      <div className={cn('text-center', className)}>
        <p className="text-sm text-muted-foreground leading-relaxed mb-4">{gate.limitBody}</p>
        <NeonButton
          type="button"
          color="magenta"
          variant="solid"
          className="text-xs uppercase tracking-widest"
          onClick={() => setModalOpen(true)}
        >
          {gate.hasActiveSubscription ? 'Manage plan' : `Upgrade to ${getPlanMetaLabel(gate.requiredPlan)}`}
        </NeonButton>
      </div>
      <UpgradeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={gate.limitReason}
        body={gate.limitBody}
        requiredPlan={gate.requiredPlan}
        returnUrl={resolvedReturnUrl}
        hasActiveSubscription={gate.hasActiveSubscription}
      />
    </>
  );
}

function getPlanMetaLabel(planCode: string): string {
  const labels: Record<string, string> = {
    plus_25: 'Party',
    plus_50: 'Venue',
    pro: 'Pro',
  };
  return labels[planCode] ?? 'paid plan';
}

/** Compact inline banner with upgrade CTA — for non-overlay limits (e.g. effect layering). */
export function PlanGateBanner({
  feature,
  className,
  returnUrl,
  ...gateOptions
}: Omit<PlanGateProps, 'children' | 'overlay'>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const gate = usePlanGate(feature, gateOptions);
  const [modalOpen, setModalOpen] = useState(false);

  const resolvedReturnUrl =
    returnUrl ?? buildReturnUrl(pathname, searchParams.toString());

  if (gate.state === 'allowed') return null;

  return (
    <>
      <div
        className={cn(
          'rounded-lg border border-violet-500/20 bg-violet-500/10 px-3 py-2 text-xs text-violet-200 flex items-center justify-between gap-3',
          className
        )}
      >
        <span>{gate.limitBody}</span>
        <NeonButton
          type="button"
          color="violet"
          variant="outline"
          className="h-7 text-[9px] uppercase tracking-widest px-3 shrink-0"
          onClick={() => setModalOpen(true)}
        >
          Upgrade
        </NeonButton>
      </div>
      <UpgradeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={gate.limitReason}
        body={gate.limitBody}
        requiredPlan={gate.requiredPlan}
        returnUrl={resolvedReturnUrl}
        hasActiveSubscription={gate.hasActiveSubscription}
      />
    </>
  );
}

export type { GateFeature, PlanGateState };
