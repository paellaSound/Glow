'use client';

import { useEffect, useState } from 'react';
import { NeonButton, NeonCard, NeonTitle } from '@/components/ui/neon';
import { UpgradeModal } from '@/components/glow/upgrade-modal';
import { usePlanGate } from '@/lib/plans/use-plan-gate';
import { getRequiredPlanForFeature } from '@/lib/plans/plan-meta';

type DeviceCapBannerProps = {
  deviceCount: number;
  maxDevices: number;
  returnUrl: string;
};

export function DeviceCapBanner({ deviceCount, maxDevices, returnUrl }: DeviceCapBannerProps) {
  const atCap = deviceCount >= maxDevices;
  const gate = usePlanGate('max_devices', {
    state: atCap ? 'blocked' : 'allowed',
    deviceCount,
    limitReason: `You've reached ${maxDevices} connected devices`,
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (atCap) {
      setDismissed(false);
    }
  }, [atCap, deviceCount]);

  if (!atCap || dismissed) return null;

  const requiredPlan = getRequiredPlanForFeature('max_devices');

  return (
    <>
      <NeonCard
        glowColor="magenta"
        borderVariant="magenta"
        hoverEffect={false}
        className="mb-4 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div>
          <NeonTitle as="h4" color="magenta" className="text-xs font-black tracking-widest">
            DEVICE LIMIT REACHED
          </NeonTitle>
          <p className="mt-1 text-xs text-muted-foreground">{gate.limitBody}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <NeonButton
            type="button"
            color="magenta"
            variant="solid"
            className="text-[10px] uppercase tracking-widest h-8 px-4"
            onClick={() => setModalOpen(true)}
          >
            Upgrade
          </NeonButton>
          <NeonButton
            type="button"
            color="magenta"
            variant="outline"
            className="text-[10px] uppercase tracking-widest h-8 px-4"
            onClick={() => setDismissed(true)}
          >
            Dismiss
          </NeonButton>
        </div>
      </NeonCard>

      <UpgradeModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        title={gate.limitReason}
        body={gate.limitBody}
        requiredPlan={requiredPlan}
        returnUrl={returnUrl}
        hasActiveSubscription={gate.hasActiveSubscription}
        secondaryLabel="Continue with limits"
        onSecondary={() => setDismissed(true)}
      />
    </>
  );
}
