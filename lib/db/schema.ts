import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const profiles = pgTable('profiles', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull(),
  fullName: text('full_name'),
  avatarUrl: text('avatar_url'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  code: text('code').notNull().unique(),
  name: text('name').notNull(),
  description: text('description'),
  stripeProductId: text('stripe_product_id'),
  stripePriceId: text('stripe_price_id').unique(),
  monthlyPriceCents: integer('monthly_price_cents').notNull().default(0),
  currency: text('currency').notNull().default('eur'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const planEntitlements = pgTable(
  'plan_entitlements',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    valueJson: jsonb('value_json').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('plan_entitlements_plan_key_idx').on(table.planId, table.key)]
);

export const teams = pgTable(
  'teams',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    stripeCustomerId: text('stripe_customer_id').unique(),
    stripeSubscriptionId: text('stripe_subscription_id').unique(),
    stripeProductId: text('stripe_product_id'),
    stripePriceId: text('stripe_price_id'),
    planId: uuid('plan_id')
      .notNull()
      .references(() => plans.id),
    subscriptionStatus: text('subscription_status').notNull().default('free'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('teams_owner_user_id_idx').on(table.ownerUserId)]
);

export const teamMembers = pgTable(
  'team_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('owner'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex('team_members_team_user_idx').on(table.teamId, table.userId)]
);

export const roomSessions = pgTable(
  'room_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    roomCode: text('room_code').notNull(),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id),
    orchestratorUserId: uuid('orchestrator_user_id')
      .notNull()
      .references(() => profiles.id),
    planId: uuid('plan_id').references(() => plans.id),
    planCodeSnapshot: text('plan_code_snapshot').notNull(),
    entitlementsSnapshot: jsonb('entitlements_snapshot').notNull(),
    matrixRows: integer('matrix_rows').notNull(),
    matrixCols: integer('matrix_cols').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    closeReason: text('close_reason'),
    peakDevices: integer('peak_devices').notNull().default(0),
    totalJoinedDevices: integer('total_joined_devices').notNull().default(0),
    adsEnabledSnapshot: boolean('ads_enabled_snapshot').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('room_sessions_team_started_idx').on(table.teamId, table.startedAt),
    index('room_sessions_room_code_idx').on(table.roomCode),
  ]
);

export const adImpressions = pgTable('ad_impressions', {
  id: uuid('id').primaryKey().defaultRandom(),
  roomSessionId: uuid('room_session_id').references(() => roomSessions.id, {
    onDelete: 'set null',
  }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'set null' }),
  viewerType: text('viewer_type').notNull(),
  placement: text('placement').notNull(),
  provider: text('provider').notNull().default('mock'),
  providerImpressionId: text('provider_impression_id'),
  shownAt: timestamp('shown_at', { withTimezone: true }).notNull().defaultNow(),
  metadata: jsonb('metadata').notNull().default({}),
});

export const plansRelations = relations(plans, ({ many }) => ({
  entitlements: many(planEntitlements),
  teams: many(teams),
}));

export const planEntitlementsRelations = relations(planEntitlements, ({ one }) => ({
  plan: one(plans, {
    fields: [planEntitlements.planId],
    references: [plans.id],
  }),
}));

export const profilesRelations = relations(profiles, ({ many }) => ({
  ownedTeams: many(teams),
  teamMembers: many(teamMembers),
}));

export const teamsRelations = relations(teams, ({ one, many }) => ({
  owner: one(profiles, {
    fields: [teams.ownerUserId],
    references: [profiles.id],
  }),
  plan: one(plans, {
    fields: [teams.planId],
    references: [plans.id],
  }),
  teamMembers: many(teamMembers),
  roomSessions: many(roomSessions),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(profiles, {
    fields: [teamMembers.userId],
    references: [profiles.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const roomSessionsRelations = relations(roomSessions, ({ one, many }) => ({
  team: one(teams, {
    fields: [roomSessions.teamId],
    references: [teams.id],
  }),
  orchestrator: one(profiles, {
    fields: [roomSessions.orchestratorUserId],
    references: [profiles.id],
  }),
  plan: one(plans, {
    fields: [roomSessions.planId],
    references: [plans.id],
  }),
  adImpressions: many(adImpressions),
}));

export type Profile = typeof profiles.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type PlanEntitlement = typeof planEntitlements.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type RoomSession = typeof roomSessions.$inferSelect;
export type AdImpression = typeof adImpressions.$inferSelect;

export type TeamWithPlan = Team & {
  plan: Plan;
};
