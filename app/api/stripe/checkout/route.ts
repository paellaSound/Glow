import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { teams } from '@/lib/db/schema';
import { NextRequest, NextResponse } from 'next/server';
import { stripe, handleSubscriptionChange } from '@/lib/payments/stripe';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const sessionId = searchParams.get('session_id');

  if (!sessionId) {
    return NextResponse.redirect(new URL('/billing', request.url));
  }

  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    const teamId = session.metadata?.team_id;
    const customerId =
      typeof session.customer === 'string' ? session.customer : session.customer?.id;

    if (teamId && customerId) {
      await db
        .update(teams)
        .set({ stripeCustomerId: customerId, updatedAt: new Date() })
        .where(eq(teams.id, teamId));
    }

    if (session.subscription) {
      const subscriptionId =
        typeof session.subscription === 'string'
          ? session.subscription
          : session.subscription.id;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await handleSubscriptionChange(subscription);
    }

    return NextResponse.redirect(new URL('/billing?success=1', request.url));
  } catch (error) {
    console.error('Error handling successful checkout:', error);
    return NextResponse.redirect(new URL('/billing?error=checkout', request.url));
  }
}
