'use server';

import { redirect } from 'next/navigation';
import { createCheckoutSession, createCustomerPortalSession } from './stripe';
import { getTeamForUser, getAllPlans } from '@/lib/db/queries';
import { getPostHogClient } from '@/lib/posthog-server';

function resolveReturnUrl(raw: FormDataEntryValue | null): string | undefined {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return undefined;
  return raw;
}

export async function checkoutAction(formData: FormData) {
  const planCode = formData.get('planCode') as string;
  const returnUrl = resolveReturnUrl(formData.get('returnUrl'));
  const team = await getTeamForUser();
  const plans = await getAllPlans();
  const plan = plans.find((p) => p.code === planCode);

  if (team && (team.subscriptionStatus === 'active' || team.subscriptionStatus === 'trialing')) {
    const portalSession = await createCustomerPortalSession(team, planCode, returnUrl);
    redirect(portalSession.url);
  }

  if (!plan || !plan.stripePriceId) {
    redirect(returnUrl ?? '/billing');
  }

  if (team) {
    const posthog = getPostHogClient();
    posthog.capture({
      distinctId: team.id,
      event: 'checkout_started',
      properties: {
        team_id: team.id,
        plan_code: plan.code,
        plan_name: plan.name,
        return_url: returnUrl,
      },
    });
    await posthog.shutdown();
  }

  await createCheckoutSession({
    team,
    priceId: plan.stripePriceId,
    planCode: plan.code,
    returnUrl,
  });
}

export async function customerPortalAction(formData: FormData) {
  const team = await getTeamForUser();
  if (!team) {
    redirect('/sign-in');
  }

  const planCode = formData.get('planCode') as string | undefined;
  const returnUrl = resolveReturnUrl(formData.get('returnUrl'));
  const portalSession = await createCustomerPortalSession(team, planCode, returnUrl);
  redirect(portalSession.url);
}
