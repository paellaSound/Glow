'use client';

import { useTransition } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { NeonButton, NeonTitle } from '@/components/ui/neon';
import { checkoutAction, customerPortalAction } from '@/lib/payments/actions';
import { formatPlanPrice, getPlanMeta, type PlanCode } from '@/lib/plans/plan-meta';

type UpgradeModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  body: string;
  requiredPlan: Exclude<PlanCode, 'free'>;
  returnUrl: string;
  hasActiveSubscription?: boolean;
  secondaryLabel?: string;
  onSecondary?: () => void;
};

export function UpgradeModal({
  open,
  onOpenChange,
  title,
  body,
  requiredPlan,
  returnUrl,
  hasActiveSubscription = false,
  secondaryLabel = 'Continue with limits',
  onSecondary,
}: UpgradeModalProps) {
  const [pending, startTransition] = useTransition();
  const planMeta = getPlanMeta(requiredPlan);
  const priceLabel = planMeta ? formatPlanPrice(planMeta.priceCents) : '';
  const ctaLabel = planMeta?.ctaLabel ?? 'Upgrade plan';

  function handleSecondary() {
    onSecondary?.();
    onOpenChange(false);
  }

  function submitCheckout() {
    startTransition(() => {
      const formData = new FormData();
      formData.set('planCode', requiredPlan);
      formData.set('returnUrl', returnUrl);
      if (hasActiveSubscription) {
        void customerPortalAction(formData);
      } else {
        void checkoutAction(formData);
      }
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-neon-magenta/20 sm:max-w-md">
        <AlertDialogHeader>
          <span className="text-2xl text-center" aria-hidden>
            ✨
          </span>
          <AlertDialogTitle className="text-center">
            <NeonTitle as="h3" color="magenta" className="text-base font-black tracking-widest">
              {title}
            </NeonTitle>
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center text-sm text-zinc-300">
            {body}
            {priceLabel ? (
              <span className="mt-2 block text-xs font-cyber uppercase tracking-wider text-zinc-500">
                {hasActiveSubscription ? 'Manage your subscription to switch plans' : priceLabel}
              </span>
            ) : null}
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
          <NeonButton
            type="button"
            color="magenta"
            variant="solid"
            className="w-full text-xs uppercase tracking-widest h-10"
            disabled={pending}
            onClick={submitCheckout}
          >
            {pending
              ? 'Redirecting…'
              : hasActiveSubscription
                ? `Switch to ${planMeta?.marketingName ?? 'plan'}`
                : `${ctaLabel} — ${priceLabel}`}
          </NeonButton>
          <button
            type="button"
            onClick={handleSecondary}
            className="w-full text-center text-xs font-cyber uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors py-2"
          >
            {secondaryLabel}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
