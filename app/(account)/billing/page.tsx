import { getAllPlans, getTeamForUser } from '@/lib/db/queries';
import { getTeamEntitlements } from '@/lib/entitlements';
import { checkoutAction, customerPortalAction } from '@/lib/payments/actions';
import { NeonButton, NeonCard, NeonTitle, PageTransitionWrapper, SectionGlow } from '@/components/ui/neon';
import Link from 'next/link';

export default async function BillingPage() {
  const team = await getTeamForUser();
  const plans = await getAllPlans();
  const entitlements = team ? await getTeamEntitlements(team.id) : null;

  return (
    <main className="relative mx-auto max-w-4xl px-6 py-12 min-h-screen overflow-hidden">
      <SectionGlow glowColor="mixed" position="top" />

      <PageTransitionWrapper>
        <div className="mb-10 flex items-center justify-between border-b border-border/40 pb-6">
          <div>
            <NeonTitle as="h1" color="cyan" className="text-3xl font-black tracking-widest">
              BILLING
            </NeonTitle>
            <p className="mt-1 text-xs font-cyber tracking-wider text-muted-foreground uppercase">
              Current plan: <span className="text-neon-cyan neon-text-cyan">{team?.plan?.name ?? 'Not signed in'}</span>
            </p>
          </div>
          <Link href="/">
            <NeonButton color="cyan" variant="outline" className="h-9 text-xs uppercase tracking-widest px-4">
              Home
            </NeonButton>
          </Link>
        </div>

        {team?.stripeCustomerId ? (
          <form action={customerPortalAction} className="mb-8">
            <NeonButton type="submit" color="cyan" variant="outline" className="h-9 text-xs uppercase tracking-widest px-4">
              Manage Subscription
            </NeonButton>
          </form>
        ) : null}

        {entitlements ? (
          <NeonCard glowColor="cyan" borderVariant="cyan" hoverEffect={false} className="mb-8 p-6">
            <div className="mb-4">
              <NeonTitle as="h3" color="cyan" className="text-base font-black tracking-wider uppercase">
                Current Grid Limits
              </NeonTitle>
            </div>
            <div className="grid grid-cols-3 gap-4 text-center font-cyber text-xs">
              <div className="rounded-lg bg-black/10 dark:bg-white/5 p-3 border border-white/5">
                <span className="block text-muted-foreground uppercase text-[10px] tracking-widest">MAX DEVICES</span>
                <span className="block text-xl font-bold text-foreground mt-1">{entitlements.maxDevices}</span>
              </div>
              <div className="rounded-lg bg-black/10 dark:bg-white/5 p-3 border border-white/5">
                <span className="block text-muted-foreground uppercase text-[10px] tracking-widest">MAX MATRIX</span>
                <span className="block text-xl font-bold text-foreground mt-1">{entitlements.maxGridRows}x{entitlements.maxGridCols}</span>
              </div>
              <div className="rounded-lg bg-black/10 dark:bg-white/5 p-3 border border-white/5">
                <span className="block text-muted-foreground uppercase text-[10px] tracking-widest">ADS</span>
                <span className="block text-xl font-bold text-foreground mt-1">{entitlements.adsEnabled ? 'ENABLED' : 'DISABLED'}</span>
              </div>
            </div>
          </NeonCard>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          {plans.map((plan) => {
            const isFree = plan.code === 'free' || !plan.stripePriceId;
            const isCurrentPlan = team?.planId === plan.id;
            const hasActivePaidSubscription =
              team &&
              (team.subscriptionStatus === 'active' ||
                team.subscriptionStatus === 'trialing');

            return (
              <NeonCard key={plan.id} glowColor={isFree ? 'none' : 'magenta'} borderVariant={isFree ? 'default' : 'magenta'} className="flex flex-col justify-between p-6 min-h-[250px]">
                <div>
                  <NeonTitle as="h3" color={isFree ? 'white' : 'magenta'} className="text-xl font-black tracking-widest mb-2">
                    {plan.name.toUpperCase()}
                  </NeonTitle>
                  <p className="text-xs text-muted-foreground leading-relaxed font-sans mb-4">
                    {plan.description}
                  </p>
                </div>
                
                <div className="space-y-4 mt-auto">
                  <p className="text-3xl font-black font-cyber tracking-tight text-foreground">
                    {plan.monthlyPriceCents === 0
                      ? 'FREE'
                      : `€${(plan.monthlyPriceCents / 100).toFixed(2)}`}
                    {plan.monthlyPriceCents > 0 && <span className="text-xs text-muted-foreground font-normal tracking-wide">/mo</span>}
                  </p>
                  
                  {isCurrentPlan ? (
                    <NeonButton disabled color="cyan" variant="outline" className="w-full text-xs uppercase tracking-widest h-10 opacity-60">
                      Current Plan
                    </NeonButton>
                  ) : isFree ? (
                    <NeonButton disabled color="cyan" variant="outline" className="w-full text-xs uppercase tracking-widest h-10 opacity-60">
                      {hasActivePaidSubscription ? 'Downgrade via Portal' : 'Free Plan'}
                    </NeonButton>
                  ) : hasActivePaidSubscription ? (
                    <form action={customerPortalAction} className="w-full">
                      <input type="hidden" name="planCode" value={plan.code} />
                      <NeonButton type="submit" color="cyan" variant="solid" className="w-full text-xs uppercase tracking-widest h-10">
                        Change Plan
                      </NeonButton>
                    </form>
                  ) : (
                    <form action={checkoutAction} className="w-full">
                      <input type="hidden" name="planCode" value={plan.code} />
                      <NeonButton type="submit" color="magenta" variant="solid" className="w-full text-xs uppercase tracking-widest h-10">
                        Upgrade Grid
                      </NeonButton>
                    </form>
                  )}
                </div>
              </NeonCard>
            );
          })}
        </div>
      </PageTransitionWrapper>
    </main>
  );
}
