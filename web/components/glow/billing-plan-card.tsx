import { NeonButton, NeonCard, NeonTitle } from '@/components/ui/neon';
import { checkoutAction, customerPortalAction } from '@/lib/payments/actions';
import type { BillingPlanPresentation } from '@/lib/plans/billing-cards';
import { cn } from '@/lib/utils';

type BillingPlanCardProps = {
  presentation: BillingPlanPresentation;
  isCurrentPlan: boolean;
  hasActivePaidSubscription: boolean;
  stripeEnabled: boolean;
};

export function BillingPlanCard({
  presentation,
  isCurrentPlan,
  hasActivePaidSubscription,
  stripeEnabled,
}: BillingPlanCardProps) {
  const isFree = presentation.planCode === 'free';
  const glow = presentation.recommended ? 'magenta' : isFree ? 'none' : 'cyan';
  const border = presentation.recommended ? 'magenta' : isFree ? 'default' : 'cyan';

  return (
    <NeonCard
      glowColor={glow}
      borderVariant={border}
      hoverEffect={!isCurrentPlan}
      className={cn(
        'relative flex flex-col p-6 min-h-[520px]',
        presentation.recommended && 'ring-1 ring-neon-magenta/30'
      )}
    >
      {presentation.recommended ? (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-neon-magenta px-3 py-1 text-[9px] font-cyber uppercase tracking-widest text-white shadow-[0_0_12px_rgba(255,0,200,0.4)]">
          Recommended
        </span>
      ) : null}

      <div className="mb-4">
        <NeonTitle
          as="h3"
          color={presentation.recommended ? 'magenta' : isFree ? 'white' : 'cyan'}
          className="text-xl font-black tracking-widest"
        >
          {presentation.marketingName.toUpperCase()}
        </NeonTitle>
        <p className="mt-1 text-xs font-cyber uppercase tracking-wider text-neon-cyan/80">
          {presentation.tagline}
        </p>
        <p className="mt-3 text-xs text-muted-foreground leading-relaxed">
          {presentation.brandingNote}
        </p>
      </div>

      <div className="flex-1 space-y-4">
        {presentation.sections.map((section) => (
          <div
            key={section.key}
            className="rounded-xl border border-white/5 bg-black/20 p-3"
          >
            <p className="text-[9px] font-cyber uppercase tracking-widest text-zinc-500 mb-2">
              {section.title}
            </p>
            <ul className="space-y-1.5">
              {section.items.map((item) => (
                <li
                  key={item}
                  className="text-[10px] font-cyber text-zinc-300 uppercase tracking-wide leading-snug"
                >
                  · {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

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
