-- Remove legacy visual arts (glow-branded, pulse-grid).
-- audio-shader becomes the only standard art, available on every tier.

-- 1. Every plan's available_visual_arts becomes ['audio-shader']
UPDATE "plan_entitlements"
SET "value_json" = '["audio-shader"]'::jsonb
WHERE "key" = 'available_visual_arts';

-- 2. Rigs pointing at a removed art fall back to audio-shader
UPDATE "rigs"
SET "default_visual_art_id" = 'audio-shader'
WHERE "default_visual_art_id" IN ('glow-branded', 'pulse-grid');

-- 3. Cues pointing at a removed art fall back to audio-shader
UPDATE "rig_cues"
SET "visual_art_id" = 'audio-shader'
WHERE "visual_art_id" IN ('glow-branded', 'pulse-grid');
