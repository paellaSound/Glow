-- Custom migration to add rigs, rig_cues, and rig_socials tables, and update room_sessions

CREATE TABLE IF NOT EXISTS "rigs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_user_id" uuid NOT NULL REFERENCES "profiles"("id") ON DELETE CASCADE,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "default_visual_art_id" text NOT NULL,
  "palette" jsonb NOT NULL,
  "logo_asset_path" text,
  "logo_enabled" boolean DEFAULT false NOT NULL,
  "console_config" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "schema_version" integer DEFAULT 1 NOT NULL,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "rigs_owner_user_id_idx" ON "rigs" ("owner_user_id");
CREATE INDEX IF NOT EXISTS "rigs_team_id_idx" ON "rigs" ("team_id");

CREATE TABLE IF NOT EXISTS "rig_cues" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rig_id" uuid NOT NULL REFERENCES "rigs"("id") ON DELETE CASCADE,
  "visual_art_id" text NOT NULL,
  "sort_order" integer NOT NULL,
  "params" jsonb,
  "transition" jsonb,
  "label" text
);

CREATE INDEX IF NOT EXISTS "rig_cues_rig_id_idx" ON "rig_cues" ("rig_id");

CREATE TABLE IF NOT EXISTS "rig_socials" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "rig_id" uuid NOT NULL REFERENCES "rigs"("id") ON DELETE CASCADE,
  "kind" text NOT NULL,
  "label" text,
  "url" text NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "sort_order" integer NOT NULL
);

CREATE INDEX IF NOT EXISTS "rig_socials_rig_id_idx" ON "rig_socials" ("rig_id");

ALTER TABLE "room_sessions" ADD COLUMN IF NOT EXISTS "rig_id" uuid REFERENCES "rigs"("id") ON DELETE SET NULL;
ALTER TABLE "room_sessions" ADD COLUMN IF NOT EXISTS "palette_snapshot" jsonb;

ALTER TABLE "rigs" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rig_cues" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "rig_socials" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rigs_owner_all" ON "rigs";
CREATE POLICY "rigs_owner_all" ON "rigs" FOR ALL TO authenticated USING ((select auth.uid()) = owner_user_id);

DROP POLICY IF EXISTS "rig_cues_owner_all" ON "rig_cues";
CREATE POLICY "rig_cues_owner_all" ON "rig_cues" FOR ALL TO authenticated
  USING (rig_id IN (SELECT id FROM rigs WHERE owner_user_id = (select auth.uid())));

DROP POLICY IF EXISTS "rig_socials_owner_all" ON "rig_socials";
CREATE POLICY "rig_socials_owner_all" ON "rig_socials" FOR ALL TO authenticated
  USING (rig_id IN (SELECT id FROM rigs WHERE owner_user_id = (select auth.uid())));

-- Storage bucket creation and policies
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'rig-logos',
  'rig-logos',
  true,
  262144, -- 256KB
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 262144,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']::text[];

DROP POLICY IF EXISTS "rig_logos_insert_own" ON storage.objects;
DROP POLICY IF EXISTS "rig_logos_select_public" ON storage.objects;
DROP POLICY IF EXISTS "rig_logos_update_own" ON storage.objects;
DROP POLICY IF EXISTS "rig_logos_delete_own" ON storage.objects;

CREATE POLICY "rig_logos_insert_own" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'rig-logos' AND name LIKE (select auth.uid())::text || '/%');

CREATE POLICY "rig_logos_select_public" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'rig-logos');

CREATE POLICY "rig_logos_update_own" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'rig-logos' AND name LIKE (select auth.uid())::text || '/%');

CREATE POLICY "rig_logos_delete_own" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'rig-logos' AND name LIKE (select auth.uid())::text || '/%');