-- Glow MVP schema migration
-- Drops legacy SaaS tables and creates Glow product schema

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DROP TABLE IF EXISTS "invitations" CASCADE;
DROP TABLE IF EXISTS "activity_logs" CASCADE;
DROP TABLE IF EXISTS "team_members" CASCADE;
DROP TABLE IF EXISTS "teams" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

CREATE TABLE IF NOT EXISTS "profiles" (
  "id" uuid PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "full_name" text,
  "avatar_url" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "plans" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "code" text NOT NULL UNIQUE,
  "name" text NOT NULL,
  "description" text,
  "stripe_product_id" text,
  "stripe_price_id" text UNIQUE,
  "monthly_price_cents" integer DEFAULT 0 NOT NULL,
  "currency" text DEFAULT 'eur' NOT NULL,
  "is_active" boolean DEFAULT true NOT NULL,
  "sort_order" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "plan_entitlements" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "plan_id" uuid NOT NULL REFERENCES "plans"("id") ON DELETE CASCADE,
  "key" text NOT NULL,
  "value_json" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "plan_entitlements_plan_key_idx" ON "plan_entitlements" ("plan_id", "key");

CREATE TABLE IF NOT EXISTS "teams" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "owner_user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "stripe_customer_id" text UNIQUE,
  "stripe_subscription_id" text UNIQUE,
  "stripe_product_id" text,
  "stripe_price_id" text,
  "plan_id" uuid NOT NULL REFERENCES "plans"("id"),
  "subscription_status" text DEFAULT 'free' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "teams_owner_user_id_idx" ON "teams" ("owner_user_id");

CREATE TABLE IF NOT EXISTS "team_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "role" text DEFAULT 'owner' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "team_members_team_user_idx" ON "team_members" ("team_id", "user_id");

CREATE TABLE IF NOT EXISTS "room_sessions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "room_code" text NOT NULL,
  "team_id" uuid NOT NULL REFERENCES "teams"("id"),
  "orchestrator_user_id" uuid NOT NULL REFERENCES "profiles"("id"),
  "plan_id" uuid REFERENCES "plans"("id"),
  "plan_code_snapshot" text NOT NULL,
  "entitlements_snapshot" jsonb NOT NULL,
  "matrix_rows" integer NOT NULL,
  "matrix_cols" integer NOT NULL,
  "started_at" timestamp with time zone DEFAULT now() NOT NULL,
  "ended_at" timestamp with time zone,
  "close_reason" text,
  "peak_devices" integer DEFAULT 0 NOT NULL,
  "total_joined_devices" integer DEFAULT 0 NOT NULL,
  "ads_enabled_snapshot" boolean DEFAULT true NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "room_sessions_team_started_idx" ON "room_sessions" ("team_id", "started_at");
CREATE INDEX IF NOT EXISTS "room_sessions_room_code_idx" ON "room_sessions" ("room_code");

CREATE TABLE IF NOT EXISTS "ad_impressions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "room_session_id" uuid REFERENCES "room_sessions"("id") ON DELETE SET NULL,
  "team_id" uuid REFERENCES "teams"("id") ON DELETE SET NULL,
  "viewer_type" text NOT NULL,
  "placement" text NOT NULL,
  "provider" text DEFAULT 'mock' NOT NULL,
  "provider_impression_id" text,
  "shown_at" timestamp with time zone DEFAULT now() NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL
);

ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "team_members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plans" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "plan_entitlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "room_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ad_impressions" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON "profiles" FOR SELECT TO authenticated USING ((select auth.uid()) = id);
CREATE POLICY "profiles_update_own" ON "profiles" FOR UPDATE TO authenticated USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);

CREATE POLICY "teams_select_own" ON "teams" FOR SELECT TO authenticated USING ((select auth.uid()) = owner_user_id);

CREATE POLICY "plans_select_all" ON "plans" FOR SELECT TO authenticated USING (true);
CREATE POLICY "plan_entitlements_select_all" ON "plan_entitlements" FOR SELECT TO authenticated USING (true);

CREATE POLICY "room_sessions_select_own_team" ON "room_sessions" FOR SELECT TO authenticated
  USING (team_id IN (SELECT id FROM teams WHERE owner_user_id = (select auth.uid())));
