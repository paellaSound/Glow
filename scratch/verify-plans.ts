import * as dotenv from 'dotenv';
import * as path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

async function main() {
  const { db } = await import('../lib/db/drizzle');
  const { plans, planEntitlements } = await import('../lib/db/schema');
  const { eq } = await import('drizzle-orm');

  console.log('Fetching plans from database...');
  try {
    const allPlans = await db.select().from(plans);
    console.log(`Found ${allPlans.length} plans:`);
    for (const plan of allPlans) {
      console.log(`- Plan ID: ${plan.id}`);
      console.log(`  Code: ${plan.code}`);
      console.log(`  Name: ${plan.name}`);

      const entitlements = await db
        .select()
        .from(planEntitlements)
        .where(eq(planEntitlements.planId, plan.id));

      console.log(`  Entitlements (${entitlements.length}):`);
      for (const ent of entitlements) {
        console.log(`    ${ent.key}: ${JSON.stringify(ent.valueJson)}`);
      }
    }
  } catch (error) {
    console.error('Error fetching plans:', error);
  }
}

main().then(() => process.exit(0));
