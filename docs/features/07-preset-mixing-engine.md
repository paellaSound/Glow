# 07 — Pattern Sequences (palette + weighted effect distribution)

> **Status: DONE (2026-06-08).** Shipped as **Pattern Sequences** — a richer, savable
> model than the original "layer/blend" plan below. Instead of compositing layers per
> pixel with blend modes, the engine **distributes weighted effects across the audience**
> (deterministic per `devicePublicId`): e.g. `pulse` on 40% of screens + `wave` on 60%.
> See "Built — what shipped" right below; the original layer/blend spec is kept further
> down as historical context (superseded).

## Built — what shipped (Pattern Sequences)

A **Pattern Sequence** is a saved, named bundle of: a **palette** (1–12 hex) + an ordered
list of **effects**, each with an `active` flag and a `weight` (%). Active weights sum to
100. The orchestrator selects a sequence and it goes **live**; the server distributes the
weighted effects across the room's devices.

### Data model — `pattern_sequences` (new table)

```24:31:web/lib/db/schema.ts
```

Columns: `id`, `owner_user_id` → `profiles`, `team_id` → `teams`, `name`, `palette`
(jsonb), `effects` (jsonb), `is_default`, `schema_version`, `created_at`, `updated_at`.

```ts
// web/lib/glow/pattern-sequences.ts
type PatternSequenceEffect = {
  id: string;
  presetId: PresetId;
  params?: PresetParams;     // palette injected at send time
  active: boolean;           // "In mix" vs preview-only
  weight: number;            // % share of the audience; active weights sum to 100
};
type PatternSequenceRecord = { id; name; palette: string[]; effects: …; isDefault; … };
```

Validation: palette 1–12 hex; ≥1 active effect; **multi-effect requires
`effect_layering`**; active weights must sum to 100; each `presetId` valid + entitled.

### Realtime — `orchestrator:run_distribution`

```738:779:realtime/src/room-manager.ts
```

- desk → server: `orchestrator:run_distribution { roomCode, effects, seedTimestamp, targetTimestamp }`.
- Server checks: ≥1 effect, **`effect_layering` required when `effects.length > 1`**, each
  preset valid + in `availablePresets`, `audio` needs `audioReactive`, weights valid.
- server → clients: **1 effect** → existing `visual:preset` (backward compatible);
  **multi** → new `visual:effect_distribution { effects, seedTimestamp, targetTimestamp, matrix }`.
  Players resolve their slice deterministically from `devicePublicId` + weights.

### Entitlements

| Key | Free | Plus 25 | Plus 50 | Pro |
| --- | --- | --- | --- | --- |
| `max_pattern_sequences` | 1 | 3 | 10 | 50 |
| `effect_layering` (multi-effect) | false | false | true | true |

### APIs + library

- `GET/POST /api/pattern-sequences`, `PATCH/DELETE /api/pattern-sequences/[id]`.
- Library page `/pattern-sequences` (rename/delete CRUD) + account-menu entry.
- Migration `0003_add_pattern_sequences.sql`.

### Control desk UX (`variant="control"`)

- **Embedded preview** (`pattern-sequence-preview.tsx`) inside the editor (replaced the
  top-fixed `ControlLivePreview`, now deleted). Reacts live to draft palette/effects/split;
  play/pause, orientation, mobile/desktop viewport, Editing/Live state, multi-effect grid.
- **Audience split slider** (`allocation-bar.tsx`): drag dividers to set per-effect weight;
  delta-based drag + pointer capture (fixed a double-count jump bug).
- **In mix (cyan)** vs **Preview (violet)** distinction per effect row; "Canvas preview"
  vs "Live" badges.
- **Smart single save button:** `Save first sequence` (POST) / `Overwrite current pattern`
  (PATCH, only if dirty & same name) / `Add new sequence` (POST, name changed & unique).
  Case-insensitive duplicate-name validation. Selecting a sequence loads + previews +
  **goes live automatically** (no "Send live" button). Rename/delete live only in the
  library page.

### Drift vs the original plan (below)

- **Distribution, not blend compositing.** Effects are split across *devices* by weight,
  not composited per-pixel with `blend`/`opacity`. `EffectLayer`/`EffectStack`,
  `orchestrator:run_stack` and `visual:effect_stack` from the original plan are superseded
  by `run_distribution` / `visual:effect_distribution` (a `run_stack` handler may still
  exist but the live path is distribution).
- **Sequences are persisted** (`pattern_sequences` + `max_pattern_sequences`), which the
  original plan did not include — they're reusable across rooms and auto-loaded by default.
- Palette is **1–12** colours (Phase 1 already shipped with the desk palette selector).

---

## Original plan (historical, superseded by Pattern Sequences)

> Kept for context. The sections below describe the layer/blend compositing model that was
> originally specced. The shipped engine uses weighted audience distribution instead.

---

## Plan gating

| Key | Effect |
| --- | --- |
| `effect_layering` | Stack/mix more than one effect (Plus 50+) |

Palette-driven single presets are available to everyone (no new gate); only
**multi-layer** mixing is gated.

---

## Current state (recap)

From [../preset-refactoring.md](../preset-refactoring.md) + code:

- `packages/glow-presets` exposes `PRESET_REGISTRY`, `getPreset`, `isValidPresetId`,
  `presetsForPlan`, `computePresetColor`, `computeFallbackColor`, `PresetContext`,
  `PresetParams`, `VisualPresetEvent`, `AudioFeatures`.
- `PresetContext` already carries `row,col,timeMs,seed,matrixRows,matrixCols,audio?`.
- `PresetParams` today only has `audioSource?`.
- `visual-engine.ts` priority is **fallback > direct color > preset**.
- `run_preset` validates id + entitlement (and `audio` needs `audioReactive`).

---

## Target model

### 1. Palette in params

Extend `PresetParams` so any preset can be tinted by the active palette:

```ts
export type PresetParams = {
  audioSource?: AudioSource;
  palette?: string[];        // 1..4 hex (from rig / live edit)
  speed?: number;            // generic speed multiplier
  intensity?: number;        // 0..1
};
```

Renderers that currently hardcode colors (e.g. `solid` = red) should prefer
`ctx.params.palette` when present, falling back to their default. `PresetContext`
gains `params?: PresetParams`.

### 2. Layers

A **layer** is a preset + params + blend settings. A device renders an ordered stack:

```ts
export type EffectLayer = {
  presetId: PresetId;
  params?: PresetParams;
  blend: 'normal' | 'add' | 'screen' | 'multiply';
  opacity: number;          // 0..1
};

export type EffectStack = {
  layers: EffectLayer[];    // bottom → top
  seedTimestamp: number;
  targetTimestamp: number;
  matrix: { rows: number; cols: number };
};
```

The engine computes each layer's color for `(row,col,t)` then composites
bottom→top using blend+opacity into the final color.

### 3. Device render priority (final)

The single source of truth for what a device shows, highest wins:

```txt
1. identify flash         (device:identify)
2. media layer            (visual:media — image/text/gif, while active)   [06]
3. torch override         (device:torch — physical LED, parallel to screen) [08]
4. effect stack / preset  (visual:effect_stack or visual:preset)
5. direct color           (visual:color)
6. fallback mode          (fallback:mode_changed)
7. black / idle
```

> Note torch is a **physical LED**, not a screen color; it runs in parallel but is
> listed here so the priority doc is complete.

Keep backward compatibility: a single `visual:preset` is just an `EffectStack` with one
layer. Don't break existing events.

---

## Realtime topics & events

| Direction | Event | Payload | Notes |
| --- | --- | --- | --- |
| desk → server | `orchestrator:run_preset` | existing + `params.palette` | unchanged shape, palette added |
| desk → server | `orchestrator:run_stack` | `{ roomCode, layers, seedTimestamp, targetTimestamp }` | new, gated by `effect_layering` |
| server → clients | `visual:preset` | existing | single layer |
| server → clients | `visual:effect_stack` | `EffectStack` | new |

Server checks: each layer's `presetId` valid + entitled; `effect_layering` required for
`layers.length > 1`; `audio` layer requires `audioReactive`.

---

## UI / UX

- **Palette wiring:** the desk passes the live palette ([03](./03-control-panel-tabs.md))
  into `run_preset`/`run_stack` params automatically.
- **Layer builder (Plus 50+):** a small stack editor — add layer (preset picker),
  reorder, set blend + opacity, "Run stack". Free/Plus 25 keep the single
  `PresetPicker`.
- Show the active stack as chips with quick mute/solo per layer.

---

## Implementation phases

### Phase 1 — Palette params (no layering) ✅ (2026-06-07)

- [x] `PresetParams.palette` (1–12 hex) + `PresetContext.params` exist; renderers honor
      the palette with safe fallbacks; the players' `visual-engine.ts` respects it.
- [x] Desk sends the live palette into `run_preset` (unified palette selector feeds the
      "Rave Pattern Sequences" presets). Note: palette is **1–12** colours in code (the
      original 1–4 in this doc was a lower bound).
- Remaining phases were re-scoped into **Pattern Sequences** (see "Built" at the top).

### Phase 2 — Weighted distribution engine ✅

- [x] `orchestrator:run_distribution` + `visual:effect_distribution` (multi) / `visual:preset`
      (single, backward compatible); deterministic per-device slice by weight.
- [x] `effect_layering` gates `effects.length > 1`; per-effect preset/entitlement checks.

### Phase 3 — Persisted sequences ✅

- [x] `pattern_sequences` table + `0003_add_pattern_sequences.sql`; CRUD API
      (`/api/pattern-sequences[/id]`); `max_pattern_sequences` entitlement (1/3/10/50).

### Phase 4 — Sequence editor + library UI ✅

- [x] Control-desk editor (`variant="control"`) with embedded preview, audience-split
      slider, In-mix/Preview distinction, smart save button + duplicate-name validation.
- [x] Library page `/pattern-sequences` (rename/delete) + account-menu entry.

### Phase 5 — Device priority chain (partial)

- [x] `visual:preset` / `visual:effect_distribution` resolved in the player engine.
- [ ] Full priority chain incl. **media** ([06](./06-orchestrator-media.md)) and **torch**
      ([08](./08-device-flash-control.md)) hooks — finish with those features.

---

## Files to touch

| Path | Change |
| --- | --- |
| `packages/glow-presets/src/types.ts` | `PresetParams` palette/speed/intensity; `EffectLayer`/`EffectStack` |
| `packages/glow-presets/src/render/*.ts` | Honor palette |
| `packages/glow-presets/src/compositor.ts` | New: blend/composite |
| `packages/glow-presets/tests/*` | Palette + compositor tests |
| `web/lib/glow/visual-engine.ts` | Stack render + priority chain |
| `web/components/glow/preset-picker.tsx` | Optional: stack builder |
| `realtime/src/room-manager.ts` | `run_stack` + checks |
| `web/lib/entitlements*.ts`, `realtime/src/types.ts` | `effect_layering` |

> Remember the package is duplicated under `web/packages/glow-presets` and
> `packages/glow-presets`. Keep both in sync (or consolidate to a single workspace
> package — see [../preset-refactoring.md](../preset-refactoring.md) §8).

---

## Acceptance criteria

- A preset rendered with a palette uses the DJ's colors, not hardcoded red.
- Plus 50+ can run a 2–3 layer stack with visible blend/opacity differences, synced
  across devices.
- Single `visual:preset` still works unchanged (backward compatible).
- The device priority chain is deterministic and documented in code.

---

## Open questions

1. Blend modes needed for MVP (just `normal`+`add`?).
2. Max layers per plan (perf on low-end phones).
3. Should the visuals surface arts ([01](./01-visuals-surface.md)) share the compositor
   or stay shader-based?
4. Per-layer palette vs one shared palette per stack.
