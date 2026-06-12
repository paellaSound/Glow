import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { planEntitlements, plans, teams } from '@/lib/db/schema';
import { DEFAULT_ENTITLEMENTS } from '@/lib/entitlements-defaults';

export type GifSearchMode = 'featured_page1' | 'full';

export type PlanEntitlements = {
  maxDevices: number;
  maxMatrixCells: number;
  adsEnabled: boolean;
  availablePresets: string[];
  audioReactive: boolean;
  matrixMode: boolean;
  advancedMatrix: boolean;
  customGridSize: boolean;
  maxGridRows: number;
  maxGridCols: number;
  maxRoomDurationMinutes: number;
  manualFallbackMode: boolean;
  priorityReconnectWindowSeconds: number;
  customRigLogo: boolean;
  customQrBranding: boolean;
  gifSearchMode: GifSearchMode;
  // v2 — Visuals surface
  visualsSurface: boolean;
  availableVisualArts: string[];
  maxRigs: number;
  effectLayering: boolean;
  maxPatternSequences: number;
  audienceReactions: boolean;
  customMediaUpload: boolean;
  gifBroadcast: boolean;
  sequencedText: boolean;
  deviceFlashControl: boolean;
  webrtcLiveCall: boolean;
  maxLiveCallDevices: number;
  visualsEmitSlotsPerMode: number;
  liveCallTestModeOnly: boolean;
  pollProductionEnabled: boolean;
};

export { DEFAULT_ENTITLEMENTS };

const KEY_MAP: Record<string, keyof PlanEntitlements> = {
  max_devices: 'maxDevices',
  max_matrix_cells: 'maxMatrixCells',
  ads_enabled: 'adsEnabled',
  available_presets: 'availablePresets',
  audio_reactive: 'audioReactive',
  matrix_mode: 'matrixMode',
  advanced_matrix: 'advancedMatrix',
  custom_grid_size: 'customGridSize',
  max_grid_rows: 'maxGridRows',
  max_grid_cols: 'maxGridCols',
  max_room_duration_minutes: 'maxRoomDurationMinutes',
  manual_fallback_mode: 'manualFallbackMode',
  priority_reconnect_window_seconds: 'priorityReconnectWindowSeconds',
  custom_rig_logo: 'customRigLogo',
  custom_qr_branding: 'customQrBranding',
  gif_search_mode: 'gifSearchMode',
  // v2
  visuals_surface: 'visualsSurface',
  available_visual_arts: 'availableVisualArts',
  max_rigs: 'maxRigs',
  effect_layering: 'effectLayering',
  max_pattern_sequences: 'maxPatternSequences',
  audience_reactions: 'audienceReactions',
  custom_media_upload: 'customMediaUpload',
  gif_broadcast: 'gifBroadcast',
  sequenced_text: 'sequencedText',
  device_flash_control: 'deviceFlashControl',
  webrtc_live_call: 'webrtcLiveCall',
  max_live_call_devices: 'maxLiveCallDevices',
  visuals_emit_slots_per_mode: 'visualsEmitSlotsPerMode',
  live_call_test_mode_only: 'liveCallTestModeOnly',
  poll_production_enabled: 'pollProductionEnabled',
};

export function buildEntitlementsFromRows(
  rows: { key: string; valueJson: unknown }[]
): PlanEntitlements {
  const result = { ...DEFAULT_ENTITLEMENTS };

  for (const row of rows) {
    const mappedKey = KEY_MAP[row.key];
    if (mappedKey) {
      (result as Record<string, unknown>)[mappedKey] = row.valueJson;
    }
  }

  return result;
}

export async function getEntitlementsByPlanId(planId: string): Promise<PlanEntitlements> {
  const rows = await db
    .select({ key: planEntitlements.key, valueJson: planEntitlements.valueJson })
    .from(planEntitlements)
    .where(eq(planEntitlements.planId, planId));

  return buildEntitlementsFromRows(rows);
}

export async function getEntitlementsByPlanCode(code: string): Promise<PlanEntitlements> {
  const plan = await db.select().from(plans).where(eq(plans.code, code)).limit(1);
  if (plan.length === 0) {
    return DEFAULT_ENTITLEMENTS;
  }
  return getEntitlementsByPlanId(plan[0].id);
}

export async function getTeamEntitlements(teamId: string): Promise<PlanEntitlements> {
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, teamId),
    with: {
      plan: {
        with: {
          entitlements: true,
        },
      },
    },
  });

  if (!team?.plan?.entitlements) {
    return DEFAULT_ENTITLEMENTS;
  }

  return buildEntitlementsFromRows(
    team.plan.entitlements.map((e) => ({ key: e.key, valueJson: e.valueJson }))
  );
}

export const PLAN_SEED_DATA = [
  {
    code: 'free',
    name: 'Free',
    description: 'Try the full show — Glow branded, up to 10 devices',
    monthlyPriceCents: 0,
    sortOrder: 0,
    entitlements: {
      max_devices: 10,
      max_matrix_cells: 10,
      ads_enabled: true,
      available_presets: ['solid', 'flash', 'pulse', 'audio'],
      audio_reactive: true,
      matrix_mode: true,
      advanced_matrix: false,
      custom_grid_size: false,
      max_grid_rows: 5,
      max_grid_cols: 5,
      max_room_duration_minutes: 60,
      manual_fallback_mode: true,
      priority_reconnect_window_seconds: 60,
      custom_rig_logo: false,
      custom_qr_branding: false,
      gif_search_mode: 'featured_page1',
      // v2
      visuals_surface: true,
      available_visual_arts: ['audio-shader'],
      max_rigs: 1,
      effect_layering: false,
      max_pattern_sequences: 1,
      audience_reactions: true,
      custom_media_upload: false,
      gif_broadcast: false,
      sequenced_text: false,
      device_flash_control: false,
      webrtc_live_call: false,
      max_live_call_devices: 0,
      visuals_emit_slots_per_mode: 1,
      live_call_test_mode_only: true,
      poll_production_enabled: false,
    },
  },
  {
    code: 'plus_25',
    name: 'Plus 25',
    description: 'Scale your party — 25 devices, ad-free, Glow branding',
    monthlyPriceCents: 299,
    sortOrder: 1,
    entitlements: {
      max_devices: 25,
      max_matrix_cells: 25,
      ads_enabled: false,
      available_presets: ['solid', 'flash', 'pulse', 'wave', 'rainbow'],
      audio_reactive: true,
      matrix_mode: true,
      advanced_matrix: true,
      custom_grid_size: false,
      max_grid_rows: 5,
      max_grid_cols: 5,
      max_room_duration_minutes: 180,
      manual_fallback_mode: true,
      priority_reconnect_window_seconds: 120,
      custom_rig_logo: false,
      custom_qr_branding: false,
      gif_search_mode: 'featured_page1',
      // v2
      visuals_surface: true,
      available_visual_arts: ['audio-shader'],
      max_rigs: 3,
      effect_layering: false,
      max_pattern_sequences: 3,
      audience_reactions: true,
      custom_media_upload: false,
      gif_broadcast: false,
      sequenced_text: true,
      device_flash_control: true,
      webrtc_live_call: false,
      max_live_call_devices: 0,
      visuals_emit_slots_per_mode: 2,
      live_call_test_mode_only: true,
      poll_production_enabled: true,
    },
  },
  {
    code: 'plus_50',
    name: 'Plus 50',
    description: 'Your brand on stage — logo, QR socials, 50 devices',
    monthlyPriceCents: 500,
    sortOrder: 2,
    entitlements: {
      max_devices: 50,
      max_matrix_cells: 50,
      ads_enabled: false,
      available_presets: ['solid', 'flash', 'pulse', 'wave', 'rainbow', 'diagonal', 'audio'],
      audio_reactive: true,
      matrix_mode: true,
      advanced_matrix: true,
      custom_grid_size: true,
      max_grid_rows: 10,
      max_grid_cols: 10,
      max_room_duration_minutes: 360,
      manual_fallback_mode: true,
      priority_reconnect_window_seconds: 180,
      custom_rig_logo: true,
      custom_qr_branding: true,
      gif_search_mode: 'full',
      // v2
      visuals_surface: true,
      available_visual_arts: ['audio-shader'],
      max_rigs: 10,
      effect_layering: true,
      max_pattern_sequences: 10,
      audience_reactions: true,
      custom_media_upload: true,
      gif_broadcast: true,
      sequenced_text: true,
      device_flash_control: true,
      webrtc_live_call: false,
      max_live_call_devices: 0,
      visuals_emit_slots_per_mode: 999,
      live_call_test_mode_only: false,
      poll_production_enabled: true,
    },
  },
  {
    code: 'pro',
    name: 'Pro',
    description: 'Live production — unlimited scale, camera mosaic, all effects',
    monthlyPriceCents: 2500,
    sortOrder: 3,
    entitlements: {
      max_devices: 999,
      max_matrix_cells: 999,
      ads_enabled: false,
      available_presets: ['solid', 'flash', 'pulse', 'wave', 'rainbow', 'diagonal', 'strobe', 'audio'],
      audio_reactive: true,
      matrix_mode: true,
      advanced_matrix: true,
      custom_grid_size: true,
      max_grid_rows: 31,
      max_grid_cols: 31,
      max_room_duration_minutes: 720,
      manual_fallback_mode: true,
      priority_reconnect_window_seconds: 300,
      custom_rig_logo: true,
      custom_qr_branding: true,
      gif_search_mode: 'full',
      // v2
      visuals_surface: true,
      available_visual_arts: ['audio-shader'],
      max_rigs: 50,
      effect_layering: true,
      max_pattern_sequences: 50,
      audience_reactions: true,
      custom_media_upload: true,
      gif_broadcast: true,
      sequenced_text: true,
      device_flash_control: true,
      webrtc_live_call: true,
      max_live_call_devices: 6,
      visuals_emit_slots_per_mode: 999,
      live_call_test_mode_only: false,
      poll_production_enabled: true,
    },
  },
] as const;
