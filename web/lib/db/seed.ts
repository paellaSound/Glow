import './load-env';

import { eq } from 'drizzle-orm';
import { db } from './drizzle';
import { plans } from './schema';
import { createAdminClient } from '@/lib/supabase/admin';
import { bootstrapUserProfile } from './queries';
import { ensurePlansSeeded } from './plan-seed';

const TEST_USER = {
  email: 'test@test.com',
  password: 'admin123',
  fullName: 'Test User',
};

async function seedTestUser() {
  const admin = createAdminClient();
  if (!admin) {
    console.log(
      'Skipping test user seed: set SUPABASE_SERVICE_ROLE_KEY in .env.local to create test@test.com'
    );
    return;
  }

  console.log('Seeding test user...');

  const { data: listData, error: listError } = await admin.auth.admin.listUsers();
  if (listError) {
    console.warn('Could not list Supabase users:', listError.message);
    return;
  }

  const existing = listData.users.find(
    (user) => user.email?.toLowerCase() === TEST_USER.email
  );

  let userId = existing?.id;

  if (!userId) {
    const { data, error } = await admin.auth.admin.createUser({
      email: TEST_USER.email,
      password: TEST_USER.password,
      email_confirm: true,
      user_metadata: { full_name: TEST_USER.fullName },
    });

    if (error) {
      console.warn('Could not create test user:', error.message);
      return;
    }

    userId = data.user.id;
    console.log(`Created test user: ${TEST_USER.email}`);
  } else {
    await admin.auth.admin.updateUserById(userId, {
      password: TEST_USER.password,
      email_confirm: true,
      user_metadata: { full_name: TEST_USER.fullName },
    });
    console.log(`Test user already exists: ${TEST_USER.email}`);
  }

  await bootstrapUserProfile(userId, TEST_USER.email, TEST_USER.fullName);
  console.log(`Test credentials: ${TEST_USER.email} / ${TEST_USER.password}`);
}

async function seedPlans() {
  console.log('Seeding plans and entitlements...');
  await ensurePlansSeeded();
  console.log('Plans and entitlements ready.');
}

async function syncStripeProducts() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.log('Skipping Stripe sync: STRIPE_SECRET_KEY not set.');
    return;
  }

  const { stripe } = await import('../payments/stripe');

  console.log('Syncing Stripe products for paid plans...');

  const paidPlans = [
    { code: 'plus_25', name: 'Plus 25', amount: 299 },
    { code: 'plus_50', name: 'Plus 50', amount: 500 },
    { code: 'pro', name: 'Pro', amount: 2500 },
  ];

  for (const planDef of paidPlans) {
    const dbPlan = await db
      .select()
      .from(plans)
      .where(eq(plans.code, planDef.code))
      .limit(1);

    if (dbPlan.length === 0) continue;

    if (dbPlan[0].stripePriceId) {
      console.log(`Stripe price already linked for ${planDef.code}`);
      continue;
    }

    try {
      const product = await stripe.products.create({
        name: planDef.name,
        description: `Glow ${planDef.name} plan`,
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: planDef.amount,
        currency: 'eur',
        recurring: { interval: 'month' },
      });

      await db
        .update(plans)
        .set({
          stripeProductId: product.id,
          stripePriceId: price.id,
          updatedAt: new Date(),
        })
        .where(eq(plans.id, dbPlan[0].id));

      console.log(`Created Stripe product/price for ${planDef.code}`);
    } catch (error) {
      console.warn(`Could not create Stripe product for ${planDef.code}:`, error);
    }
  }
}

async function seed() {
  await seedPlans();
  await syncStripeProducts();
  await seedTestUser();
}

seed()
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Seed process finished.');
    process.exit(0);
  });
