import type { Server, Socket } from 'socket.io';
import { isValidPresetId, type AudioFeatures, type EffectDistribution, type EffectLayer, type PresetParams, validateDistributionWeights } from 'glow-presets';
import {
  REACTION_ALLOWLIST_FREE,
  REACTION_ALLOWLIST_PAID,
  BOOST_WINDOW_MS,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_FREE,
  RATE_LIMIT_PAID,
  MAX_BOOST_FREE,
  MAX_BOOST_PAID,
  type ReactionEmoji
} from 'glow-visuals';
import {
  buildDefaultGlowSurfaceLogo,
  getPublicRigSocials,
  resolveSurfaceLogo,
} from './branding.js';
import {
  canEmitVisualsMode,
  recordVisualsEmit,
} from './freemium-depth.js';
import type {
  RoomState,
  RoomStatePayload,
  PlayerDeviceState,
  DeviceTarget,
  VisualMediaEvent,
  TorchCommand,
  TorchCapability,
  LiveTile,
  LiveCallState,
  LiveCallStatePayload,
  WebrtcSignal,
  VisualsState,
  YoutubeQueueItem,
  YoutubeTransitionEffect,
  PlayerVisualState,
  RigSocial,
} from './types.js';
import {
  cellKey,
  generatePublicId,
  generateRoomCode,
  labelFromPosition,
} from './matrix.js';
import { captureRealtimeEvent } from './analytics/posthog.js';
import {
  closeRoomSession,
  createRoomSession,
  getTeamContextForUser,
  getRigById,
  getActiveSessionForUser,
  deleteRoomMediaAssets,
  getRigSocials,
} from './db.js';
import { validateAccessToken, verifyVisualsToken } from './auth.js';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAuthKey, getSupabaseUrl } from './env.js';

const rooms = new Map<string, RoomState>();

/** Viewer identity used in webrtc:signal routing (surface is the sole subscriber). */
const VISUALS_VIEWER_ID = 'visuals';

const playerReactionTimestamps = new Map<string, number[]>();
const playerBoostState = new Map<string, { lastEmoji: ReactionEmoji; lastTime: number; boost: number }>();

function getLiveRoomByOrchestrator(userId: string): RoomState | null {
  for (const room of rooms.values()) {
    if (room.orchestratorUserId === userId) {
      return room;
    }
  }
  return null;
}

export function getRoom(code: string) {
  return rooms.get(code.toUpperCase());
}

export function serializeRoomState(room: RoomState): RoomStatePayload {
  const occupied: RoomStatePayload['matrix']['occupied'] = [];

  const allPlayers = [
    ...room.devices.values(),
    ...room.disconnectedPlayers.values(),
  ];

  for (const device of allPlayers) {
    if (device.row !== undefined && device.col !== undefined && device.label) {
      occupied.push({
        row: device.row,
        col: device.col,
        label: device.label,
        publicId: device.publicId,
        nickname: device.nickname,
        latencyMs: device.latencyMs,
        status: device.status,
      });
    }
  }

  return {
    code: room.code,
    sessionId: room.sessionId,
    status: room.status,
    mode: room.mode,
    matrix: {
      rows: room.matrix.rows,
      cols: room.matrix.cols,
      occupied,
    },
    devices: allPlayers.map(({ socketId: _, ...rest }) => rest),
    entitlements: room.entitlements,
    adsEnabled: room.adsEnabled,
    serverTime: Date.now(),
    rigName: room.rigName,
    rigSocials: getPublicRigSocials(room),
  };
}

function resolveTargetSockets(room: RoomState, target: DeviceTarget): string[] {
  if (target.kind === 'all') {
    return Array.from(room.devices.values()).map((d) => d.socketId);
  }
  if (target.kind === 'devices') {
    const socketIds: string[] = [];
    for (const device of room.devices.values()) {
      if (target.publicIds.includes(device.publicId)) {
        socketIds.push(device.socketId);
      }
    }
    return socketIds;
  }
  if (target.kind === 'matrix_range') {
    const socketIds: string[] = [];
    for (const device of room.devices.values()) {
      if (device.row !== undefined && device.col !== undefined) {
        if (
          device.row >= target.fromRow &&
          device.row <= target.toRow &&
          device.col >= target.fromCol &&
          device.col <= target.toCol
        ) {
          socketIds.push(device.socketId);
        }
      }
    }
    return socketIds;
  }
  if (target.kind === 'fraction') {
    const sorted = Array.from(room.devices.values()).sort(
      (a, b) => a.joinedAt - b.joinedAt || a.publicId.localeCompare(b.publicId)
    );
    const start = Math.floor(target.from * sorted.length);
    const end = Math.min(sorted.length, Math.round(target.to * sorted.length));
    return sorted.slice(start, end).map((d) => d.socketId);
  }
  return [];
}

function emitRoomState(io: Server, room: RoomState) {
  const payload = serializeRoomState(room);
  io.to(`orchestrator:${room.code}`).emit('room:state', payload);
}

function getDeviceByPublicId(room: RoomState, publicId: string) {
  for (const device of room.devices.values()) {
    if (device.publicId === publicId) return device;
  }
  return room.disconnectedPlayers.get(publicId) ?? null;
}

function getConnectedDeviceByPublicId(room: RoomState, publicId: string) {
  for (const device of room.devices.values()) {
    if (device.publicId === publicId) return device;
  }
  return null;
}

function getActivePlayerCount(room: RoomState) {
  return room.devices.size + room.disconnectedPlayers.size;
}

function purgeExpiredDisconnectedPlayers(room: RoomState, now: number) {
  const graceMs = room.entitlements.priorityReconnectWindowSeconds * 1000;

  for (const [publicId, device] of room.disconnectedPlayers) {
    if (now - device.lastSeenAt > graceMs) {
      clearDevicePosition(room, device);
      room.disconnectedPlayers.delete(publicId);
    }
  }
}

function getDeviceBySocketId(room: RoomState, socketId: string) {
  return room.devices.get(socketId) ?? null;
}

function clearDevicePosition(room: RoomState, device: PlayerDeviceState) {
  if (device.row !== undefined && device.col !== undefined) {
    room.matrix.cells.delete(cellKey(device.row, device.col));
  }
  device.row = undefined;
  device.col = undefined;
  device.label = undefined;
}

function assignDevicePosition(
  room: RoomState,
  device: PlayerDeviceState,
  row: number,
  col: number
) {
  if (row < 0 || col < 0 || row >= room.matrix.rows || col >= room.matrix.cols) {
    return { ok: false as const, reason: 'Position out of bounds' };
  }

  const key = cellKey(row, col);
  const existing = room.matrix.cells.get(key);
  if (existing && existing !== device.publicId) {
    return { ok: false as const, reason: 'Cell already occupied' };
  }

  clearDevicePosition(room, device);
  device.row = row;
  device.col = col;
  device.label = labelFromPosition(row, col);
  room.matrix.cells.set(key, device.publicId);
  return { ok: true as const };
}

function generateCallId(): string {
  return `call-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function serializeLiveCallState(liveCall: LiveCallState): LiveCallStatePayload {
  return {
    callId: liveCall.callId,
    active: liveCall.active,
    publishers: Array.from(liveCall.publishers.values()),
    tiles: liveCall.tiles,
  };
}

function emitLiveCallState(io: Server, room: RoomState) {
  if (!room.liveCall) return;
  io.to(`orchestrator:${room.code}`).emit(
    'orchestrator:live_call_state',
    serializeLiveCallState(room.liveCall)
  );
}

function defaultTilesForPublishers(publicIds: string[]): LiveTile[] {
  const count = publicIds.length;
  if (count === 0) return [];
  if (count === 1) {
    // PiP corner — keeps visuals as the main focus
    return [{ publicId: publicIds[0]!, x: 0.72, y: 0.72, w: 0.26, h: 0.26, z: 1 }];
  }
  const cols = count <= 4 ? 2 : 3;
  const rows = Math.ceil(count / cols);
  const tileW = 1 / cols;
  const tileH = 1 / rows;
  return publicIds.map((publicId, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      publicId,
      x: col * tileW,
      y: row * tileH,
      w: tileW,
      h: tileH,
      z: 1,
    };
  });
}

function syncLiveTiles(room: RoomState) {
  if (!room.liveCall) return;
  const liveIds = Array.from(room.liveCall.publishers.values())
    .filter((p) => p.status === 'live')
    .map((p) => p.publicId);
  room.liveCall.tiles = room.liveCall.tiles.filter((t) => liveIds.includes(t.publicId));
  for (const id of liveIds) {
    if (!room.liveCall.tiles.some((t) => t.publicId === id)) {
      room.liveCall.tiles.push(...defaultTilesForPublishers([id]));
    }
  }
}

function broadcastLiveLayout(io: Server, room: RoomState) {
  if (!room.liveCall) return;
  io.to(`visuals:${room.code}`).emit('visuals:live_layout', {
    tiles: room.liveCall.tiles,
    callId: room.liveCall.callId,
  });
}

const SURFACE_RECONNECT_COOLDOWN_MS = 5000;

/** Refresh in-memory entitlements from the team's current plan (e.g. after upgrade). */
async function refreshRoomEntitlementsFromTeam(room: RoomState): Promise<void> {
  const teamContext = await getTeamContextForUser(room.orchestratorUserId);
  if (!teamContext) return;
  room.entitlements = teamContext.entitlements;
  room.adsEnabled = teamContext.entitlements.adsEnabled;
  room.planCode = teamContext.planCode;
}

/** Art ids removed from the registry — rooms/rigs referencing them fall back to audio-shader. */
const LEGACY_ART_IDS = new Set(['glow-branded', 'pulse-grid']);

const VISUALS_MODES = new Set(['standard', 'youtube', 'custom-video', '3d', 'pptt']);

function updateVisualsState(room: RoomState, updates: Partial<Omit<VisualsState, 'version' | 'updatedAt'>>) {
  room.visualsState = {
    ...room.visualsState,
    ...updates,
    version: room.visualsState.version + 1,
    updatedAt: Date.now(),
  };
  return room.visualsState;
}

function updatePlayerVisualState(room: RoomState, kind: PlayerVisualState['kind'], payload: any) {
  room.playerVisualState = {
    kind,
    payload,
    version: room.playerVisualState.version + 1,
    updatedAt: Date.now(),
  };
  return room.playerVisualState;
}

function getPlayerVisualEmitEvent(state: PlayerVisualState) {
  if (state.kind === 'color') return { name: 'visual:color', payload: state.payload };
  if (state.kind === 'preset') return { name: 'visual:preset', payload: state.payload };
  if (state.kind === 'distribution') return { name: 'visual:effect_distribution', payload: state.payload };
  if (state.kind === 'fallback') return { name: 'fallback:mode_changed', payload: state.payload };
  return null;
}

function emitSurfaceReconnect(
  io: Server,
  room: RoomState,
  publisherPublicId: string
): void {
  if (!room.liveCall?.active) return;

  if (!room.liveCall.surfaceReconnectCooldown) {
    room.liveCall.surfaceReconnectCooldown = new Map();
  }

  const now = Date.now();
  const last = room.liveCall.surfaceReconnectCooldown.get(publisherPublicId) ?? 0;
  if (now - last < SURFACE_RECONNECT_COOLDOWN_MS) return;

  room.liveCall.surfaceReconnectCooldown.set(publisherPublicId, now);
  io.to(`player:${publisherPublicId}`).emit('webrtc:surface_reconnect', {
    callId: room.liveCall.callId,
  });
}

function stopLivePublishers(
  io: Server,
  room: RoomState,
  publisherIds?: string[]
) {
  if (!room.liveCall?.active) return;

  const toStop = publisherIds?.length
    ? publisherIds
    : Array.from(room.liveCall.publishers.keys());

  for (const publicId of toStop) {
    room.liveCall.publishers.delete(publicId);
    const device = getConnectedDeviceByPublicId(room, publicId);
    if (device) {
      io.to(`player:${publicId}`).emit('webrtc:publish_stop', {
        callId: room.liveCall.callId,
      });
    }
  }

  if (room.liveCall.publishers.size === 0) {
    room.liveCall.active = false;
    room.liveCall.tiles = [];
    io.to(`visuals:${room.code}`).emit('visuals:live_layout', { tiles: [], callId: room.liveCall.callId });
  } else {
    syncLiveTiles(room);
    broadcastLiveLayout(io, room);
  }

  emitLiveCallState(io, room);
}

function handlePublisherDisconnect(io: Server, room: RoomState, publicId: string) {
  if (!room.liveCall?.active) return;
  if (!room.liveCall.publishers.has(publicId)) return;

  room.liveCall.publishers.delete(publicId);
  if (room.liveCall.publishers.size === 0) {
    room.liveCall.active = false;
    room.liveCall.tiles = [];
    io.to(`visuals:${room.code}`).emit('visuals:live_layout', { tiles: [], callId: room.liveCall.callId });
  } else {
    syncLiveTiles(room);
    broadcastLiveLayout(io, room);
  }
  emitLiveCallState(io, room);
}

async function closeRoom(io: Server, room: RoomState, reason: string) {
  if (room.liveCall?.active) {
    stopLivePublishers(io, room);
  }
  room.status = 'closing';
  io.to(`room:${room.code}`).emit('room:closed', { reason });
  io.to(`visuals:${room.code}`).emit('room:closed', { reason });

  // Clean up media assets from database
  try {
    await deleteRoomMediaAssets(room.sessionId);
  } catch (err: any) {
    console.error('[cleanup] Failed to delete database assets:', err.message);
  }

  // Clean up media files from Supabase Storage
  try {
    const url = getSupabaseUrl();
    const key = getSupabaseAuthKey();
    if (url && key) {
      const client = createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data: files } = await client.storage.from('room-media').list(room.sessionId);
      if (files && files.length > 0) {
        const paths = files.map((f) => `${room.sessionId}/${f.name}`);
        await client.storage.from('room-media').remove(paths);
      }
    }
  } catch (err: any) {
    console.error('[cleanup] Failed to delete storage media:', err.message);
  }

  const durationMinutes = Math.round((Date.now() - room.createdAt) / 60_000);

  captureRealtimeEvent(room.ownerUserId, 'room_closed', {
    roomCode: room.code,
    teamId: room.teamId,
    ownerUserId: room.ownerUserId,
    planCode: room.planCode,
  }, {
    close_reason: reason,
    duration_minutes: durationMinutes,
    peak_device_count: room.peakDevices,
    total_joined_devices: room.totalJoinedDevices,
  });

  await closeRoomSession(room.sessionId, {
    closeReason: reason,
    peakDevices: room.peakDevices,
    totalJoinedDevices: room.totalJoinedDevices,
  });
  rooms.delete(room.code);
}

export function startCleanupInterval(io: Server) {
  setInterval(() => {
    const now = Date.now();
    for (const room of rooms.values()) {
      if (room.status === 'orchestrator_missing' && room.reconnectDeadlineAt) {
        if (now > room.reconnectDeadlineAt) {
          void closeRoom(io, room, 'orchestrator_disconnected');
          continue;
        }
      }

      if (now > room.closesAt) {
        void closeRoom(io, room, 'duration_limit');
        continue;
      }

      purgeExpiredDisconnectedPlayers(room, now);

      if (getActivePlayerCount(room) === 0 && now - room.lastActivityAt > 5 * 60 * 1000) {
        void closeRoom(io, room, 'empty_room');
      }
    }
  }, 30_000);
}

export function registerSocketHandlers(io: Server, socket: Socket) {
  socket.on(
    'orchestrator:create_room',
    async (
      payload: {
        accessToken: string;
        matrix: { rows: number; cols: number };
        rigId?: string | null;
        paletteSnapshot?: string[] | null;
      },
      callback: (response: unknown) => void
    ) => {
      try {
        const user = await validateAccessToken(payload.accessToken);
        if (!user) {
          callback({ error: 'Unauthorized' });
          return;
        }

        const teamContext = await getTeamContextForUser(user.id);
        if (!teamContext) {
          callback({ error: 'Team not found' });
          return;
        }

        const liveRoom = getLiveRoomByOrchestrator(user.id);
        if (liveRoom) {
          callback({ error: 'ACTIVE_SESSION', roomCode: liveRoom.code });
          return;
        }

        const activeSession = await getActiveSessionForUser(user.id);
        if (activeSession) {
          callback({ error: 'ACTIVE_SESSION', roomCode: activeSession.roomCode });
          return;
        }

        const { entitlements } = teamContext;
        const rows = Math.min(Math.max(1, payload.matrix.rows), entitlements.maxGridRows);
        const cols = Math.min(Math.max(1, payload.matrix.cols), entitlements.maxGridCols);

        if (rows * cols > entitlements.maxMatrixCells) {
          captureRealtimeEvent(user.id, 'plan_limit_hit', {
            roomCode: 'pending',
            teamId: teamContext.teamId,
            ownerUserId: user.id,
            planCode: teamContext.planCode,
          }, {
            limit_key: 'matrix_too_large',
            matrix_rows: rows,
            matrix_cols: cols,
            matrix_cells: rows * cols,
            max_matrix_cells: entitlements.maxMatrixCells,
          });

          callback({
            error: 'matrix_too_large',
            reason: 'matrix_too_large',
            maxMatrixCells: entitlements.maxMatrixCells,
          });
          return;
        }

        let code = generateRoomCode();
        while (rooms.has(code)) {
          code = generateRoomCode();
        }

        const sessionId = await createRoomSession({
          roomCode: code,
          teamId: teamContext.teamId,
          orchestratorUserId: user.id,
          planId: teamContext.planId,
          planCodeSnapshot: teamContext.planCode,
          entitlementsSnapshot: entitlements,
          matrixRows: rows,
          matrixCols: cols,
          adsEnabledSnapshot: entitlements.adsEnabled,
          rigId: payload.rigId,
          paletteSnapshot: payload.paletteSnapshot,
        });

        const now = Date.now();

        // Load VJ settings from selected rig if provided
        const visualsState: VisualsState = {
          mode: 'standard',
          artId: 'audio-shader',
          params: {},
          palette: payload.paletteSnapshot || ['#7c3aed', '#06b6d4'],
          logo: null,
          transition: 'cut',
          qrConfig: null,
          displayName: 'Glow',
          text: null,
          version: 1,
          updatedAt: now,
        };

        const playerVisualState: PlayerVisualState = {
          kind: 'idle',
          payload: {},
          version: 1,
          updatedAt: now,
        };

        let room_rigCues: RoomState['rigCues'] = undefined;
        let rigName: string | null = null;
        let rigSocials: RigSocial[] = [];
        if (payload.rigId) {
          const rig = await getRigById(payload.rigId);
          if (rig) {
            rigName = rig.name || null;
            rigSocials = await getRigSocials(payload.rigId);
            const logoConfig = rig.console_config?.logoConfig;
            const customLogo =
              rig.logo_enabled && rig.logo_asset_path
                ? {
                    url: `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}/storage/v1/object/public/rig-logos/${rig.logo_asset_path}`,
                    opacity: typeof logoConfig?.opacity === 'number' ? logoConfig.opacity : 0.8,
                    position: (logoConfig?.position || 'center') as
                      | 'center'
                      | 'top-left'
                      | 'top-right'
                      | 'bottom-left'
                      | 'bottom-right',
                    effect: (logoConfig?.effect || 'none') as
                      | 'none'
                      | 'pulse'
                      | 'spin'
                      | 'float'
                      | 'neon',
                  }
                : null;
            const logo = resolveSurfaceLogo(customLogo, entitlements, Boolean(rig.logo_enabled));

            // Legacy rigs may still reference removed arts (glow-branded, pulse-grid)
            visualsState.artId = LEGACY_ART_IDS.has(rig.default_visual_art_id || '')
              ? 'audio-shader'
              : rig.default_visual_art_id || 'audio-shader';
            if (rig.palette) {
              visualsState.palette = rig.palette;
            }
            visualsState.logo = logo;
            visualsState.qrConfig = rig.console_config?.qrConfig || null;
            visualsState.displayName = rig.console_config?.displayName || rig.name || 'Glow';

            // Snapshot cue list for live Next/Prev tracking
            if (Array.isArray((rig as any).cues) && (rig as any).cues.length > 0) {
              room_rigCues = (rig as any).cues.map((c: any) => ({
                id: c.id,
                visualArtId: c.visual_art_id,
                sortOrder: c.sort_order,
                params: c.params ?? undefined,
                transition: c.transition ?? undefined,
                label: c.label ?? undefined,
              }));
            }
          }
        }

        const room: RoomState = {
          code,
          sessionId,
          teamId: teamContext.teamId,
          orchestratorUserId: user.id,
          ownerUserId: user.id,
          orchestratorSocketId: socket.id,
          planCode: teamContext.planCode,
          status: 'active',
          createdAt: now,
          lastActivityAt: now,
          closesAt: now + entitlements.maxRoomDurationMinutes * 60 * 1000,
          mode: 'live',
          matrix: { rows, cols, cells: new Map() },
          entitlements,
          devices: new Map(),
          disconnectedPlayers: new Map(),
          totalJoinedDevices: 0,
          peakDevices: 0,
          adsEnabled: entitlements.adsEnabled,
          visualsState,
          playerVisualState,
          cueIndex: 0,
          rigCues: room_rigCues,
          rigName,
          rigSocials,
        };

        rooms.set(code, room);
        socket.join(`orchestrator:${code}`);
        socket.join(`room:${code}`);

        callback({
          roomCode: code,
          sessionId,
          entitlements,
          adsEnabled: entitlements.adsEnabled,
          matrix: { rows, cols },
        });

        emitRoomState(io, room);
      } catch (error) {
        console.error('create_room error', error);
        callback({ error: 'Failed to create room' });
      }
    }
  );

  socket.on(
    'orchestrator:rejoin_room',
    async (payload: { roomCode: string; accessToken?: string }, callback: (response: any) => void) => {
      const roomCode = payload.roomCode.toUpperCase();
      const room = rooms.get(roomCode);
      if (!room) {
        callback({ error: 'Room not found' });
        return;
      }

      if (!payload.accessToken) {
        callback({ error: 'Unauthorized' });
        return;
      }

      const user = await validateAccessToken(payload.accessToken);
      if (!user) {
        callback({ error: 'Unauthorized' });
        return;
      }

      const teamContext = await getTeamContextForUser(user.id);
      const isOwner = user.id === room.ownerUserId || user.id === room.orchestratorUserId;
      const isTeamMember = teamContext?.teamId === room.teamId;

      if (!isOwner && !isTeamMember) {
        callback({ error: 'Forbidden' });
        return;
      }

      await refreshRoomEntitlementsFromTeam(room);

      room.orchestratorSocketId = socket.id;
      room.status = 'active';
      room.reconnectDeadlineAt = undefined;
      room.lastActivityAt = Date.now();
      socket.join(`orchestrator:${roomCode}`);
      socket.join(`room:${roomCode}`);
      callback({ ok: true, state: serializeRoomState(room) });
      emitRoomState(io, room);
    }
  );

  socket.on(
    'orchestrator:close_room',
    async (
      payload: { roomCode: string },
      callback?: (response: { ok: boolean; reason?: string }) => void
    ) => {
      const roomCode = payload.roomCode.toUpperCase();
      const room = rooms.get(roomCode);
      if (!room) {
        callback?.({ ok: false, reason: 'Room not found' });
        return;
      }
      if (room.orchestratorSocketId !== socket.id) {
        callback?.({ ok: false, reason: 'Not the active orchestrator' });
        return;
      }

      await closeRoom(io, room, 'orchestrator_closed');
      callback?.({ ok: true });
    }
  );

  socket.on(
    'player:join_room',
    (
      payload: {
        roomCode: string;
        nickname?: string;
        requestedPosition?: { row: number; col: number };
      },
      callback: (response: unknown) => void
    ) => {
      const room = rooms.get(payload.roomCode.toUpperCase());
      if (!room) {
        callback({ accepted: false, reason: 'Room not found' });
        return;
      }

      if (getActivePlayerCount(room) >= room.entitlements.maxDevices) {
        captureRealtimeEvent(room.ownerUserId, 'plan_limit_hit', {
          roomCode: room.code,
          teamId: room.teamId,
          ownerUserId: room.ownerUserId,
          planCode: room.planCode,
        }, {
          limit_key: 'max_devices',
          device_count: getActivePlayerCount(room),
          max_devices: room.entitlements.maxDevices,
        });

        callback({
          accepted: false,
          reason: 'plan_limit_hit',
          limit: 'max_devices',
          max: room.entitlements.maxDevices,
        });
        return;
      }

      const publicId = generatePublicId();
      const device: PlayerDeviceState = {
        socketId: socket.id,
        publicId,
        nickname: payload.nickname,
        joinedAt: Date.now(),
        lastSeenAt: Date.now(),
        status: 'online',
      };

      if (payload.requestedPosition) {
        const result = assignDevicePosition(
          room,
          device,
          payload.requestedPosition.row,
          payload.requestedPosition.col
        );
        if (!result.ok) {
          callback({ accepted: false, reason: result.reason });
          return;
        }
      }

      room.devices.set(socket.id, device);
      room.totalJoinedDevices += 1;
      room.peakDevices = Math.max(room.peakDevices, room.devices.size);
      room.lastActivityAt = Date.now();

      socket.join(`room:${room.code}`);
      socket.join(`player:${publicId}`);

      callback({
        accepted: true,
        devicePublicId: publicId,
        label: device.label,
        row: device.row,
        col: device.col,
        adsEnabled: room.adsEnabled,
        matrix: { rows: room.matrix.rows, cols: room.matrix.cols },
        serverTime: Date.now(),
        playerVisualState: room.playerVisualState,
        rigName: room.rigName,
        rigSocials: getPublicRigSocials(room),
      });

      // Emit visual state backup
      if (room.playerVisualState && room.playerVisualState.kind !== 'idle') {
        const ev = getPlayerVisualEmitEvent(room.playerVisualState);
        if (ev) {
          socket.emit(ev.name, ev.payload);
        }
      }

      captureRealtimeEvent(room.ownerUserId, 'device_connected', {
        roomCode: room.code,
        teamId: room.teamId,
        ownerUserId: room.ownerUserId,
        planCode: room.planCode,
      }, {
        device_count: room.devices.size,
        peak_device_count: room.peakDevices,
      });

      emitRoomState(io, room);
    }
  );

  socket.on(
    'player:rejoin_room',
    (
      payload: { roomCode: string; devicePublicId: string; nickname?: string },
      callback: (response: unknown) => void
    ) => {
      const room = rooms.get(payload.roomCode.toUpperCase());
      if (!room) {
        callback({ accepted: false, reason: 'Room not found' });
        return;
      }

      const existing = room.disconnectedPlayers.get(payload.devicePublicId);
      if (!existing) {
        callback({ accepted: false, reason: 'Session expired. Join as a new player.' });
        return;
      }

      const graceMs = room.entitlements.priorityReconnectWindowSeconds * 1000;
      if (Date.now() - existing.lastSeenAt > graceMs) {
        clearDevicePosition(room, existing);
        room.disconnectedPlayers.delete(payload.devicePublicId);
        callback({ accepted: false, reason: 'Session expired. Join as a new player.' });
        return;
      }

      room.disconnectedPlayers.delete(payload.devicePublicId);

      const device: PlayerDeviceState = {
        ...existing,
        socketId: socket.id,
        status: 'online',
        lastSeenAt: Date.now(),
        nickname: payload.nickname ?? existing.nickname,
      };

      room.devices.set(socket.id, device);
      room.lastActivityAt = Date.now();

      socket.join(`room:${room.code}`);
      socket.join(`player:${device.publicId}`);

      callback({
        accepted: true,
        reconnected: true,
        devicePublicId: device.publicId,
        label: device.label,
        row: device.row,
        col: device.col,
        matrix: { rows: room.matrix.rows, cols: room.matrix.cols },
        serverTime: Date.now(),
        playerVisualState: room.playerVisualState,
        rigName: room.rigName,
        rigSocials: getPublicRigSocials(room),
      });

      // Emit visual state backup
      if (room.playerVisualState && room.playerVisualState.kind !== 'idle') {
        const ev = getPlayerVisualEmitEvent(room.playerVisualState);
        if (ev) {
          socket.emit(ev.name, ev.payload);
        }
      }

      emitRoomState(io, room);
    }
  );

  socket.on(
    'player:request_position',
    (
      payload: { roomCode: string; row: number; col: number },
      callback: (response: unknown) => void
    ) => {
      const room = rooms.get(payload.roomCode);
      const device = room ? getDeviceBySocketId(room, socket.id) : null;
      if (!room || !device) {
        callback({ ok: false, reason: 'Not in room' });
        return;
      }

      const result = assignDevicePosition(room, device, payload.row, payload.col);
      if (!result.ok) {
        callback({ ok: false, reason: result.reason });
        return;
      }

      socket.emit('device:position_updated', {
        row: device.row,
        col: device.col,
        label: device.label,
      });

      callback({ ok: true, label: device.label, row: device.row, col: device.col });
      emitRoomState(io, room);
    }
  );

  socket.on(
    'player:reaction',
    (payload: { roomCode: string; emoji: ReactionEmoji }) => {
      const roomCode = payload.roomCode?.toUpperCase();
      const room = rooms.get(roomCode);
      const device = room ? getDeviceBySocketId(room, socket.id) : null;
      if (!room || !device) {
        return;
      }

      if (!room.entitlements.audienceReactions) {
        return;
      }

      const isFree = room.entitlements.maxDevices <= 10 && !room.entitlements.advancedMatrix;
      const allowlist = isFree ? REACTION_ALLOWLIST_FREE : REACTION_ALLOWLIST_PAID;
      if (!allowlist.includes(payload.emoji)) {
        return;
      }

      const now = Date.now();
      let timestamps = playerReactionTimestamps.get(socket.id) || [];
      timestamps = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      const limit = isFree ? RATE_LIMIT_FREE : RATE_LIMIT_PAID;
      if (timestamps.length >= limit) {
        return;
      }
      timestamps.push(now);
      playerReactionTimestamps.set(socket.id, timestamps);

      const maxBoost = isFree ? MAX_BOOST_FREE : MAX_BOOST_PAID;
      let boost = 1;
      const prev = playerBoostState.get(socket.id);
      if (prev && prev.lastEmoji === payload.emoji && now - prev.lastTime < BOOST_WINDOW_MS) {
        boost = Math.min(prev.boost + 1, maxBoost);
      }
      playerBoostState.set(socket.id, { lastEmoji: payload.emoji, lastTime: now, boost });

      io.to(`visuals:${room.code}`).emit('visuals:reaction', {
        emoji: payload.emoji,
        nickname: device.nickname,
        boost,
        id: `${Date.now()}-${Math.random()}`,
      });

      room.lastActivityAt = Date.now();
    }
  );

  socket.on(
    'player:poll_vote',
    async (
      payload: { roomCode: string; pollId?: string; optionId?: string },
      callback?: (response: { ok: boolean; reason?: string }) => void
    ) => {
      const roomCode = payload.roomCode?.toUpperCase();
      const room = rooms.get(roomCode);
      const device = room ? getDeviceBySocketId(room, socket.id) : null;
      if (!room || !device) {
        callback?.({ ok: false, reason: 'unauthorized' });
        return;
      }
      await refreshRoomEntitlementsFromTeam(room);
      if (!room.entitlements.pollProductionEnabled) {
        callback?.({ ok: false, reason: 'gated' });
        return;
      }
      callback?.({ ok: false, reason: 'not_implemented' });
    }
  );

  socket.on(
    'orchestrator:assign_position',
    (
      payload: { roomCode: string; devicePublicId: string; row: number; col: number },
      callback?: (response: unknown) => void
    ) => {
      const room = rooms.get(payload.roomCode);
      if (!room || room.orchestratorSocketId !== socket.id) return;

      const device = getDeviceByPublicId(room, payload.devicePublicId);
      if (!device) {
        callback?.({ ok: false, reason: 'Device not found' });
        return;
      }

      const result = assignDevicePosition(room, device, payload.row, payload.col);
      if (!result.ok) {
        callback?.({ ok: false, reason: result.reason });
        return;
      }

      if (device.socketId) {
        io.to(device.socketId).emit('device:position_updated', {
          row: device.row,
          col: device.col,
          label: device.label,
        });
      }

      callback?.({ ok: true });
      emitRoomState(io, room);
    }
  );

  socket.on(
    'orchestrator:identify_device',
    (payload: { roomCode: string; devicePublicId: string }) => {
      const room = rooms.get(payload.roomCode);
      if (!room || room.orchestratorSocketId !== socket.id) return;

      const device = getConnectedDeviceByPublicId(room, payload.devicePublicId);
      if (!device) return;

      io.to(device.socketId).emit('device:identify', {
        label: device.label ?? device.publicId,
      });
    }
  );

  socket.on(
    'orchestrator:set_cell_color',
    (payload: {
      roomCode: string;
      row: number;
      col: number;
      colorHex: string;
      targetTimestamp: number;
    }) => {
      const room = rooms.get(payload.roomCode);
      if (!room || room.orchestratorSocketId !== socket.id) return;

      const publicId = room.matrix.cells.get(cellKey(payload.row, payload.col));
      if (!publicId) return;

      const device = getConnectedDeviceByPublicId(room, publicId);
      if (!device) return;

      io.to(device.socketId).emit('visual:color', {
        colorHex: payload.colorHex,
        targetTimestamp: payload.targetTimestamp,
        row: payload.row,
        col: payload.col,
      });

      room.lastActivityAt = Date.now();
    }
  );

  socket.on(
    'orchestrator:broadcast_color',
    (payload: {
      roomCode: string;
      colorHex: string;
      targetTimestamp: number;
    }) => {
      const room = rooms.get(payload.roomCode);
      if (!room || room.orchestratorSocketId !== socket.id) return;

      const statePayload = {
        colorHex: payload.colorHex,
        targetTimestamp: payload.targetTimestamp,
      };
      updatePlayerVisualState(room, 'color', statePayload);

      for (const device of room.devices.values()) {
        io.to(device.socketId).emit('visual:color', statePayload);
      }

      room.lastActivityAt = Date.now();
    }
  );

  socket.on(
    'orchestrator:send_matrix_frame',
    (payload: {
      roomCode: string;
      targetTimestamp: number;
      cells: Array<{ row: number; col: number; colorHex: string }>;
    }) => {
      const room = rooms.get(payload.roomCode);
      if (!room || room.orchestratorSocketId !== socket.id) return;

      for (const cell of payload.cells) {
        const publicId = room.matrix.cells.get(cellKey(cell.row, cell.col));
        if (!publicId) continue;

        const device = getConnectedDeviceByPublicId(room, publicId);
        if (!device) continue;

        io.to(device.socketId).emit('visual:color', {
          colorHex: cell.colorHex,
          targetTimestamp: payload.targetTimestamp,
          row: cell.row,
          col: cell.col,
        });
      }

      room.lastActivityAt = Date.now();
    }
  );

  socket.on(
    'orchestrator:run_preset',
    (payload: {
      roomCode: string;
      presetId: string;
      seedTimestamp: number;
      targetTimestamp: number;
      params?: PresetParams;
    }) => {
      const room = rooms.get(payload.roomCode);
      if (!room || room.orchestratorSocketId !== socket.id) return;

      if (!isValidPresetId(payload.presetId)) return;
      if (!room.entitlements.availablePresets.includes(payload.presetId)) return;
      if (payload.presetId === 'audio' && !room.entitlements.audioReactive) return;

      const statePayload = {
        presetId: payload.presetId,
        seedTimestamp: payload.seedTimestamp,
        targetTimestamp: payload.targetTimestamp,
        matrix: { rows: room.matrix.rows, cols: room.matrix.cols },
        params: payload.params,
      };
      updatePlayerVisualState(room, 'preset', statePayload);

      io.to(`room:${room.code}`).emit('visual:preset', statePayload);

      room.lastActivityAt = Date.now();
    }
  );

  socket.on(
    'orchestrator:run_stack',
    (payload: {
      roomCode: string;
      layers: EffectLayer[];
      seedTimestamp: number;
      targetTimestamp: number;
    }) => {
      const room = rooms.get(payload.roomCode);
      if (!room || room.orchestratorSocketId !== socket.id) return;
      if (!Array.isArray(payload.layers) || payload.layers.length === 0) return;
      if (payload.layers.length > 1 && !room.entitlements.effectLayering) return;

      for (const layer of payload.layers) {
        if (!isValidPresetId(layer.presetId)) return;
        if (!room.entitlements.availablePresets.includes(layer.presetId)) return;
        if (layer.presetId === 'audio' && !room.entitlements.audioReactive) return;
        if (typeof layer.opacity !== 'number' || layer.opacity < 0 || layer.opacity > 1) return;
        if (
          layer.blend !== 'normal' &&
          layer.blend !== 'add' &&
          layer.blend !== 'screen' &&
          layer.blend !== 'multiply'
        ) {
          return;
        }
      }

      const matrix = { rows: room.matrix.rows, cols: room.matrix.cols };

      if (payload.layers.length === 1) {
        const layer = payload.layers[0]!;
        const statePayload = {
          presetId: layer.presetId,
          seedTimestamp: payload.seedTimestamp,
          targetTimestamp: payload.targetTimestamp,
          matrix,
          params: layer.params,
        };
        updatePlayerVisualState(room, 'preset', statePayload);
        io.to(`room:${room.code}`).emit('visual:preset', statePayload);
      } else {
        const statePayload = {
          effects: payload.layers.map(l => ({ presetId: l.presetId, params: l.params })),
          seedTimestamp: payload.seedTimestamp,
          targetTimestamp: payload.targetTimestamp,
          matrix,
        };
        updatePlayerVisualState(room, 'distribution', statePayload);
        io.to(`room:${room.code}`).emit('visual:effect_stack', {
          layers: payload.layers,
          seedTimestamp: payload.seedTimestamp,
          targetTimestamp: payload.targetTimestamp,
          matrix,
        });
      }

      room.lastActivityAt = Date.now();
    }
  );

  socket.on(
    'orchestrator:run_distribution',
    (payload: {
      roomCode: string;
      effects: EffectDistribution['effects'];
      seedTimestamp: number;
      targetTimestamp: number;
    }) => {
      const room = rooms.get(payload.roomCode);
      if (!room || room.orchestratorSocketId !== socket.id) return;
      if (!Array.isArray(payload.effects) || payload.effects.length === 0) return;
      if (payload.effects.length > 1 && !room.entitlements.effectLayering) return;
      if (!validateDistributionWeights(payload.effects)) return;

      for (const effect of payload.effects) {
        if (!isValidPresetId(effect.presetId)) return;
        if (!room.entitlements.availablePresets.includes(effect.presetId)) return;
        if (effect.presetId === 'audio' && !room.entitlements.audioReactive) return;
      }

      const matrix = { rows: room.matrix.rows, cols: room.matrix.cols };

      if (payload.effects.length === 1) {
        const effect = payload.effects[0]!;
        const statePayload = {
          presetId: effect.presetId,
          seedTimestamp: payload.seedTimestamp,
          targetTimestamp: payload.targetTimestamp,
          matrix,
          params: effect.params,
        };
        updatePlayerVisualState(room, 'preset', statePayload);
        io.to(`room:${room.code}`).emit('visual:preset', statePayload);
      } else {
        const statePayload = {
          effects: payload.effects,
          seedTimestamp: payload.seedTimestamp,
          targetTimestamp: payload.targetTimestamp,
          matrix,
        };
        updatePlayerVisualState(room, 'distribution', statePayload);
        io.to(`room:${room.code}`).emit('visual:effect_distribution', statePayload);
      }

      room.lastActivityAt = Date.now();
    }
  );

  socket.on(
    'orchestrator:audio_features',
    (payload: { roomCode: string; features: AudioFeatures; timestamp: number }) => {
      const room = rooms.get(payload.roomCode);
      if (!room || room.orchestratorSocketId !== socket.id) return;
      if (!room.entitlements.audioReactive) return;

      io.to(`room:${room.code}`).emit('visual:audio_features', {
        features: payload.features,
        timestamp: payload.timestamp,
      });

      // Also forward to the visuals surface topic
      io.to(`visuals:${room.code}`).emit('visuals:audio_features', {
        features: payload.features,
        timestamp: payload.timestamp,
      });

      room.lastActivityAt = Date.now();
    }
  );

  socket.on(
    'orchestrator:media_image',
    (payload: {
      roomCode: string;
      url: string;
      target: DeviceTarget;
      fit?: 'cover' | 'contain';
      durationMs?: number;
    }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      if (!room || room.orchestratorSocketId !== socket.id) return;
      if (!room.entitlements.customMediaUpload) return;

      const socketIds = resolveTargetSockets(room, payload.target);
      const eventPayload: VisualMediaEvent = {
        kind: 'image',
        url: payload.url,
        fit: payload.fit ?? 'cover',
        durationMs: payload.durationMs,
        timestamp: Date.now(),
      };

      for (const sid of socketIds) {
        io.to(sid).emit('visual:media', eventPayload);
      }
      room.lastActivityAt = Date.now();
    }
  );

  socket.on(
    'orchestrator:media_text',
    (payload: {
      roomCode: string;
      text: string;
      mode: 'marquee' | 'word_by_word' | 'spread_grid';
      speed: number;
      colorHex?: string;
      loop: boolean;
      fontSize?: number;
      target: DeviceTarget;
    }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      if (!room || room.orchestratorSocketId !== socket.id) return;
      if (!room.entitlements.sequencedText) return;

      const socketIds = resolveTargetSockets(room, payload.target);
      const eventPayload: VisualMediaEvent = {
        kind: 'text',
        text: payload.text,
        mode: payload.mode,
        speed: payload.speed,
        colorHex: payload.colorHex,
        loop: payload.loop,
        fontSize: payload.fontSize,
        timestamp: Date.now(),
      };

      for (const sid of socketIds) {
        io.to(sid).emit('visual:media', eventPayload);
      }
      room.lastActivityAt = Date.now();
    }
  );

  socket.on(
    'orchestrator:media_gif',
    (payload: {
      roomCode: string;
      slug: string;
      url: string;
      width: number;
      height: number;
      target: DeviceTarget;
    }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      if (!room || room.orchestratorSocketId !== socket.id) return;
      if (!room.entitlements.gifBroadcast) return;

      const socketIds = resolveTargetSockets(room, payload.target);
      const eventPayload: VisualMediaEvent = {
        kind: 'gif',
        url: payload.url,
        timestamp: Date.now(),
      };

      for (const sid of socketIds) {
        io.to(sid).emit('visual:media', eventPayload);
      }
      room.lastActivityAt = Date.now();
    }
  );

  socket.on(
    'orchestrator:media_clear',
    (payload: {
      roomCode: string;
      target: DeviceTarget;
    }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      if (!room || room.orchestratorSocketId !== socket.id) return;

      const socketIds = resolveTargetSockets(room, payload.target);
      for (const sid of socketIds) {
        io.to(sid).emit('visual:media_clear');
      }
      room.lastActivityAt = Date.now();
    }
  );

  socket.on(
    'orchestrator:set_fallback_mode',
    (payload: { roomCode: string; enabled: boolean; seedTimestamp: number }) => {
      const room = rooms.get(payload.roomCode);
      if (!room || room.orchestratorSocketId !== socket.id) return;
      if (!room.entitlements.manualFallbackMode) return;

      room.mode = payload.enabled ? 'fallback' : 'live';
      room.fallbackSeed = payload.seedTimestamp;

      const statePayload = {
        enabled: payload.enabled,
        seedTimestamp: payload.seedTimestamp,
        roomCode: room.code,
      };
      updatePlayerVisualState(room, 'fallback', statePayload);

      io.to(`room:${room.code}`).emit('fallback:mode_changed', statePayload);
    }
  );

  socket.on(
    'player:torch_capability',
    (payload: { roomCode: string; supported: boolean; enabled: boolean }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      if (!room) return;

      const device = room.devices.get(socket.id);
      if (!device) return;

      const capability: TorchCapability = {
        supported: Boolean(payload.supported),
        enabled: Boolean(payload.enabled),
      };
      device.torchCapability = capability;
      device.lastSeenAt = Date.now();
      room.lastActivityAt = Date.now();
      emitRoomState(io, room);
    }
  );

  socket.on(
    'orchestrator:set_torch',
    (payload: {
      roomCode: string;
      target: DeviceTarget;
      command: TorchCommand;
      targetTimestamp: number;
    }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      if (!room || room.orchestratorSocketId !== socket.id) return;
      if (!room.entitlements.deviceFlashControl) return;
      if (!payload.command || typeof payload.targetTimestamp !== 'number') return;

      const socketIds = resolveTargetSockets(room, payload.target);
      const eventPayload = {
        command: payload.command,
        targetTimestamp: payload.targetTimestamp,
      };

      for (const sid of socketIds) {
        io.to(sid).emit('device:torch', eventPayload);
      }
      room.lastActivityAt = Date.now();
    }
  );

  socket.on('latency:ping', (payload: { sentAt: number }) => {
    socket.emit('latency:pong', { sentAt: payload.sentAt, serverTime: Date.now() });
  });

  // ── Visuals surface: subscribe ──────────────────────────────────────────────
  socket.on(
    'visuals:subscribe',
    (
      payload: { roomCode: string; token: string },
      callback?: (response: {
        ok: boolean;
        sessionId?: string;
        reason?: string;
        matrix?: { rows: number; cols: number };
        visualsState?: VisualsState;
      }) => void,
    ) => {
      const roomCode = payload.roomCode?.toUpperCase();
      const room = rooms.get(roomCode);

      if (!room) {
        callback?.({ ok: false, reason: 'room_not_found' });
        return;
      }

      // Verify token
      const verified = verifyVisualsToken(payload.token, roomCode);
      if (!verified) {
        callback?.({ ok: false, reason: 'token_invalid_or_expired' });
        return;
      }

      socket.join(`visuals:${roomCode}`);
      callback?.({
        ok: true,
        sessionId: room.sessionId,
        matrix: { rows: room.matrix.rows, cols: room.matrix.cols },
        visualsState: room.visualsState,
      });

      // Replay visualsState to the newly joined surface as backup
      socket.emit('visuals:scene', room.visualsState);

      // Replay active live-call layout
      if (room.liveCall?.active && room.liveCall.tiles.length > 0) {
        socket.emit('visuals:live_layout', {
          tiles: room.liveCall.tiles,
          callId: room.liveCall.callId,
        });
        // Ask live publishers to re-offer so a late-joining surface can connect
        for (const pub of room.liveCall.publishers.values()) {
          if (pub.status === 'live') {
            emitSurfaceReconnect(io, room, pub.publicId);
          }
        }
      }
    }
  );

  // ── Resync events ────────────────────────────────────────────────────────
  socket.on(
    'visuals:resync',
    (payload: { roomCode: string }, callback?: (response: { ok: boolean; visualsState?: VisualsState; reason?: string }) => void) => {
      const roomCode = payload.roomCode?.toUpperCase();
      const room = rooms.get(roomCode);
      if (!room) {
        callback?.({ ok: false, reason: 'room_not_found' });
        return;
      }
      callback?.({ ok: true, visualsState: room.visualsState });
    }
  );

  socket.on(
    'player:resync',
    (payload: { roomCode: string }, callback?: (response: { ok: boolean; playerVisualState?: PlayerVisualState; reason?: string }) => void) => {
      const roomCode = payload.roomCode?.toUpperCase();
      const room = rooms.get(roomCode);
      if (!room) {
        callback?.({ ok: false, reason: 'room_not_found' });
        return;
      }
      callback?.({ ok: true, playerVisualState: room.playerVisualState });
    }
  );

  // ── WebRTC live-call ───────────────────────────────────────────────────────

  socket.on(
    'orchestrator:live_call_start',
    async (
      payload: { roomCode: string; publisherIds: string[]; withAudio?: boolean },
      callback?: (response: { ok: boolean; reason?: string; callId?: string }) => void
    ) => {
      const roomCode = payload.roomCode?.toUpperCase();
      const room = rooms.get(roomCode);
      if (!room || room.orchestratorSocketId !== socket.id) {
        callback?.({ ok: false, reason: 'unauthorized' });
        return;
      }
      await refreshRoomEntitlementsFromTeam(room);
      if (!room.entitlements.webrtcLiveCall || room.entitlements.liveCallTestModeOnly) {
        callback?.({ ok: false, reason: 'gated' });
        return;
      }

      const publisherIds = Array.isArray(payload.publisherIds)
        ? [...new Set(payload.publisherIds.filter((id) => typeof id === 'string' && id.length > 0))]
        : [];

      if (publisherIds.length === 0) {
        callback?.({ ok: false, reason: 'no_publishers' });
        return;
      }
      if (publisherIds.length > room.entitlements.maxLiveCallDevices) {
        callback?.({ ok: false, reason: 'over_cap' });
        return;
      }

      if (room.liveCall?.active) {
        stopLivePublishers(io, room);
      }

      const callId = generateCallId();
      const publishers = new Map<string, { publicId: string; status: 'requested' | 'live' | 'declined' }>();

      for (const publicId of publisherIds) {
        const device = getConnectedDeviceByPublicId(room, publicId);
        if (!device) continue;
        publishers.set(publicId, { publicId, status: 'requested' });
        io.to(`player:${publicId}`).emit('webrtc:publish_request', {
          callId,
          withAudio: Boolean(payload.withAudio),
        });
      }

      if (publishers.size === 0) {
        callback?.({ ok: false, reason: 'no_connected_publishers' });
        return;
      }

      const livePublisherIds = Array.from(publishers.keys());
      room.liveCall = {
        callId,
        active: true,
        publishers,
        tiles: defaultTilesForPublishers(livePublisherIds),
      };

      broadcastLiveLayout(io, room);
      emitLiveCallState(io, room);
      room.lastActivityAt = Date.now();
      callback?.({ ok: true, callId });
    }
  );

  socket.on(
    'orchestrator:live_call_stop',
    (payload: { roomCode: string; publisherIds?: string[] }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      if (!room || room.orchestratorSocketId !== socket.id) return;
      if (!room.entitlements.webrtcLiveCall) return;
      stopLivePublishers(io, room, payload.publisherIds);
      room.lastActivityAt = Date.now();
    }
  );

  socket.on(
    'orchestrator:live_layout',
    (payload: { roomCode: string; tiles: LiveTile[] }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      if (!room || room.orchestratorSocketId !== socket.id) return;
      if (!room.entitlements.webrtcLiveCall) return;
      if (!room.liveCall?.active) return;
      if (!Array.isArray(payload.tiles)) return;

      room.liveCall.tiles = payload.tiles.filter(
        (t) =>
          typeof t.publicId === 'string' &&
          typeof t.x === 'number' &&
          typeof t.y === 'number' &&
          typeof t.w === 'number' &&
          typeof t.h === 'number' &&
          typeof t.z === 'number'
      );
      broadcastLiveLayout(io, room);
      room.lastActivityAt = Date.now();
    }
  );

  socket.on(
    'orchestrator:get_live_call_state',
    (
      payload: { roomCode: string },
      callback?: (response: LiveCallStatePayload | null) => void
    ) => {
      const roomCode = payload.roomCode?.toUpperCase();
      const room = rooms.get(roomCode);
      if (!room || room.orchestratorSocketId !== socket.id) {
        callback?.(null);
        return;
      }
      if (!room.liveCall) {
        callback?.(null);
        return;
      }
      callback?.(serializeLiveCallState(room.liveCall));
    }
  );

  socket.on(
    'webrtc:signal',
    (payload: { callId: string; from: string; to: string; signal: WebrtcSignal }) => {
      let room: RoomState | undefined;
      for (const r of rooms.values()) {
        if (r.liveCall?.active && r.liveCall.callId === payload.callId) {
          room = r;
          break;
        }
      }
      if (!room) return;

      const isVisualsSender = socket.rooms.has(`visuals:${room.code}`);
      const senderDevice = getDeviceBySocketId(room, socket.id);

      if (isVisualsSender) {
        if (payload.from !== VISUALS_VIEWER_ID) return;
      } else if (!senderDevice || senderDevice.publicId !== payload.from) {
        return;
      }

      const signalPayload = {
        callId: payload.callId,
        from: payload.from,
        to: payload.to,
        signal: payload.signal,
      };

      if (payload.to === VISUALS_VIEWER_ID) {
        io.to(`visuals:${room.code}`).emit('webrtc:signal', signalPayload);
        return;
      }

      if (room.liveCall?.publishers.has(payload.to)) {
        io.to(`player:${payload.to}`).emit('webrtc:signal', signalPayload);
      }
    }
  );

  socket.on(
    'webrtc:publish_ready',
    (payload: { roomCode: string; callId: string }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      const device = room ? getDeviceBySocketId(room, socket.id) : null;
      if (!room || !device || !room.liveCall?.active) return;
      if (room.liveCall.callId !== payload.callId) return;

      const pub = room.liveCall.publishers.get(device.publicId);
      if (!pub || pub.status === 'declined') return;

      pub.status = 'live';
      syncLiveTiles(room);
      broadcastLiveLayout(io, room);
      emitLiveCallState(io, room);
      room.lastActivityAt = Date.now();
    }
  );

  socket.on(
    'player:live_decline',
    (payload: { roomCode: string; callId: string }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      const device = room ? getDeviceBySocketId(room, socket.id) : null;
      if (!room || !device || !room.liveCall?.active) return;
      if (room.liveCall.callId !== payload.callId) return;

      const pub = room.liveCall.publishers.get(device.publicId);
      if (!pub) return;

      pub.status = 'declined';
      room.liveCall.tiles = room.liveCall.tiles.filter((t) => t.publicId !== device.publicId);

      if (room.liveCall.publishers.size === 0) {
        room.liveCall.active = false;
      } else {
        syncLiveTiles(room);
        broadcastLiveLayout(io, room);
      }
      emitLiveCallState(io, room);
      room.lastActivityAt = Date.now();
    }
  );

  socket.on(
    'player:live_stop',
    (payload: { roomCode: string; callId: string }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      const device = room ? getDeviceBySocketId(room, socket.id) : null;
      if (!room || !device || !room.liveCall?.active) return;
      if (room.liveCall.callId !== payload.callId) return;

      room.liveCall.publishers.delete(device.publicId);
      if (room.liveCall.publishers.size === 0) {
        room.liveCall.active = false;
        room.liveCall.tiles = [];
        io.to(`visuals:${room.code}`).emit('visuals:live_layout', {
          tiles: [],
          callId: room.liveCall.callId,
        });
      } else {
        syncLiveTiles(room);
        broadcastLiveLayout(io, room);
      }
      emitLiveCallState(io, room);
      room.lastActivityAt = Date.now();
    }
  );

  // ── Visuals surface: set mode (standard | youtube | custom-video | 3d | pptt) ──
  socket.on(
    'orchestrator:visuals_set_mode',
    async (
      payload: { roomCode: string; mode: VisualsState['mode'] },
      callback?: (response: { ok: boolean; reason?: string }) => void
    ) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      if (!room || room.orchestratorSocketId !== socket.id) {
        callback?.({ ok: false, reason: 'unauthorized' });
        return;
      }
      if (!VISUALS_MODES.has(payload.mode)) {
        callback?.({ ok: false, reason: 'invalid_mode' });
        return;
      }
      await refreshRoomEntitlementsFromTeam(room);
      if (!room.entitlements.visualsSurface) {
        callback?.({ ok: false, reason: 'gated' });
        return;
      }

      const emitCheck = canEmitVisualsMode(
        room.entitlements,
        room.visualsEmittedCounts,
        payload.mode
      );
      if (!emitCheck.allowed) {
        callback?.({ ok: false, reason: emitCheck.reason ?? 'visuals_emit_limit' });
        return;
      }

      const updatedState = updateVisualsState(room, { mode: payload.mode });
      room.visualsEmittedCounts = recordVisualsEmit(room.visualsEmittedCounts, payload.mode);

      io.to(`visuals:${room.code}`).emit('visuals:mode', { mode: updatedState.mode });
      room.lastActivityAt = Date.now();
      callback?.({ ok: true });
    }
  );

  // ── Visuals surface: YouTube mode controls ────────────────────────────────
  const YT_TRANSITION_EFFECTS = new Set(['glitch', 'dip-black', 'pixel-melt']);
  const YT_DEFAULT_TRANSITION: YoutubeTransitionEffect = 'dip-black';

  const YT_DEFAULT = {
    videoId: null as string | null,
    queue: [] as YoutubeQueueItem[],
    queueIndex: 0,
    playing: false,
    muted: true,
    volume: 80,
    seekToSec: null as number | null,
    pendingTransition: null as YoutubeTransitionEffect | null,
  };

  /** First transition item between two queue positions (used when jumping). */
  function transitionBetween(queue: YoutubeQueueItem[], from: number, to: number): YoutubeTransitionEffect {
    const [lo, hi] = from < to ? [from, to] : [to, from];
    for (let i = lo + 1; i < hi; i++) {
      const item = queue[i];
      if (item?.kind === 'transition') return item.effect;
    }
    return YT_DEFAULT_TRANSITION;
  }

  async function withYoutubeRoom(
    roomCode: string | undefined,
    fn: (room: RoomState, yt: NonNullable<VisualsState['youtube']>) => Partial<NonNullable<VisualsState['youtube']>> | null,
  ) {
    const room = rooms.get(roomCode?.toUpperCase() ?? '');
    if (!room || room.orchestratorSocketId !== socket.id) return;
    await refreshRoomEntitlementsFromTeam(room);
    if (!room.entitlements.visualsSurface) return;

    const current = room.visualsState.youtube ?? { ...YT_DEFAULT, updatedAt: Date.now() };
    const patch = fn(room, current);
    if (!patch) return;
    // seekToSec and pendingTransition are one-shot commands: they reset on
    // every update unless the patch sets them, so the surface never replays
    // a stale seek/transition when unrelated state (volume, queue…) changes.
    const youtube = { ...current, seekToSec: null, pendingTransition: null, ...patch, updatedAt: Date.now() };
    const updatedState = updateVisualsState(room, { youtube });
    io.to(`visuals:${room.code}`).emit('visuals:youtube', { youtube: updatedState.youtube });
    // The desk mirrors the authoritative queue state too
    if (room.orchestratorSocketId) {
      io.to(room.orchestratorSocketId).emit('visuals:youtube', { youtube: updatedState.youtube });
    }
    room.lastActivityAt = Date.now();
  }

  socket.on(
    'orchestrator:visuals_youtube_load',
    (payload: { roomCode: string; videoId: string; title?: string; thumbnail?: string }) => {
      if (typeof payload.videoId !== 'string' || !/^[\w-]{6,16}$/.test(payload.videoId)) return;
      void withYoutubeRoom(payload.roomCode, (_room, yt) => {
        const inQueue = yt.queue.findIndex((q) => q.kind === 'video' && q.videoId === payload.videoId);
        if (inQueue !== -1) {
          return {
            videoId: payload.videoId,
            queueIndex: inQueue,
            playing: true,
            seekToSec: null,
            pendingTransition: yt.videoId ? transitionBetween(yt.queue, yt.queueIndex, inQueue) : null,
          };
        }
        // New video: insert a default transition between the last video and this one
        const queue = [...yt.queue];
        const hasVideos = queue.some((q) => q.kind === 'video');
        if (hasVideos) queue.push({ kind: 'transition', effect: YT_DEFAULT_TRANSITION });
        queue.push({
          kind: 'video',
          videoId: payload.videoId,
          title: typeof payload.title === 'string' ? payload.title.slice(0, 200) : undefined,
          thumbnail: typeof payload.thumbnail === 'string' ? payload.thumbnail.slice(0, 500) : undefined,
        });
        return {
          videoId: payload.videoId,
          queue,
          queueIndex: queue.length - 1,
          playing: true,
          seekToSec: null,
          pendingTransition: yt.videoId ? YT_DEFAULT_TRANSITION : null,
        };
      });
    }
  );

  socket.on('orchestrator:visuals_youtube_play', (payload: { roomCode: string }) => {
    void withYoutubeRoom(payload.roomCode, () => ({ playing: true }));
  });

  socket.on('orchestrator:visuals_youtube_pause', (payload: { roomCode: string }) => {
    void withYoutubeRoom(payload.roomCode, () => ({ playing: false }));
  });

  socket.on('orchestrator:visuals_youtube_set_volume', (payload: { roomCode: string; volume?: number; muted?: boolean }) => {
    void withYoutubeRoom(payload.roomCode, (_room, yt) => ({
      volume: typeof payload.volume === 'number' ? Math.max(0, Math.min(100, payload.volume)) : yt.volume,
      muted: typeof payload.muted === 'boolean' ? payload.muted : yt.muted,
    }));
  });

  socket.on('orchestrator:visuals_youtube_seek', (payload: { roomCode: string; sec: number }) => {
    if (typeof payload.sec !== 'number' || payload.sec < 0) return;
    void withYoutubeRoom(payload.roomCode, () => ({ seekToSec: payload.sec }));
  });

  socket.on('orchestrator:visuals_youtube_queue_jump', (payload: { roomCode: string; index: number; seekSec?: number }) => {
    void withYoutubeRoom(payload.roomCode, (_room, yt) => {
      const item = yt.queue[payload.index];
      if (!item || item.kind !== 'video') return null;
      return {
        queueIndex: payload.index,
        videoId: item.videoId,
        playing: true,
        seekToSec: typeof payload.seekSec === 'number' && payload.seekSec >= 0 ? payload.seekSec : null,
        pendingTransition: yt.videoId ? transitionBetween(yt.queue, yt.queueIndex, payload.index) : null,
      };
    });
  });

  socket.on('orchestrator:visuals_youtube_queue_move', (payload: { roomCode: string; from: number; to: number }) => {
    void withYoutubeRoom(payload.roomCode, (_room, yt) => {
      const { from, to } = payload;
      if (
        typeof from !== 'number' || typeof to !== 'number' ||
        from === to || !yt.queue[from] || to < 0 || to >= yt.queue.length
      ) return null;
      const queue = [...yt.queue];
      const [moved] = queue.splice(from, 1);
      queue.splice(to, 0, moved!);
      // Keep queueIndex pointing at the same playing video
      let queueIndex = yt.queueIndex;
      if (from === yt.queueIndex) queueIndex = to;
      else {
        if (from < yt.queueIndex) queueIndex--;
        if (to <= queueIndex) queueIndex++;
      }
      return { queue, queueIndex };
    });
  });

  socket.on('orchestrator:visuals_youtube_queue_remove', (payload: { roomCode: string; index: number }) => {
    void withYoutubeRoom(payload.roomCode, (_room, yt) => {
      if (!yt.queue[payload.index] || payload.index === yt.queueIndex) return null;
      const queue = yt.queue.filter((_, i) => i !== payload.index);
      const queueIndex = payload.index < yt.queueIndex ? yt.queueIndex - 1 : yt.queueIndex;
      return { queue, queueIndex };
    });
  });

  socket.on('orchestrator:visuals_youtube_set_transition', (payload: { roomCode: string; index: number; effect: string }) => {
    if (!YT_TRANSITION_EFFECTS.has(payload.effect)) return;
    void withYoutubeRoom(payload.roomCode, (_room, yt) => {
      const item = yt.queue[payload.index];
      if (!item || item.kind !== 'transition') return null;
      const queue = [...yt.queue];
      queue[payload.index] = { kind: 'transition', effect: payload.effect as YoutubeTransitionEffect };
      return { queue };
    });
  });

  // Surface → desk: playback position/duration relay (drives the desk seek slider)
  socket.on('visuals:youtube_status', (payload: { roomCode: string; currentTime: number; duration: number }) => {
    const room = rooms.get(payload.roomCode?.toUpperCase() ?? '');
    if (!room || !room.orchestratorSocketId) return;
    if (typeof payload.currentTime !== 'number' || typeof payload.duration !== 'number') return;
    io.to(room.orchestratorSocketId).emit('visuals:youtube_status', {
      currentTime: payload.currentTime,
      duration: payload.duration,
    });
  });

  // Surface → server: video finished → auto-advance to the next queued video
  socket.on('visuals:youtube_ended', (payload: { roomCode: string; videoId: string }) => {
    const room = rooms.get(payload.roomCode?.toUpperCase() ?? '');
    if (!room) return;
    const yt = room.visualsState.youtube;
    // Guard against stale/duplicate ended events (only the playing video counts)
    if (!yt || yt.videoId !== payload.videoId) return;

    let nextIndex = -1;
    for (let i = yt.queueIndex + 1; i < yt.queue.length; i++) {
      if (yt.queue[i]?.kind === 'video') { nextIndex = i; break; }
    }

    const youtube = nextIndex === -1
      ? { ...yt, playing: false, seekToSec: null, pendingTransition: null, updatedAt: Date.now() }
      : {
          ...yt,
          queueIndex: nextIndex,
          videoId: (yt.queue[nextIndex] as { videoId: string }).videoId,
          playing: true,
          seekToSec: null,
          pendingTransition: transitionBetween(yt.queue, yt.queueIndex, nextIndex),
          updatedAt: Date.now(),
        };
    const updatedState = updateVisualsState(room, { youtube });
    io.to(`visuals:${room.code}`).emit('visuals:youtube', { youtube: updatedState.youtube });
    if (room.orchestratorSocketId) {
      io.to(room.orchestratorSocketId).emit('visuals:youtube', { youtube: updatedState.youtube });
    }
    room.lastActivityAt = Date.now();
  });

  // ── Visuals surface: 3D mode controls ─────────────────────────────────────
  socket.on('orchestrator:visuals_3d_set_energy', async (payload: { roomCode: string; level: number }) => {
    const room = rooms.get(payload.roomCode?.toUpperCase());
    if (!room || room.orchestratorSocketId !== socket.id) return;
    if (typeof payload.level !== 'number') return;
    await refreshRoomEntitlementsFromTeam(room);
    if (!room.entitlements.visualsSurface) return;

    const energy = Math.max(0, Math.min(5, Math.round(payload.level)));
    const updatedState = updateVisualsState(room, {
      threeD: { assetId: 'energy-orb', energy, updatedAt: Date.now() },
    });
    io.to(`visuals:${room.code}`).emit('visuals:3d', { kind: 'energy', level: energy, threeD: updatedState.threeD });
    room.lastActivityAt = Date.now();
  });

  socket.on('orchestrator:visuals_3d_trigger_action', async (payload: { roomCode: string; action: string }) => {
    const room = rooms.get(payload.roomCode?.toUpperCase());
    if (!room || room.orchestratorSocketId !== socket.id) return;
    if (payload.action !== 'shockwave' && payload.action !== 'burst') return;
    await refreshRoomEntitlementsFromTeam(room);
    if (!room.entitlements.visualsSurface) return;

    // One-shot — broadcast without persisting in state
    io.to(`visuals:${room.code}`).emit('visuals:3d', { kind: 'action', action: payload.action });
    room.lastActivityAt = Date.now();
  });

  // ── Visuals surface: set scene ─────────────────────────────────────────────
  socket.on(
    'orchestrator:visuals_set_scene',
    async (payload: {
      roomCode: string;
      artId: string;
      params?: Record<string, unknown>;
      palette?: string[];
      logo?: {
        url: string;
        opacity: number;
        position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
        effect?: 'none' | 'pulse' | 'spin' | 'float' | 'neon';
      } | null;
      transition?: 'cut' | 'fade';
    }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      if (!room || room.orchestratorSocketId !== socket.id) return;
      await refreshRoomEntitlementsFromTeam(room);
      if (!room.entitlements.visualsSurface) return;
      if (!room.entitlements.availableVisualArts.includes(payload.artId)) return;

      const sceneUpdates: Partial<VisualsState> = {
        artId: payload.artId,
        params: payload.params,
        logo: payload.logo,
        transition: payload.transition ?? 'cut',
      };
      if (payload.palette) {
        sceneUpdates.palette = payload.palette;
      }
      const updatedState = updateVisualsState(room, sceneUpdates);

      io.to(`visuals:${room.code}`).emit('visuals:scene', updatedState);
      room.lastActivityAt = Date.now();
    }
  );

  // ── Visuals surface: set palette ───────────────────────────────────────────
  socket.on(
    'orchestrator:visuals_set_palette',
    async (payload: { roomCode: string; palette: string[] }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      if (!room || room.orchestratorSocketId !== socket.id) return;
      await refreshRoomEntitlementsFromTeam(room);
      if (!room.entitlements.visualsSurface) return;

      const updatedState = updateVisualsState(room, { palette: payload.palette });

      io.to(`visuals:${room.code}`).emit('visuals:palette', { palette: payload.palette });

      room.lastActivityAt = Date.now();
    }
  );

  // ── Visuals surface: set logo ──────────────────────────────────────────────
  socket.on(
    'orchestrator:visuals_set_logo',
    async (payload: {
      roomCode: string;
      logo: {
        url: string;
        opacity: number;
        position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
        effect?: 'none' | 'pulse' | 'spin' | 'float' | 'neon';
      } | null;
    }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      if (!room || room.orchestratorSocketId !== socket.id) return;
      await refreshRoomEntitlementsFromTeam(room);
      if (!room.entitlements.visualsSurface) return;

      const logo = payload.logo
        ? resolveSurfaceLogo(payload.logo, room.entitlements, true) ?? buildDefaultGlowSurfaceLogo()
        : null;
      const updatedState = updateVisualsState(room, { logo });

      io.to(`visuals:${room.code}`).emit('visuals:logo', { logo });

      room.lastActivityAt = Date.now();
    }
  );
  // ── Visuals surface: set display (displayName + logo) ──────────────────────
  socket.on(
    'orchestrator:visuals_set_display',
    async (payload: {
      roomCode: string;
      displayName?: string;
      logo?: {
        url: string;
        opacity: number;
        position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
        effect?: 'none' | 'pulse' | 'spin' | 'float' | 'neon';
      } | null;
    }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      if (!room || room.orchestratorSocketId !== socket.id) return;
      await refreshRoomEntitlementsFromTeam(room);
      if (!room.entitlements.visualsSurface) return;

      const updates: Partial<VisualsState> = {};
      if (payload.displayName !== undefined) {
        updates.displayName = payload.displayName;
      }
      if (payload.logo !== undefined) {
        updates.logo = payload.logo
          ? resolveSurfaceLogo(payload.logo, room.entitlements, true) ?? buildDefaultGlowSurfaceLogo()
          : null;
      }

      if (Object.keys(updates).length > 0) {
        const updatedState = updateVisualsState(room, updates);
        io.to(`visuals:${room.code}`).emit('visuals:scene', updatedState);
      }

      room.lastActivityAt = Date.now();
    }
  );

  // ── Visuals surface: set text overlay ──────────────────────────────────────
  socket.on(
    'orchestrator:visuals_set_text',
    async (payload: {
      roomCode: string;
      text: string;
      mode: 'marquee' | 'word_by_word' | 'spread_grid';
      speed: number;
      colorHex?: string;
      fontSize?: number;
      loop: boolean;
    }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      if (!room || room.orchestratorSocketId !== socket.id) return;
      await refreshRoomEntitlementsFromTeam(room);
      if (!room.entitlements.visualsSurface || !room.entitlements.sequencedText) return;

      const textUpdate = {
        text: payload.text,
        mode: payload.mode,
        speed: payload.speed,
        colorHex: payload.colorHex,
        fontSize: payload.fontSize,
        loop: payload.loop,
      };

      const updatedState = updateVisualsState(room, { text: textUpdate });
      io.to(`visuals:${room.code}`).emit('visuals:text', textUpdate);

      room.lastActivityAt = Date.now();
    }
  );

  // ── Visuals surface: clear text overlay ────────────────────────────────────
  socket.on(
    'orchestrator:visuals_clear_text',
    async (payload: { roomCode: string }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      if (!room || room.orchestratorSocketId !== socket.id) return;
      await refreshRoomEntitlementsFromTeam(room);
      if (!room.entitlements.visualsSurface) return;

      const updatedState = updateVisualsState(room, { text: null });
      io.to(`visuals:${room.code}`).emit('visuals:text_clear');

      room.lastActivityAt = Date.now();
    }
  );

  // ── Visuals surface: set QR overlay ────────────────────────────────────────
  socket.on(
    'orchestrator:visuals_set_qr',
    async (payload: {
      roomCode: string;
      qrConfig: {
        enabled: boolean;
        intervalSeconds: number;
        durationSeconds: number;
        position?: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
        size?: 'small' | 'medium' | 'large';
      } | null;
    }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      if (!room || room.orchestratorSocketId !== socket.id) return;
      await refreshRoomEntitlementsFromTeam(room);
      if (!room.entitlements.visualsSurface) return;

      const updatedState = updateVisualsState(room, { qrConfig: payload.qrConfig });
      io.to(`visuals:${room.code}`).emit('visuals:qr', { qrConfig: payload.qrConfig });

      room.lastActivityAt = Date.now();
    }
  );

  // ── Visuals surface: advance cue ───────────────────────────────────────────
  socket.on(
    'orchestrator:visuals_next_cue',
    async (payload: { roomCode: string }) => {
      const room = rooms.get(payload.roomCode?.toUpperCase());
      if (!room || room.orchestratorSocketId !== socket.id) return;
      await refreshRoomEntitlementsFromTeam(room);
      if (!room.entitlements.visualsSurface) return;
      if (!room.rigCues || room.rigCues.length === 0) return;

      const nextIndex = ((room.cueIndex ?? 0) + 1) % room.rigCues.length;
      room.cueIndex = nextIndex;
      const cue = room.rigCues[nextIndex];

      const updatedState = updateVisualsState(room, {
        artId: cue.visualArtId,
        params: cue.params,
        transition: cue.transition?.type ?? 'cut',
      });

      io.to(`visuals:${room.code}`).emit('visuals:scene', updatedState);
      room.lastActivityAt = Date.now();
    }
  );

  socket.on('disconnect', async () => {
    for (const room of rooms.values()) {
      if (room.orchestratorSocketId === socket.id) {
        room.status = 'orchestrator_missing';
        room.reconnectDeadlineAt =
          Date.now() + room.entitlements.priorityReconnectWindowSeconds * 1000;
        emitRoomState(io, room);
        continue;
      }

      if (room.devices.has(socket.id)) {
        const device = room.devices.get(socket.id)!;
        handlePublisherDisconnect(io, room, device.publicId);
        device.status = 'reconnecting';
        device.lastSeenAt = Date.now();
        room.disconnectedPlayers.set(device.publicId, {
          ...device,
          socketId: '',
        });
        room.devices.delete(socket.id);
        playerReactionTimestamps.delete(socket.id);
        playerBoostState.delete(socket.id);
        room.lastActivityAt = Date.now();

        captureRealtimeEvent(room.ownerUserId, 'device_disconnected', {
          roomCode: room.code,
          teamId: room.teamId,
          ownerUserId: room.ownerUserId,
          planCode: room.planCode,
        }, {
          device_count: getActivePlayerCount(room),
        });

        emitRoomState(io, room);
      }
    }
  });
}
