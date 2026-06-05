import { getAllPlans, getTeamForUser } from '@/lib/db/queries';
import { getTeamEntitlements } from '@/lib/entitlements';
import { checkoutAction, customerPortalAction } from '@/lib/payments/actions';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Link from 'next/link';

export default async function BillingPage() {
  const team = await getTeamForUser();
  const plans = await getAllPlans();
  const entitlements = team ? await getTeamEntitlements(team.id) : null;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Billing</h1>
          <p className="mt-2 text-zinc-400">
            Current plan: {team?.plan?.name ?? 'Not signed in'}
          </p>
        </div>
        <Link href="/">
          <Button variant="outline">Home</Button>
        </Link>
      </div>

      {team?.stripeCustomerId ? (
        <form action={customerPortalAction} className="mb-8">
          <Button type="submit" variant="outline">
            Manage Subscription
          </Button>
        </form>
      ) : null}

      {entitlements ? (
        <Card className="mb-8 border-white/10 bg-zinc-900 text-white">
          <CardHeader>
            <CardTitle>Current Limits</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-300">
            <p>Max devices: {entitlements.maxDevices}</p>
            <p>Max grid: {entitlements.maxGridRows}x{entitlements.maxGridCols}</p>
            <p>Ads: {entitlements.adsEnabled ? 'Enabled' : 'Disabled'}</p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {plans.map((plan) => (
          <Card key={plan.id} className="border-white/10 bg-zinc-900 text-white">
            <CardHeader>
              <CardTitle>{plan.name}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-zinc-400">{plan.description}</p>
              <p className="text-2xl font-semibold">
                {plan.monthlyPriceCents === 0
                  ? 'Free'
                  : `€${(plan.monthlyPriceCents / 100).toFixed(2)}/mo`}
              </p>
              {plan.code === 'free' || !plan.stripePriceId ? (
                <Button disabled variant="outline">
                  Current or Free
                </Button>
              ) : (
                <form action={checkoutAction}>
                  <input type="hidden" name="planCode" value={plan.code} />
                  <Button type="submit" className="w-full">
                    Upgrade
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}
