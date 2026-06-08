import Stripe from 'stripe';
import { redirect } from 'next/navigation';
import { Team } from '@/lib/db/schema';
import {
  getTeamByStripeCustomerId,
  getTeamForUser,
  getProfile,
  updateTeamSubscription,
  getPlanByStripePriceId,
  getPlanByCode,
} from '@/lib/db/queries';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

export async function createCheckoutSession({
  team,
  priceId,
  planCode,
}: {
  team: Team | null;
  priceId: string;
  planCode: string;
}) {
  const profile = await getProfile();

  if (!team || !profile) {
    redirect(`/sign-in?redirect=/billing&priceId=${priceId}`);
  }

  let customerId = team.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile.email,
      metadata: { team_id: team.id },
    });
    customerId = customer.id;
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${process.env.BASE_URL}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.BASE_URL}/billing`,
    customer: customerId,
    metadata: {
      team_id: team.id,
      plan_code: planCode,
    },
    allow_promotion_codes: true,
  });

  redirect(session.url!);
}

export async function createCustomerPortalSession(team: Team, planCode?: string) {
  if (!team.stripeCustomerId) {
    redirect('/billing');
  }

  if (planCode && team.stripeSubscriptionId) {
    try {
      const targetPlan = await getPlanByCode(planCode);
      if (targetPlan && targetPlan.stripePriceId) {
        const subscription = await stripe.subscriptions.retrieve(team.stripeSubscriptionId);
        const subscriptionItemId = subscription.items.data[0]?.id;

        if (subscriptionItemId) {
          // Intenta crear el portal directamente en el flujo de confirmación de actualización
          return await stripe.billingPortal.sessions.create({
            customer: team.stripeCustomerId,
            return_url: `${process.env.BASE_URL}/billing`,
            flow_data: {
              type: 'subscription_update_confirm',
              subscription_update_confirm: {
                subscription: team.stripeSubscriptionId,
                items: [
                  {
                    id: subscriptionItemId,
                    price: targetPlan.stripePriceId,
                  },
                ],
              },
            },
          });
        }
      }
    } catch (error) {
      console.error(
        'Failed to initiate direct subscription update flow. Falling back to standard portal.',
        error
      );
    }
  }

  return stripe.billingPortal.sessions.create({
    customer: team.stripeCustomerId,
    return_url: `${process.env.BASE_URL}/billing`,
  });
}

export async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  const subscriptionId = subscription.id;
  const status = subscription.status;

  const team = await getTeamByStripeCustomerId(customerId);

  if (!team) {
    console.error('Team not found for Stripe customer:', customerId);
    return;
  }

  const priceId = subscription.items.data[0]?.price?.id;
  const productId = subscription.items.data[0]?.price?.product as string;

  if (status === 'active' || status === 'trialing') {
    const plan = priceId ? await getPlanByStripePriceId(priceId) : null;
    if (!plan) {
      console.error('Plan not found for Stripe price:', priceId);
      return;
    }

    await updateTeamSubscription(team.id, {
      stripeSubscriptionId: subscriptionId,
      stripeProductId: productId,
      stripePriceId: priceId ?? null,
      planId: plan.id,
      subscriptionStatus: status,
    });
  } else {
    const freePlan = await getPlanByCode('free');
    if (!freePlan) return;

    await updateTeamSubscription(team.id, {
      stripeSubscriptionId: null,
      stripeProductId: null,
      stripePriceId: null,
      planId: freePlan.id,
      subscriptionStatus: status === 'canceled' ? 'free' : status,
    });
  }
}

export async function getStripePrices() {
  try {
    const prices = await stripe.prices.list({
      expand: ['data.product'],
      active: true,
      type: 'recurring',
    });

    return prices.data.map((price) => ({
      id: price.id,
      productId:
        typeof price.product === 'string' ? price.product : price.product.id,
      unitAmount: price.unit_amount,
      currency: price.currency,
      interval: price.recurring?.interval,
      trialPeriodDays: price.recurring?.trial_period_days,
    }));
  } catch {
    return [];
  }
}
