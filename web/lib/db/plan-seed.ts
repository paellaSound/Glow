import { eq } from 'drizzle-orm';
import { db } from './drizzle';
import { plans, planEntitlements } from './schema';
import { PLAN_SEED_DATA } from '@/lib/entitlements';

function valuesMatch(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

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
      const row = existing[0];
      if (
        row.name !== planData.name ||
        row.description !== planData.description ||
        row.monthlyPriceCents !== planData.monthlyPriceCents ||
        row.sortOrder !== planData.sortOrder
      ) {
        await db
          .update(plans)
          .set({
            name: planData.name,
            description: planData.description,
            monthlyPriceCents: planData.monthlyPriceCents,
            sortOrder: planData.sortOrder,
            updatedAt: new Date(),
          })
          .where(eq(plans.id, planId));
      }
    }

    const existingEnt = await db
      .select()
      .from(planEntitlements)
      .where(eq(planEntitlements.planId, planId));

    for (const [key, value] of Object.entries(planData.entitlements)) {
      const existingRow = existingEnt.find((entry) => entry.key === key);

      if (!existingRow) {
        await db.insert(planEntitlements).values({
          planId,
          key,
          valueJson: value,
        });
        continue;
      }

      if (!valuesMatch(existingRow.valueJson, value)) {
        await db
          .update(planEntitlements)
          .set({ valueJson: value, updatedAt: new Date() })
          .where(eq(planEntitlements.id, existingRow.id));
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
