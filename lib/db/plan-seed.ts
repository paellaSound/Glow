import { eq } from 'drizzle-orm';
import { db } from './drizzle';
import { plans, planEntitlements } from './schema';
import { PLAN_SEED_DATA } from '@/lib/entitlements';

export async function ensurePlansSeeded() {
  for (const planData of PLAN_SEED_DATA) {
    const existing = await db
      .select()
      .from(plans)
      .where(eq(plans.code, planData.code))
      .limit(1);

    let planId: string;

    if (existing.length === 0) {
      const [plan] = await db
        .insert(plans)
        .values({
          code: planData.code,
          name: planData.name,
          description: planData.description,
          monthlyPriceCents: planData.monthlyPriceCents,
          sortOrder: planData.sortOrder,
        })
        .returning();
      planId = plan.id;
    } else {
      planId = existing[0].id;
    }

    for (const [key, value] of Object.entries(planData.entitlements)) {
      const existingEnt = await db
        .select()
        .from(planEntitlements)
        .where(eq(planEntitlements.planId, planId))
        .limit(100);

      const hasKey = existingEnt.some((entry) => entry.key === key);
      if (!hasKey) {
        await db.insert(planEntitlements).values({
          planId,
          key,
          valueJson: value,
        });
      }
    }
  }
}

export async function getFreePlan() {
  await ensurePlansSeeded();

  const freePlan = await db.select().from(plans).where(eq(plans.code, 'free')).limit(1);

  if (freePlan.length === 0) {
    throw new Error('Free plan could not be initialized.');
  }

  return freePlan[0];
}
