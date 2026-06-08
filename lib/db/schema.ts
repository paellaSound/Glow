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
    rigId: uuid('rig_id').references(() => rigs.id, { onDelete: 'set null' }),
    paletteSnapshot: jsonb('palette_snapshot'),
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

export const rigs = pgTable(
  'rigs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    defaultVisualArtId: text('default_visual_art_id').notNull(),
    palette: jsonb('palette').notNull(), // string[] of 1-4 hex colors
    logoAssetPath: text('logo_asset_path'),
    logoEnabled: boolean('logo_enabled').notNull().default(false),
    consoleConfig: jsonb('console_config').notNull().default({}),
    metadata: jsonb('metadata').notNull().default({}),
    schemaVersion: integer('schema_version').notNull().default(1),
    isDefault: boolean('is_default').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('rigs_owner_user_id_idx').on(table.ownerUserId),
    index('rigs_team_id_idx').on(table.teamId),
  ]
);

export const rigCues = pgTable(
  'rig_cues',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rigId: uuid('rig_id')
      .notNull()
      .references(() => rigs.id, { onDelete: 'cascade' }),
    visualArtId: text('visual_art_id').notNull(),
    sortOrder: integer('sort_order').notNull(),
    params: jsonb('params'),
    transition: jsonb('transition'),
    label: text('label'),
  },
  (table) => [
    index('rig_cues_rig_id_idx').on(table.rigId),
  ]
);

export const rigSocials = pgTable(
  'rig_socials',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    rigId: uuid('rig_id')
      .notNull()
      .references(() => rigs.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    label: text('label'),
    url: text('url').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    sortOrder: integer('sort_order').notNull(),
  },
  (table) => [
    index('rig_socials_rig_id_idx').on(table.rigId),
  ]
);

export const patternSequences = pgTable(
  'pattern_sequences',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    ownerUserId: uuid('owner_user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id')
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    palette: jsonb('palette').notNull(),
    effects: jsonb('effects').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    schemaVersion: integer('schema_version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index('pattern_sequences_owner_user_id_idx').on(table.ownerUserId),
    index('pattern_sequences_team_id_idx').on(table.teamId),
  ]
);

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
  rigs: many(rigs),
  patternSequences: many(patternSequences),
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
  rigs: many(rigs),
  patternSequences: many(patternSequences),
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
  rig: one(rigs, {
    fields: [roomSessions.rigId],
    references: [rigs.id],
  }),
  adImpressions: many(adImpressions),
}));

export const rigsRelations = relations(rigs, ({ one, many }) => ({
  owner: one(profiles, {
    fields: [rigs.ownerUserId],
    references: [profiles.id],
  }),
  team: one(teams, {
    fields: [rigs.teamId],
    references: [teams.id],
  }),
  cues: many(rigCues),
  socials: many(rigSocials),
}));

export const rigCuesRelations = relations(rigCues, ({ one }) => ({
  rig: one(rigs, {
    fields: [rigCues.rigId],
    references: [rigs.id],
  }),
}));

export const rigSocialsRelations = relations(rigSocials, ({ one }) => ({
  rig: one(rigs, {
    fields: [rigSocials.rigId],
    references: [rigs.id],
  }),
}));

export const patternSequencesRelations = relations(patternSequences, ({ one }) => ({
  owner: one(profiles, {
    fields: [patternSequences.ownerUserId],
    references: [profiles.id],
  }),
  team: one(teams, {
    fields: [patternSequences.teamId],
    references: [teams.id],
  }),
}));

export type Profile = typeof profiles.$inferSelect;
export type Plan = typeof plans.$inferSelect;
export type PlanEntitlement = typeof planEntitlements.$inferSelect;
export type Team = typeof teams.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type RoomSession = typeof roomSessions.$inferSelect;
export type AdImpression = typeof adImpressions.$inferSelect;
export type Rig = typeof rigs.$inferSelect;
export type RigCue = typeof rigCues.$inferSelect;
export type RigSocial = typeof rigSocials.$inferSelect;
export type PatternSequence = typeof patternSequences.$inferSelect;

export type TeamWithPlan = Team & {
  plan: Plan;
};
