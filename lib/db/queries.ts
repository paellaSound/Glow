import { eq } from 'drizzle-orm';
import { db } from './drizzle';
import {
  profiles,
  teams,
  teamMembers,
  plans,
  adImpressions,
  roomSessions,
} from './schema';
import { createClient } from '@/lib/supabase/server';
import { getTeamEntitlements } from '@/lib/entitlements';
import { getFreePlan } from './plan-seed';

export async function getAuthUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function getProfile() {
  const user = await getAuthUser();
  if (!user) return null;

  const result = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, user.id))
    .limit(1);

  return result[0] ?? null;
}

export async function getTeamForUser() {
  const profile = await getProfile();
  if (!profile) return null;

  const result = await db.query.teams.findFirst({
    where: eq(teams.ownerUserId, profile.id),
    with: {
      plan: true,
    },
  });

  return result ?? null;
}

export async function getTeamByStripeCustomerId(customerId: string) {
  const result = await db
    .select()
    .from(teams)
    .where(eq(teams.stripeCustomerId, customerId))
    .limit(1);

  return result.length > 0 ? result[0] : null;
}

export async function updateTeamSubscription(
  teamId: string,
  data: {
    stripeSubscriptionId: string | null;
    stripeProductId: string | null;
    stripePriceId: string | null;
    planId: string;
    subscriptionStatus: string;
  }
) {
  await db
    .update(teams)
    .set({
      ...data,
      updatedAt: new Date(),
    })
    .where(eq(teams.id, teamId));
}

export async function bootstrapUserProfile(
  userId: string,
  email: string,
  fullName?: string | null,
  avatarUrl?: string | null
) {
  const existing = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, userId))
    .limit(1);

  if (existing.length > 0) {
    return existing[0];
  }

  const freePlan = await getFreePlan();

  const [profile] = await db
    .insert(profiles)
    .values({
      id: userId,
      email,
      fullName: fullName ?? null,
      avatarUrl: avatarUrl ?? null,
    })
    .returning();

  const [team] = await db
    .insert(teams)
    .values({
      name: `${fullName ?? email.split('@')[0]}'s Team`,
      ownerUserId: userId,
      planId: freePlan.id,
      subscriptionStatus: 'free',
    })
    .returning();

  await db.insert(teamMembers).values({
    teamId: team.id,
    userId,
    role: 'owner',
  });

  return profile;
}

export async function getPlanByCode(code: string) {
  const result = await db.select().from(plans).where(eq(plans.code, code)).limit(1);
  return result[0] ?? null;
}

export async function getPlanByStripePriceId(priceId: string) {
  const result = await db
    .select()
    .from(plans)
    .where(eq(plans.stripePriceId, priceId))
    .limit(1);
  return result[0] ?? null;
}

export async function getAllPlans() {
  return db.query.plans.findMany({
    where: eq(plans.isActive, true),
    orderBy: (p, { asc }) => [asc(p.sortOrder)],
    with: {
      entitlements: true,
    },
  });
}

export async function recordAdImpression(data: {
  roomSessionId?: string;
  teamId?: string;
  viewerType: 'orchestrator' | 'player';
  placement: 'room_create' | 'room_join';
  metadata?: Record<string, unknown>;
}) {
  await db.insert(adImpressions).values({
    roomSessionId: data.roomSessionId ?? null,
    teamId: data.teamId ?? null,
    viewerType: data.viewerType,
    placement: data.placement,
    provider: 'mock',
    metadata: data.metadata ?? {},
  });
}

export async function createRoomSession(data: {
  roomCode: string;
  teamId: string;
  orchestratorUserId: string;
  planId: string;
  planCodeSnapshot: string;
  entitlementsSnapshot: Record<string, unknown>;
  matrixRows: number;
  matrixCols: number;
  adsEnabledSnapshot: boolean;
}) {
  const [session] = await db.insert(roomSessions).values(data).returning();
  return session;
}

export async function closeRoomSession(
  sessionId: string,
  data: {
    closeReason: string;
    peakDevices: number;
    totalJoinedDevices: number;
  }
) {
  await db
    .update(roomSessions)
    .set({
      endedAt: new Date(),
      closeReason: data.closeReason,
      peakDevices: data.peakDevices,
      totalJoinedDevices: data.totalJoinedDevices,
    })
    .where(eq(roomSessions.id, sessionId));
}

export { getTeamEntitlements };
