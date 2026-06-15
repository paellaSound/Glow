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
  // Branding (paid axis #2) — quitar marca de agua Glow del surface/proyector
  removeWatermark: boolean;
  // Escala — el plan ∞ exige confirmar cobertura de red antes de abrir sala
  requiresCoverageAck: boolean;
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
  remove_watermark: 'removeWatermark',
  requires_coverage_ack: 'requiresCoverageAck',
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

// ─────────────────────────────────────────────────────────────────────────────
// MODELO DE NEGOCIO (2026-06): se cobra SOLO por dos ejes
//   1) Escala de dispositivos/usuarios  → el coste real del servidor de realtime
//   2) Branding                          → logo custom + quitar marca de agua Glow
// TODAS las demás features están desbloqueadas en TODOS los planes (true/ilimitado).
// Para re-gatear una feature en el futuro: pon su flag a `false` aquí y corre
// `pnpm db:seed`. El enforcement del servidor (realtime/src/room-manager.ts) y los
// <PlanGate> de la UI volverán a actuar automáticamente. Ver docs/plans.md.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Features desbloqueadas para todos los planes en el modelo actual.
 * Mantener una sola fuente evita divergencias entre planes; lo que SÍ cambia por
 * plan (escala + branding) se define explícitamente en cada plan más abajo.
 */
const ALL_FEATURES_UNLOCKED = {
  available_presets: ['solid', 'flash', 'pulse', 'wave', 'rainbow', 'diagonal', 'strobe', 'audio'],
  audio_reactive: true,
  matrix_mode: true,
  advanced_matrix: true,
  custom_grid_size: true,
  manual_fallback_mode: true,
  gif_search_mode: 'full',
  visuals_surface: true,
  available_visual_arts: ['audio-shader'],
  effect_layering: true,
  audience_reactions: true,
  custom_media_upload: true,
  gif_broadcast: true,
  sequenced_text: true,
  device_flash_control: true,
  webrtc_live_call: true,
  live_call_test_mode_only: false,
  visuals_emit_slots_per_mode: 999,
  poll_production_enabled: true,
  // Palancas latentes: hoy uniformes para no diferenciar; son reactivables como
  // límites de coste si hiciera falta (ver docs/plans.md → "Palancas latentes").
  max_room_duration_minutes: 720,
  priority_reconnect_window_seconds: 180,
  max_rigs: 50,
  max_pattern_sequences: 50,
} as const;

export const PLAN_SEED_DATA = [
  {
    code: 'free',
    name: 'Free',
    description: 'Run the whole product free — Glow branded, up to 15 phones',
    monthlyPriceCents: 0,
    sortOrder: 0,
    entitlements: {
      ...ALL_FEATURES_UNLOCKED,
      // Escala
      max_devices: 15,
      max_matrix_cells: 15,
      max_grid_rows: 5,
      max_grid_cols: 5,
      max_live_call_devices: 2,
      // Monetización: el plan gratis muestra house ads
      ads_enabled: true,
      // Branding: marca Glow (sin logo custom, con marca de agua)
      custom_rig_logo: false,
      custom_qr_branding: false,
      remove_watermark: false,
      // Escala: sin tope que requiera confirmar cobertura
      requires_coverage_ack: false,
    },
  },
  {
    code: 'plus_25',
    name: 'Party',
    description: 'Scale up your night — 50 phones, no ads, Glow branding',
    monthlyPriceCents: 299,
    sortOrder: 1,
    entitlements: {
      ...ALL_FEATURES_UNLOCKED,
      // Escala
      max_devices: 50,
      max_matrix_cells: 50,
      max_grid_rows: 10,
      max_grid_cols: 10,
      max_live_call_devices: 8,
      // Pagar quita los ads
      ads_enabled: false,
      // Branding: todavía marca Glow (branding propio empieza en Venue)
      custom_rig_logo: false,
      custom_qr_branding: false,
      remove_watermark: false,
      requires_coverage_ack: false,
    },
  },
  {
    code: 'plus_50',
    name: 'Venue',
    description: 'Make the stage yours — your logo, custom QR, no watermark, 300 phones',
    monthlyPriceCents: 500,
    sortOrder: 2,
    entitlements: {
      ...ALL_FEATURES_UNLOCKED,
      // Escala
      max_devices: 300,
      max_matrix_cells: 300,
      max_grid_rows: 20,
      max_grid_cols: 20,
      max_live_call_devices: 50,
      ads_enabled: false,
      // Branding propio desbloqueado
      custom_rig_logo: true,
      custom_qr_branding: true,
      remove_watermark: true,
      requires_coverage_ack: false,
    },
  },
  {
    code: 'pro',
    name: 'Pro',
    description: 'Unlimited phones — your brand + live production',
    monthlyPriceCents: 2500,
    sortOrder: 3,
    entitlements: {
      ...ALL_FEATURES_UNLOCKED,
      // Escala "infinita" (capada alto; el cuello de botella real es la cobertura
      // de la zona, por eso este plan exige confirmación antes de abrir sala)
      max_devices: 100000,
      max_matrix_cells: 100000,
      max_grid_rows: 100,
      max_grid_cols: 100,
      max_live_call_devices: 200,
      ads_enabled: false,
      // Branding propio desbloqueado
      custom_rig_logo: true,
      custom_qr_branding: true,
      remove_watermark: true,
      // Único plan que pide confirmar cobertura de red antes de abrir sala
      requires_coverage_ack: true,
    },
  },
] as const;
