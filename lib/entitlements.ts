import { eq } from 'drizzle-orm';
import { db } from '@/lib/db/drizzle';
import { planEntitlements, plans, teams } from '@/lib/db/schema';

export type PlanEntitlements = {
  maxDevices: number;
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
};

export const DEFAULT_ENTITLEMENTS: PlanEntitlements = {
  maxDevices: 10,
  adsEnabled: true,
  availablePresets: ['solid', 'flash', 'pulse'],
  audioReactive: false,
  matrixMode: true,
  advancedMatrix: false,
  customGridSize: false,
  maxGridRows: 5,
  maxGridCols: 5,
  maxRoomDurationMinutes: 60,
  manualFallbackMode: true,
  priorityReconnectWindowSeconds: 60,
};

const KEY_MAP: Record<string, keyof PlanEntitlements> = {
  max_devices: 'maxDevices',
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
    description: 'Try Glow with up to 10 devices',
    monthlyPriceCents: 0,
    sortOrder: 0,
    entitlements: {
      max_devices: 10,
      ads_enabled: true,
      available_presets: ['solid', 'flash', 'pulse'],
      audio_reactive: false,
      matrix_mode: true,
      advanced_matrix: false,
      custom_grid_size: false,
      max_grid_rows: 5,
      max_grid_cols: 5,
      max_room_duration_minutes: 60,
      manual_fallback_mode: true,
      priority_reconnect_window_seconds: 60,
    },
  },
  {
    code: 'plus_25',
    name: 'Plus 25',
    description: 'Up to 25 devices, no ads',
    monthlyPriceCents: 100,
    sortOrder: 1,
    entitlements: {
      max_devices: 25,
      ads_enabled: false,
      available_presets: ['solid', 'flash', 'pulse', 'wave', 'rainbow'],
      audio_reactive: false,
      matrix_mode: true,
      advanced_matrix: true,
      custom_grid_size: false,
      max_grid_rows: 10,
      max_grid_cols: 10,
      max_room_duration_minutes: 180,
      manual_fallback_mode: true,
      priority_reconnect_window_seconds: 120,
    },
  },
  {
    code: 'plus_50',
    name: 'Plus 50',
    description: 'Up to 50 devices, advanced presets',
    monthlyPriceCents: 500,
    sortOrder: 2,
    entitlements: {
      max_devices: 50,
      ads_enabled: false,
      available_presets: ['solid', 'flash', 'pulse', 'wave', 'rainbow', 'diagonal', 'audio'],
      audio_reactive: true,
      matrix_mode: true,
      advanced_matrix: true,
      custom_grid_size: true,
      max_grid_rows: 15,
      max_grid_cols: 15,
      max_room_duration_minutes: 360,
      manual_fallback_mode: true,
      priority_reconnect_window_seconds: 180,
    },
  },
  {
    code: 'pro',
    name: 'Pro',
    description: 'High capacity events and all effects',
    monthlyPriceCents: 2500,
    sortOrder: 3,
    entitlements: {
      max_devices: 999,
      ads_enabled: false,
      available_presets: ['solid', 'flash', 'pulse', 'wave', 'rainbow', 'diagonal', 'strobe', 'audio'],
      audio_reactive: true,
      matrix_mode: true,
      advanced_matrix: true,
      custom_grid_size: true,
      max_grid_rows: 25,
      max_grid_cols: 25,
      max_room_duration_minutes: 720,
      manual_fallback_mode: true,
      priority_reconnect_window_seconds: 300,
    },
  },
] as const;
