import { stripe } from '../payments/stripe';
import { db } from './drizzle';
import { users, teams, teamMembers } from './schema';
import { hashPassword } from '@/lib/auth/session';
import { eq } from 'drizzle-orm';

async function createStripeProducts() {
  console.log('Checking existing Stripe products and prices...');

  const activeProducts = await stripe.products.list({ active: true });

  let baseProduct = activeProducts.data.find((p) => p.name === 'Base');
  if (!baseProduct) {
    console.log('Creating Base product and price on Stripe...');
    baseProduct = await stripe.products.create({
      name: 'Base',
      description: 'Base subscription plan',
    });

    await stripe.prices.create({
      product: baseProduct.id,
      unit_amount: 800, // $8 in cents
      currency: 'usd',
      recurring: {
        interval: 'month',
        trial_period_days: 7,
      },
    });
  } else {
    console.log('Base product already exists on Stripe.');
  }

  let plusProduct = activeProducts.data.find((p) => p.name === 'Plus');
  if (!plusProduct) {
    console.log('Creating Plus product and price on Stripe...');
    plusProduct = await stripe.products.create({
      name: 'Plus',
      description: 'Plus subscription plan',
    });

    await stripe.prices.create({
      product: plusProduct.id,
      unit_amount: 1200, // $12 in cents
      currency: 'usd',
      recurring: {
        interval: 'month',
        trial_period_days: 7,
      },
    });
  } else {
    console.log('Plus product already exists on Stripe.');
  }

  console.log('Stripe products and prices check completed.');
}

async function seed() {
  const email = 'test@test.com';
  const password = 'admin123';
  const passwordHash = await hashPassword(password);

  console.log('Checking if test user exists...');
  const existingUsers = await db.select().from(users).where(eq(users.email, email)).limit(1);
  let user;

  if (existingUsers.length === 0) {
    [user] = await db
      .insert(users)
      .values([
        {
          email: email,
          passwordHash: passwordHash,
          role: "owner",
        },
      ])
      .returning();
    console.log('Initial user created.');
  } else {
    user = existingUsers[0];
    console.log('Initial user already exists.');
  }

  console.log('Checking if test team exists...');
  const existingTeamMembers = await db
    .select({ team: teams })
    .from(teamMembers)
    .innerJoin(teams, eq(teamMembers.teamId, teams.id))
    .where(eq(teamMembers.userId, user.id))
    .limit(1);

  if (existingTeamMembers.length === 0) {
    const [team] = await db
      .insert(teams)
      .values({
        name: 'Test Team',
      })
      .returning();
    console.log('Initial team created.');

    await db.insert(teamMembers).values({
      teamId: team.id,
      userId: user.id,
      role: 'owner',
    });
    console.log('Linked user to team.');
  } else {
    console.log('Test team already exists and user is linked.');
  }

  await createStripeProducts();
}

seed()
  .catch((error) => {
    console.error('Seed process failed:', error);
    process.exit(1);
  })
  .finally(() => {
    console.log('Seed process finished. Exiting...');
    process.exit(0);
  });
