# Glow — Visuals Architecture (as-is)

Accurate snapshot of **how visuals work and are rendered today** (2026-06-11), as a base
for a future redesign. Descriptive only — no proposals here. See
[architecture.md](./architecture.md) for the broader system and
[improvements/00-index.md](./improvements/00-index.md) for the recent fixes that shaped the
current state.

---

## 0. The key fact: two independent render systems

There is **no single "scene" engine**. Visuals are produced by two separate systems that
only share the *palette* concept (and propagate it through different channels):

| | **Visuals surface** (projector/TV) | **Player devices** (phones) |
| --- | --- | --- |
| Renders | One full-screen **art** (Canvas2D/WebGL) | One **flat color per device** (each phone = 1 matrix cell) |
| Package | `web/packages/glow-visuals` | `web/packages/glow-presets` (via `visual-engine.ts`) |
| Page | `web/app/(immersive)/room/[code]/visuals/page.tsx` | `web/app/(immersive)/room/[code]/play/page.tsx` |
| Server state | `room.visualsState` | `room.playerVisualState` |
| Realtime topic | `visuals:{code}` | `room:{code}` |
| Events | `visuals:*` | `visual:*` |

What the surface shows and what the phones show are **not the same content** and are
**not rendered the same way**.

---

## 1. Surface — arts (`glow-visuals`)

### Registry & plan gating

Three registered arts today (`web/packages/glow-visuals/src/registry.ts`):

| Art id | Label | Min tier | Mount |
| --- | --- | --- | --- |
| `glow-branded` | Glow Branded (splash + room code + join link) | `free` | `mountGlowBranded` |
| `pulse-grid` | Pulse Grid (palette grid waving to music) | `plus_25` | `mountPulseGrid` |
| `audio-shader` | Audio Shader (WebGL, bass/treble reactive) | `plus_25` | `mountAudioShader` |

`visualArtsForPlan(planCode)` filters by tier order `free < plus_25 < plus_50 < pro`.

### Art contract

Each art mounts into a `<canvas>` and returns a controller; it pulls the latest input each
frame via the getter passed to `mount()`:

```47:77:web/packages/glow-visuals/src/types.ts
export type VisualArtController = {
  setInput: (input: VisualArtInput) => void;
  resize: () => void;
  destroy: () => void;
};
export type VisualArtDefinition = {
  id: VisualArtId;
  label: string;
  minTier: PlanTier;
  mount: (canvas: HTMLCanvasElement, getInput: () => VisualArtInput) => VisualArtController;
};
```

Per-frame input:

```21:41:web/packages/glow-visuals/src/types.ts
export type VisualArtInput = {
  timeMs: number;
  palette: string[];            // 1–4 hex
  audio?: AudioFeatures;        // { bass, mid, treble, energy }
  logo?: { url; opacity; position; effect } | null;
  params?: Record<string, number | string | boolean>;
  roomCode?: string;            // glow-branded uses it for QR/join URL
};
```

### Surface render pipeline

`visuals/page.tsx`:

- Connects to `visuals:{code}` with a signed visuals token (HMAC, see
  [features/01-visuals-surface.md](./features/01-visuals-surface.md)).
- Mounts the current art with `definition.mount(canvas, () => inputRef.current)`. The page
  keeps `inputRef.current` updated and also calls `controller.setInput(...)` on each event.
- Swaps art by `destroy()` + `mount()` when `artId` changes.
- **Overlays (DOM layers on top of the art canvas), independent of the art:**
  media overlay (image/gif/text), live-call video tiles, floating emoji reactions, branding
  logo, and QR. The art itself only knows palette/audio/params/logo/roomCode.
- Connection states: `connecting → subscribing → subscribed`, plus `token_missing`,
  `token_expired`, `room_not_found`, `room_closed` (SESSION ENDED screen).

---

## 2. Player devices — color per device (`glow-presets`)

`web/lib/glow/visual-engine.ts` runs a `requestAnimationFrame` loop that resolves a single
screen color by a priority chain:

```31:41:web/lib/glow/visual-engine.ts
 * 1. identify flash (device:identify)
 * 2. media layer (visual:media) → blackout behind image/gif
 * 3. torch override (device:torch) — physical LED, parallel
 * 4. effect distribution / preset (visual:effect_distribution | visual:preset)
 * 5. direct color (visual:color)
 * 6. fallback mode (fallback:mode_changed)
 * 7. idle (#111111)
```

- Color computed by `computeDistributionColor` / `computePresetColor` / `computeFallbackColor`
  from `(row, col, timeMs, audio, palette)`. **The "visual" of the dance floor is the set of
  phones**, each showing the color assigned to its matrix cell.
- Scheduling is timestamp-based (`targetTimestamp`) corrected by `clockOffset` (NTP-style,
  see [architecture.md §5.1](./architecture.md)), so all devices fire together.
- Audio source per effect: `local` (device mic) or `orchestrator` (relayed features).
- **Pattern sequences** (palette + weighted effects) live here: desk →
  `orchestrator:run_distribution` → `visual:effect_distribution`; each phone renders its
  weighted slice.

---

## 3. Server state (authoritative, versioned)

`realtime/src/types.ts`:

```138:174:realtime/src/types.ts
export type VisualsState = {
  artId; params?; palette; logo?; transition?; qrConfig?; displayName?; text?;
  version; updatedAt;
};
export type PlayerVisualState = {
  kind: 'color' | 'preset' | 'distribution' | 'fallback' | 'idle';
  payload; version; updatedAt;
};
```

- Both are always defined, updated via a reducer (bumps `version`), and delivered **in full
  in the join ACK** (`visuals:subscribe`, `player:join_room`) plus live deltas (improvement
  01). `player:resync` re-fetches the snapshot.
- **Surface cue list:** `room.rigCues` + `room.cueIndex`. `orchestrator:visuals_next_cue`
  advances through the rig's ordered arts (each cue = `visualArtId` + `params` + transition
  `cut`/`fade`). This is the rig's art queue.
- Also on the room: `liveCall` (mesh state), `rigName`, `rigSocials`.

---

## 4. Event flow (desk → server → clients)

**Surface** (topic `visuals:{code}`):

| Desk → server | Server → surface |
| --- | --- |
| `orchestrator:visuals_set_scene` | `visuals:scene` |
| `orchestrator:visuals_set_palette` | `visuals:palette` |
| `orchestrator:visuals_set_logo` | `visuals:logo` |
| `orchestrator:visuals_next_cue` | `visuals:scene` (from cue) |
| `orchestrator:visuals_set_text` / `_clear_text` | `visuals:text` / `visuals:text_clear` |
| `orchestrator:visuals_set_qr` | `visuals:qr` |
| — | `visuals:audio_features`, `visuals:reaction`, `visuals:live_layout` |

**Players** (topic `room:{code}`):

| Desk → server | Server → players |
| --- | --- |
| `orchestrator:run_distribution` | `visual:effect_distribution` |
| (preset / color / fallback) | `visual:preset`, `visual:color`, `fallback:mode_changed` |
| `orchestrator:media_*` | `visual:media` (players only, since improvement 01) |
| `orchestrator:set_torch` | `device:torch` |
| (identify) | `device:identify` |

---

## 5. Open considerations (for the redesign — not addressed here)

Listed only, no analysis yet:

1. Two separate mental models (full-screen art vs color-per-device); palette is the only
   bridge and travels via two routes.
2. Arts are monolithic `mount()` loops; layers (logo/text/QR/media/reactions/live-call) are
   DOM overlays on top, not composable parts of the art.
3. `params` is freeform/untyped per art.
4. Surface cue list and player pattern sequences are parallel, unrelated queues.
5. Art input carries only palette/audio/logo/params/roomCode (no reactions, room state, or
   media awareness inside the art).
