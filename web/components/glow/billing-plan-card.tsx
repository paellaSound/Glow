import { Check } from 'lucide-react';
import { NeonButton, NeonCard, NeonTitle } from '@/components/ui/neon';
import { PlanDetailsPopover } from '@/components/glow/plan-details-popover';
import { checkoutAction, customerPortalAction } from '@/lib/payments/actions';
import type { BillingPlanPresentation } from '@/lib/plans/billing-cards';
import { cn } from '@/lib/utils';

type BillingPlanCardProps = {
  presentation: BillingPlanPresentation;
  isCurrentPlan: boolean;
  recommended: boolean;
  hasActivePaidSubscription: boolean;
  stripeEnabled: boolean;
};

export function BillingPlanCard({
  presentation,
  isCurrentPlan,
  recommended,
  hasActivePaidSubscription,
  stripeEnabled,
}: BillingPlanCardProps) {
  const isFree = presentation.planCode === 'free';
  const glow = recommended ? 'magenta' : isCurrentPlan ? 'cyan' : isFree ? 'none' : 'cyan';
  const border = recommended ? 'magenta' : isCurrentPlan ? 'cyan' : isFree ? 'default' : 'cyan';

  return (
    <NeonCard
      glowColor={glow}
      borderVariant={border}
      hoverEffect={!isCurrentPlan}
      className={cn(
        'relative flex flex-col p-6',
        recommended && 'ring-1 ring-neon-magenta/30',
        isCurrentPlan && 'ring-1 ring-neon-cyan/30'
      )}
    >
      {isCurrentPlan ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full border border-neon-cyan/50 bg-zinc-950 px-3 py-1 text-[9px] font-cyber uppercase tracking-widest text-neon-cyan shadow-[0_0_12px_rgba(0,229,255,0.35)]">
          Current plan
        </span>
      ) : recommended ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-neon-magenta px-3 py-1 text-[9px] font-cyber uppercase tracking-widest text-white shadow-[0_0_12px_rgba(255,0,200,0.4)]">
          Recommended
        </span>
      ) : null}

      {/* Header: name + "i" detail popover */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <div>
          <NeonTitle
            as="h3"
            color={recommended ? 'magenta' : isFree ? 'white' : 'cyan'}
            className="text-xl font-black tracking-widest"
          >
            {presentation.marketingName.toUpperCase()}
          </NeonTitle>
          <p className="mt-1 text-xs font-cyber uppercase tracking-wider text-neon-cyan/80">
            {presentation.tagline}
          </p>
        </div>
        <PlanDetailsPopover
          planName={presentation.marketingName}
          sections={presentation.detailSections}
        />
      </div>

      {/* Headline: crowd size */}
      <p className="text-lg font-black font-cyber tracking-tight text-foreground">
        {presentation.headline}
      </p>

      {/* Delta: what this plan adds over the previous one */}
      <div className="mt-4 flex-1">
        {presentation.deltaIntro ? (
          <p className="mb-2 text-[10px] font-cyber uppercase tracking-widest text-zinc-500">
            {presentation.deltaIntro}
          </p>
        ) : null}
        <ul className="space-y-2">
          {presentation.deltaItems.map((item) => (
            <li key={item} className="flex items-start gap-2 text-xs text-zinc-200 leading-snug">
              <Check
                className={cn(
                  'mt-0.5 size-3.5 shrink-0',
                  recommended ? 'text-neon-magenta' : 'text-neon-cyan'
                )}
              />
              {item}
            </li>
          ))}
        </ul>
      </div>

      {/* Price + CTA */}
      <div className="mt-6 space-y-3">
        <p className="text-3xl font-black font-cyber tracking-tight text-foreground">
          {presentation.priceLabel}
          {!isFree && presentation.priceLabel !== 'Free' ? (
            <span className="text-xs text-muted-foreground font-normal tracking-wide">/mo</span>
          ) : null}
        </p>

        {isCurrentPlan ? (
          <NeonButton disabled color="cyan" variant="outline" className="w-full text-xs uppercase tracking-widest h-10 opacity-60">
            Current plan
          </NeonButton>
        ) : isFree ? (
          <NeonButton disabled color="cyan" variant="outline" className="w-full text-xs uppercase tracking-widest h-10 opacity-60">
            {hasActivePaidSubscription ? 'Downgrade via portal' : 'Free plan'}
          </NeonButton>
        ) : !stripeEnabled ? (
          <NeonButton disabled color="magenta" variant="outline" className="w-full text-xs uppercase tracking-widest h-10 opacity-60">
            Coming soon
          </NeonButton>
        ) : hasActivePaidSubscription ? (
          <form action={customerPortalAction} className="w-full">
            <input type="hidden" name="planCode" value={presentation.planCode} />
            <input type="hidden" name="returnUrl" value="/billing" />
            <NeonButton type="submit" color="cyan" variant="solid" className="w-full text-xs uppercase tracking-widest h-10">
              {presentation.ctaLabel}
            </NeonButton>
          </form>
        ) : (
          <form action={checkoutAction} className="w-full">
            <input type="hidden" name="planCode" value={presentation.planCode} />
            <input type="hidden" name="returnUrl" value="/billing" />
            <NeonButton type="submit" color="magenta" variant="solid" className="w-full text-xs uppercase tracking-widest h-10">
              {presentation.ctaLabel}
            </NeonButton>
          </form>
        )}
      </div>
    </NeonCard>
  );
}
