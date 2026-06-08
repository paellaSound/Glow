-- Room media assets table
CREATE TABLE IF NOT EXISTS "room_media_assets" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "room_session_id" uuid NOT NULL REFERENCES "room_sessions"("id") ON DELETE CASCADE,
  "team_id" uuid NOT NULL REFERENCES "teams"("id") ON DELETE CASCADE,
  "storage_path" text NOT NULL,
  "mime" text NOT NULL,
  "bytes" integer NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "room_media_assets_session_idx" ON "room_media_assets" ("room_session_id");

ALTER TABLE "room_media_assets" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "room_media_assets_owner_all" ON "room_media_assets";
CREATE POLICY "room_media_assets_owner_all" ON "room_media_assets" FOR ALL TO authenticated
  USING (true);
