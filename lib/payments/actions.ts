'use server';

import { redirect } from 'next/navigation';
import { createCheckoutSession, createCustomerPortalSession } from './stripe';
import { getTeamForUser, getAllPlans } from '@/lib/db/queries';

export async function checkoutAction(formData: FormData) {
  const planCode = formData.get('planCode') as string;
  const team = await getTeamForUser();
  const plans = await getAllPlans();
  const plan = plans.find((p) => p.code === planCode);

  if (!plan || !plan.stripePriceId) {
    redirect('/billing');
  }

  await createCheckoutSession({
    team,
    priceId: plan.stripePriceId,
    planCode: plan.code,
  });
}

export async function customerPortalAction() {
  const team = await getTeamForUser();
  if (!team) {
    redirect('/sign-in');
  }

  const portalSession = await createCustomerPortalSession(team);
  redirect(portalSession.url);
}
