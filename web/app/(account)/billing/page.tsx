import { getAllPlans, getTeamForUser } from '@/lib/db/queries';
import { getTeamEntitlements, buildEntitlementsFromRows } from '@/lib/entitlements';
import { customerPortalAction } from '@/lib/payments/actions';
import { BillingPlanCard } from '@/components/glow/billing-plan-card';
import { BillingPageTracker } from '@/components/glow/billing-page-tracker';
import { NeonButton, NeonCard, NeonTitle, PageTransitionWrapper, SectionGlow } from '@/components/ui/neon';
import { GLOW_BRAND_NAME } from '@/lib/glow/branding';
import { buildBillingPresentation } from '@/lib/plans/billing-cards';
import { getPlanMeta, type PlanCode } from '@/lib/plans/plan-meta';
import Link from 'next/link';

const PLAN_ORDER: PlanCode[] = ['free', 'plus_25', 'plus_50', 'pro'];

function marketingPlanName(code: string, fallback: string): string {
  if (code === 'free') return 'Free';
  return getPlanMeta(code as PlanCode)?.marketingName ?? fallback;
}

export default async function BillingPage() {
  const team = await getTeamForUser();
  const plans = await getAllPlans();
  const entitlements = team ? await getTeamEntitlements(team.id) : null;
  const currentPlanCode = team?.plan?.code ?? 'free';
  const currentMarketingName = marketingPlanName(
    currentPlanCode,
    team?.plan?.name ?? 'Free'
  );

  const hasActivePaidSubscription =
    Boolean(team) &&
    (team!.subscriptionStatus === 'active' || team!.subscriptionStatus === 'trialing');

  const orderedPlans = [...plans].sort(
    (a, b) => PLAN_ORDER.indexOf(a.code as PlanCode) - PLAN_ORDER.indexOf(b.code as PlanCode)
  );

  return (
    <main className="relative mx-auto max-w-6xl px-6 py-12 min-h-screen overflow-hidden">
      <BillingPageTracker currentPlanCode={currentPlanCode} />
      <SectionGlow glowColor="mixed" position="top" />

      <PageTransitionWrapper>
        <div className="mb-10 flex flex-wrap items-center justify-between gap-4 border-b border-border/40 pb-6">
          <div>
            <NeonTitle as="h1" color="cyan" className="text-3xl font-black tracking-widest">
              PLANS & BILLING
            </NeonTitle>
            <p className="mt-2 text-xs font-cyber tracking-wider text-muted-foreground uppercase max-w-xl">
              Control the floor and the stage — scale as much as you need.
            </p>
            <p className="mt-1 text-xs font-cyber tracking-wider text-muted-foreground uppercase">
              Current plan:{' '}
              <span className="text-neon-cyan neon-text-cyan">
                {team ? currentMarketingName : 'Not signed in'}
              </span>
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
            <input type="hidden" name="returnUrl" value="/billing" />
            <NeonButton type="submit" color="cyan" variant="outline" className="h-9 text-xs uppercase tracking-widest px-4">
              Manage subscription
            </NeonButton>
          </form>
        ) : null}

        {entitlements ? (
          <NeonCard glowColor="cyan" borderVariant="cyan" hoverEffect={false} className="mb-8 p-6">
            <NeonTitle as="h3" color="cyan" className="text-base font-black tracking-wider uppercase mb-4">
              Your live limits
            </NeonTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center font-cyber text-xs">
              <div className="rounded-lg bg-black/10 dark:bg-white/5 p-3 border border-white/5">
                <span className="block text-muted-foreground uppercase text-[10px] tracking-widest">Devices</span>
                <span className="block text-xl font-bold text-foreground mt-1">{entitlements.maxDevices}</span>
              </div>
              <div className="rounded-lg bg-black/10 dark:bg-white/5 p-3 border border-white/5">
                <span className="block text-muted-foreground uppercase text-[10px] tracking-widest">Matrix cells</span>
                <span className="block text-xl font-bold text-foreground mt-1">{entitlements.maxMatrixCells}</span>
              </div>
              <div className="rounded-lg bg-black/10 dark:bg-white/5 p-3 border border-white/5">
                <span className="block text-muted-foreground uppercase text-[10px] tracking-widest">Grid cap</span>
                <span className="block text-xl font-bold text-foreground mt-1">
                  {entitlements.maxGridRows}×{entitlements.maxGridCols}
                </span>
              </div>
              <div className="rounded-lg bg-black/10 dark:bg-white/5 p-3 border border-white/5">
                <span className="block text-muted-foreground uppercase text-[10px] tracking-widest">Branding</span>
                <span className="block text-sm font-bold text-foreground mt-1 leading-tight">
                  {entitlements.customRigLogo ? 'Your logo & QR' : GLOW_BRAND_NAME}
                </span>
              </div>
            </div>
          </NeonCard>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          {orderedPlans.map((plan) => {
            const planEnts = buildEntitlementsFromRows(plan.entitlements);
            const presentation = buildBillingPresentation(plan.code as PlanCode, planEnts);

            return (
              <BillingPlanCard
                key={plan.id}
                presentation={presentation}
                isCurrentPlan={team?.planId === plan.id}
                hasActivePaidSubscription={hasActivePaidSubscription}
                stripeEnabled={Boolean(plan.stripePriceId) || plan.code === 'free'}
              />
            );
          })}
        </div>
      </PageTransitionWrapper>
    </main>
  );
}
