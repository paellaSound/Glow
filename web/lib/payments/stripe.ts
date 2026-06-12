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
import { getPostHogClient } from '@/lib/posthog-server';
import { identifyOrchestrator } from '@/lib/posthog-analytics';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-08-27.basil',
});

function buildCheckoutReturnQuery(returnUrl?: string): string {
  if (!returnUrl) return '';
  return `&return_url=${encodeURIComponent(returnUrl)}`;
}

export async function createCheckoutSession({
  team,
  priceId,
  planCode,
  returnUrl,
}: {
  team: Team | null;
  priceId: string;
  planCode: string;
  returnUrl?: string;
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

  const returnQuery = buildCheckoutReturnQuery(returnUrl);
  const cancelPath = returnUrl ?? '/billing';

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: 'subscription',
    success_url: `${process.env.BASE_URL}/api/stripe/checkout?session_id={CHECKOUT_SESSION_ID}${returnQuery}`,
    cancel_url: `${process.env.BASE_URL}${cancelPath}`,
    customer: customerId,
    metadata: {
      team_id: team.id,
      plan_code: planCode,
    },
    allow_promotion_codes: true,
  });

  redirect(session.url!);
}

export async function createCustomerPortalSession(
  team: Team,
  planCode?: string,
  returnUrl?: string
) {
  const portalReturnUrl = `${process.env.BASE_URL}${returnUrl ?? '/billing'}`;

  if (!team.stripeCustomerId) {
    redirect(returnUrl ?? '/billing');
  }

  if (planCode && team.stripeSubscriptionId) {
    try {
      const targetPlan = await getPlanByCode(planCode);
      if (targetPlan && targetPlan.stripePriceId) {
        const subscription = await stripe.subscriptions.retrieve(team.stripeSubscriptionId);
        const subscriptionItemId = subscription.items.data[0]?.id;

        if (subscriptionItemId) {
          return await stripe.billingPortal.sessions.create({
            customer: team.stripeCustomerId,
            return_url: portalReturnUrl,
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
    return_url: portalReturnUrl,
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

    const posthog = getPostHogClient();
    identifyOrchestrator(posthog, team.ownerUserId, {
      team_id: team.id,
      plan_code: plan.code,
      subscription_status: status,
    });
    posthog.capture({
      distinctId: team.ownerUserId,
      event: 'subscription_activated',
      properties: {
        team_id: team.id,
        plan_code: plan.code,
        plan_name: plan.name,
        subscription_status: status,
        stripe_subscription_id: subscriptionId,
      },
      groups: { team: team.id },
    });
    await posthog.shutdown();
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

    const posthog = getPostHogClient();
    identifyOrchestrator(posthog, team.ownerUserId, {
      team_id: team.id,
      plan_code: 'free',
      subscription_status: status === 'canceled' ? 'free' : status,
    });
    posthog.capture({
      distinctId: team.ownerUserId,
      event: 'subscription_cancelled',
      properties: {
        team_id: team.id,
        subscription_status: status,
        stripe_subscription_id: subscriptionId,
      },
      groups: { team: team.id },
    });
    await posthog.shutdown();
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
