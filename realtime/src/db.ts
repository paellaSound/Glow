import type { PlanEntitlements } from './types.js';
import { getPostgresUrl } from './env.js';
import { createPostgresClient } from './postgres-client.js';

let sql: ReturnType<typeof createPostgresClient> | null = null;

function getSql() {
  if (!sql) {
    sql = createPostgresClient(getPostgresUrl());
  }
  return sql;
}

const DEFAULT_ENTITLEMENTS: PlanEntitlements = {
  maxDevices: 10,
  adsEnabled: true,
  availablePresets: ['solid', 'flash', 'pulse', 'audio'],
  audioReactive: true,
  matrixMode: true,
  advancedMatrix: false,
  customGridSize: false,
  maxGridRows: 5,
  maxGridCols: 5,
  maxRoomDurationMinutes: 60,
  manualFallbackMode: true,
  priorityReconnectWindowSeconds: 60,
  // v2 — Visuals surface
  visualsSurface: true,
  availableVisualArts: ['glow-branded'],
  maxRigs: 1,
  effectLayering: false,
  maxPatternSequences: 1,
  audienceReactions: true,
  customMediaUpload: false,
  gifBroadcast: false,
  sequencedText: false,
  deviceFlashControl: false,
  webrtcLiveCall: false,
  maxLiveCallDevices: 0,
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
};

export async function getTeamContextForUser(userId: string) {
  const db = getSql();
  const teams = await db`
    SELECT t.id, t.plan_id, t.owner_user_id, p.code as plan_code
    FROM teams t
    JOIN plans p ON p.id = t.plan_id
    WHERE t.owner_user_id = ${userId}
    LIMIT 1
  `;

  if (teams.length === 0) return null;

  const team = teams[0];
  const entitlements = await getEntitlementsByPlanId(team.plan_id as string);

  return {
    teamId: team.id as string,
    planId: team.plan_id as string,
    planCode: team.plan_code as string,
    entitlements,
  };
}

async function getEntitlementsByPlanId(planId: string): Promise<PlanEntitlements> {
  const db = getSql();
  const rows = await db`
    SELECT key, value_json FROM plan_entitlements WHERE plan_id = ${planId}
  `;

  const result = { ...DEFAULT_ENTITLEMENTS };
  for (const row of rows) {
    const key = KEY_MAP[row.key as string];
    if (key) {
      (result as Record<string, unknown>)[key] = row.value_json;
    }
  }
  return result;
}

export async function createRoomSession(data: {
  roomCode: string;
  teamId: string;
  orchestratorUserId: string;
  planId: string;
  planCodeSnapshot: string;
  entitlementsSnapshot: PlanEntitlements;
  matrixRows: number;
  matrixCols: number;
  adsEnabledSnapshot: boolean;
  rigId?: string | null;
  paletteSnapshot?: string[] | null;
}) {
  const db = getSql();
  const rows = await db`
    INSERT INTO room_sessions (
      room_code, team_id, orchestrator_user_id, plan_id,
      plan_code_snapshot, entitlements_snapshot, matrix_rows, matrix_cols,
      ads_enabled_snapshot, rig_id, palette_snapshot
    ) VALUES (
      ${data.roomCode}, ${data.teamId}, ${data.orchestratorUserId}, ${data.planId},
      ${data.planCodeSnapshot}, ${JSON.stringify(data.entitlementsSnapshot)}::jsonb,
      ${data.matrixRows}, ${data.matrixCols}, ${data.adsEnabledSnapshot},
      ${data.rigId || null}, ${data.paletteSnapshot ? JSON.stringify(data.paletteSnapshot) : null}::jsonb
    )
    RETURNING id
  `;
  return rows[0].id as string;
}

export async function closeRoomSession(
  sessionId: string,
  data: { closeReason: string; peakDevices: number; totalJoinedDevices: number }
) {
  const db = getSql();
  await db`
    UPDATE room_sessions SET
      ended_at = now(),
      close_reason = ${data.closeReason},
      peak_devices = ${data.peakDevices},
      total_joined_devices = ${data.totalJoinedDevices}
    WHERE id = ${sessionId}
  `;
}

export async function getRigById(id: string) {
  const db = getSql();
  const rows = await db`
    SELECT * FROM rigs WHERE id = ${id}
  `;
  return rows[0] || null;
}

export async function getRigSocials(rigId: string) {
  const db = getSql();
  const rows = await db`
    SELECT kind, label, url, enabled, sort_order
    FROM rig_socials
    WHERE rig_id = ${rigId} AND enabled = true
    ORDER BY sort_order ASC
  `;
  return rows.map((r) => ({
    kind: r.kind as string,
    label: r.label as string | null,
    url: r.url as string,
    enabled: r.enabled as boolean,
    sortOrder: Number(r.sort_order),
  }));
}

export async function getActiveSessionForUser(userId: string) {
  const db = getSql();
  const rows = await db`
    SELECT room_code FROM room_sessions
    WHERE orchestrator_user_id = ${userId}
      AND ended_at IS NULL
    ORDER BY started_at DESC
    LIMIT 1
  `;
  return rows.length > 0 ? { roomCode: rows[0].room_code as string } : null;
}

export async function reconcileOrphanedSessions() {
  const db = getSql();
  const rows = await db`
    UPDATE room_sessions SET
      ended_at = now(),
      close_reason = 'server_restart'
    WHERE ended_at IS NULL
    RETURNING room_code
  `;
  if (rows.length > 0) {
    console.log(
      `Reconciled ${rows.length} orphaned room session(s):`,
      rows.map((row) => row.room_code).join(', ')
    );
  }
}

export async function deleteRoomMediaAssets(sessionId: string) {
  const db = getSql();
  await db`
    DELETE FROM room_media_assets WHERE room_session_id = ${sessionId}
  `;
}
