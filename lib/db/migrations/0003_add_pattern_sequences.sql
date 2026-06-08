-- Pattern sequences: reusable device pattern presets per team/user

CREATE TABLE IF NOT EXISTS "pattern_sequences" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "palette" jsonb NOT NULL,
  "effects" jsonb NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "schema_version" integer DEFAULT 1 NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "pattern_sequences_owner_user_id_idx" ON "pattern_sequences" ("owner_user_id");
CREATE INDEX IF NOT EXISTS "pattern_sequences_team_id_idx" ON "pattern_sequences" ("team_id");

ALTER TABLE "pattern_sequences" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pattern_sequences_owner_all" ON "pattern_sequences";
CREATE POLICY "pattern_sequences_owner_all" ON "pattern_sequences" FOR ALL TO authenticated
  USING ((select auth.uid()) = owner_user_id);
