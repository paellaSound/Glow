# Glow — Preset Refactoring Plan

This document is the source of truth for refactoring the visual preset system. Use it to plan and implement presets in a scalable way across `web`, `realtime`, and future packages.

Related docs:

- [product-intent.md](./product-intent.md) — product rules for presets and plans
- [strategy.md](./strategy.md) — phase tracker
- [features/07-preset-mixing-engine.md](./features/07-preset-mixing-engine.md) — **v2
  extension**: palette-driven params + layered/mixed effects + the device render
  priority chain. Build that on top of the registry described here.

> **Status note:** the registry refactor described in this doc has largely landed —
> `packages/glow-presets` now exposes `PRESET_REGISTRY`, `getPreset`,
> `isValidPresetId`, `presetsForPlan`, `computePresetColor`, `computeFallbackColor`,
> and an `audio` preset. The next evolution is feature 07 (mixing/palette).

---

## 1. Problem Statement

Today presets are **not a shared system**. They are:

- A single `switch` in one file (`web/lib/glow/presets.ts`)
- A hardcoded label map (`PRESET_LABELS`)
- Duplicated preset ID lists in UI (`standalone`, `control`)
- Plan entitlements as string arrays duplicated in `web/lib/entitlements.ts` seed data
- Server-side validation that only checks string membership, with no registry

### Current pain points

| Issue | Impact |
| --- | --- |
| Preset logic only in `web/lib/glow/presets.ts` | `realtime` cannot validate metadata; fallback hardcodes `'wave'` |
| UI lists presets manually | `standalone` shows 5 presets; `control` uses `roomState.entitlements`; lists drift |
| No preset registry | Adding a preset requires editing 4+ files |
| `computePresetColor` is a growing switch | No params, no categories, no tests per effect |
| Fallback reuses `wave` internally | Hidden coupling; not documented in product |
| No shared types package | `VisualPresetEvent` in web; realtime uses inline payload types |

---

## 2. Current Architecture (as-is)

### Data flow

```txt
Orchestrator UI (control)
   │
   │ socket.emit('orchestrator:run_preset', { presetId, seedTimestamp, targetTimestamp })
   ▼
realtime/room-manager.ts
   │ checks room.entitlements.availablePresets.includes(presetId)
   │ broadcasts visual:preset to room
   ▼
Player UI (play) / Standalone (local)
   │
   │ visual.schedulePreset(event)
   ▼
web/lib/glow/visual-engine.ts
   │ requestAnimationFrame loop
   │ computePresetColor(presetId, PresetContext)
   ▼
Screen background color
```

### Fallback mode (separate path)

```txt
Control toggles fallback
   │
   │ orchestrator:set_fallback_mode
   ▼
realtime emits fallback:mode_changed
   ▼
visual-engine → computeFallbackColor() → internally calls computePresetColor('wave', ...)
```

Fallback is **not** a preset from the user's perspective, but it **reuses** wave math in code.

---

## 3. File Map — Where Presets Live Today

### Core logic (single source, but incomplete)

| File | Role |
| --- | --- |
| `web/lib/glow/presets.ts` | **All render math**: `computePresetColor`, `computeFallbackColor`, `PRESET_LABELS`, `PresetContext` |
| `web/lib/glow/visual-engine.ts` | RAF loop; calls `computePresetColor` / `computeFallbackColor`; priority: fallback > direct color > preset |
| `web/lib/glow/types.ts` | `VisualPresetEvent`, `PlanEntitlements.availablePresets` |

### UI consumers (duplicated lists / wiring)

| File | How presets are used |
| --- | --- |
| `web/app/(control)/room/[code]/control/page.tsx` | Reads `roomState.entitlements.availablePresets`; emits `orchestrator:run_preset`; uses `PRESET_LABELS` for button text |
| `web/app/(immersive)/standalone/page.tsx` | **Hardcoded** `['solid', 'flash', 'pulse', 'wave', 'rainbow']`; calls `visual.schedulePreset` locally (no socket) |
| `web/app/(immersive)/room/[code]/play/page.tsx` | Listens `visual:preset` → `visual.schedulePreset` (no preset list UI) |

### Server / entitlements

| File | How presets are used |
| --- | --- |
| `realtime/src/room-manager.ts` | `orchestrator:run_preset` — entitlement check + broadcast; **no render logic** |
| `web/lib/entitlements.ts` | `PLAN_SEED_DATA[].entitlements.available_presets` — per-plan string arrays |
| `realtime/src/db.ts` | Maps DB key `available_presets` → `availablePresets` |
| DB `plan_entitlements` | Stores `available_presets` JSON at room creation snapshot |

### Implemented preset IDs today

| ID | In `computePresetColor` | In `PRESET_LABELS` | Free | Plus 25 | Plus 50 | Pro | In standalone UI |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `solid` | yes | yes | yes | yes | yes | yes | yes |
| `flash` | yes | yes | yes | yes | yes | yes | yes |
| `pulse` | yes | yes | yes | yes | yes | yes | yes |
| `wave` | yes | yes | no | yes | yes | yes | yes |
| `rainbow` | yes | yes | no | yes | yes | yes | yes |
| `diagonal` | yes | yes | no | no | yes | yes | no |
| `strobe` | yes | yes | no | no | no | yes | no |

**Drift example:** `standalone` exposes paid presets without checking plan. `control` is plan-aware via entitlements.

---

## 4. Key Types and Events (today)

### `PresetContext` (render input)

```ts
{
  row: number;
  col: number;
  timeMs: number;      // elapsed since targetTimestamp
  seed: number;        // seedTimestamp from event
  matrixRows: number;
  matrixCols: number;
}
```

### `VisualPresetEvent` (socket + local)

```ts
{
  presetId: string;
  seedTimestamp: number;
  targetTimestamp: number;
  matrix: { rows: number; cols: number };
}
```

### Socket events

| Direction | Event | Payload |
| --- | --- | --- |
| Client → server | `orchestrator:run_preset` | `{ roomCode, presetId, seedTimestamp, targetTimestamp }` |
| Server → clients | `visual:preset` | `VisualPresetEvent` |
| Client → server | `orchestrator:set_fallback_mode` | `{ roomCode, enabled, seedTimestamp }` |
| Server → clients | `fallback:mode_changed` | `{ enabled, seedTimestamp, roomCode }` |

---

## 5. Target Architecture

### Design principles

1. **Single preset registry** — one list of preset definitions (id, label, category, render fn).
2. **Pure render package** — no React, no Socket.io; usable in web + realtime + tests.
3. **UI reads registry + entitlements** — never hardcode preset ID arrays in pages.
4. **Server validates against registry** — reject unknown `presetId` even if entitlement string matches.
5. **Fallback is explicit** — either a named preset alias or a dedicated `fallback` definition in registry.
6. **Adding a preset = 1 registry entry + seed tier update** — not 4 file edits.

### Proposed package layout

Option A (recommended): **`packages/glow-presets/`** workspace package

```txt
packages/glow-presets/
  package.json
  src/
    index.ts              # public API
    types.ts              # PresetContext, PresetDefinition, PresetId
    registry.ts           # PRESET_REGISTRY, getPreset, listPresets
    render/
      solid.ts
      flash.ts
      pulse.ts
      wave.ts
      ...
    fallback.ts           # computeFallbackColor (uses registry)
    labels.ts             # or labels on each definition
  tests/
    presets.test.ts
```

Option B (lighter MVP): keep in `web/lib/glow/presets/` but split into folder + re-export; copy types to realtime (not ideal long-term).

**Recommendation:** Option A if you expect audio-reactive / shader presets later. Option B for fastest cleanup.

### `PresetDefinition` shape (target)

```ts
export type PresetId = 'solid' | 'flash' | 'pulse' | 'wave' | 'rainbow' | 'diagonal' | 'strobe';

export type PresetDefinition = {
  id: PresetId;
  label: string;
  description?: string;
  category: 'basic' | 'motion' | 'advanced';
  minTier: 'free' | 'plus_25' | 'plus_50' | 'pro';
  render: (ctx: PresetContext) => string;
};
```

### Public API (target)

```ts
// packages/glow-presets
export const PRESET_REGISTRY: Record<PresetId, PresetDefinition>;
export function getPreset(id: string): PresetDefinition | undefined;
export function listPresets(): PresetDefinition[];
export function computePresetColor(id: PresetId, ctx: PresetContext): string;
export function computeFallbackColor(roomCode: string, seed: number, row: number, col: number, now: number): string;
export function isValidPresetId(id: string): id is PresetId;
export function presetsForPlan(planCode: string): PresetId[];
```

### UI component (target)

```txt
web/components/glow/preset-picker.tsx
```

Props:

```ts
{
  availablePresetIds: string[];  // from entitlements or standalone allowlist
  onRun: (presetId: PresetId) => void;
  disabled?: boolean;
}
```

Used by:

- `control/page.tsx` — `onRun` → socket `orchestrator:run_preset`
- `standalone/page.tsx` — `onRun` → `visual.schedulePreset` locally

---

## 6. Implementation Phases

Use this order in a new chat/session. Each phase should be shippable.

### Phase 0 — Inventory & tests baseline

- [ ] Snapshot current output for 2–3 presets (solid, wave, pulse) at fixed `PresetContext` values
- [ ] Document any visual regressions acceptable or not

**Exit:** golden JSON or screenshot notes for regression comparison.

### Phase 1 — Extract registry (no behavior change)

- [ ] Create `packages/glow-presets` (or `web/lib/glow/presets/` folder split)
- [ ] Move each `case` from `computePresetColor` into its own module
- [ ] `registry.ts` aggregates definitions
- [ ] `web/lib/glow/presets.ts` becomes thin re-export (backward compat)
- [ ] Add unit tests per preset

**Exit:** all existing presets render identically; tests pass.

### Phase 2 — Unify UI

- [ ] Create `PresetPicker` component using registry labels
- [ ] Replace control page preset buttons with `PresetPicker`
- [ ] Replace standalone hardcoded list with `PresetPicker` + explicit allowlist helper
- [ ] Remove `PRESET_LABELS` from page imports

**Exit:** no hardcoded preset arrays in `app/` routes.

### Phase 3 — Entitlements alignment

- [ ] Add `presetsForPlan(planCode)` derived from registry `minTier` OR keep DB arrays but validate against registry on seed
- [ ] Script/check: every ID in `PLAN_SEED_DATA.available_presets` exists in registry
- [ ] realtime imports `isValidPresetId` from shared package
- [ ] `orchestrator:run_preset` rejects unknown IDs with log (optional callback error)

**Exit:** impossible to seed a plan with invalid preset id.

### Phase 4 — Realtime + types

- [ ] Share `VisualPresetEvent` / `PresetId` types from package or `packages/glow-types`
- [ ] realtime uses shared types in `room-manager.ts`
- [ ] Optional: validate payload presetId before broadcast

**Exit:** web + realtime compile against same types.

### Phase 5 — Fallback cleanup

- [ ] Move fallback to `fallback.ts` with explicit `FALLBACK_PRESET_ID = 'wave'` constant (or dedicated fallback renderer)
- [ ] Document in product-intent if fallback should remain wave or become configurable

**Exit:** no magic string `'wave'` buried in fallback without comment/registry link.

### Phase 6 — Future-ready (optional)

- [ ] Preset params (speed, base color) in definition
- [ ] `orchestrator:run_preset` payload extended with `params`
- [ ] Audio-reactive hook interface (entitlement `audioReactive`)
- [ ] Preset preview thumbnails in control UI

---

## 7. Files to Touch (checklist)

### Must change

| File | Change |
| --- | --- |
| `web/lib/glow/presets.ts` | Split → re-export or delete after migration |
| `web/lib/glow/visual-engine.ts` | Import from shared package |
| `web/app/(control)/room/[code]/control/page.tsx` | Use `PresetPicker` |
| `web/app/(immersive)/standalone/page.tsx` | Use `PresetPicker` |
| `realtime/src/room-manager.ts` | Validate preset id via registry |
| `web/lib/entitlements.ts` | Align seed arrays with registry (or generate from tiers) |

### Should change

| File | Change |
| --- | --- |
| `web/lib/glow/types.ts` | Import shared event types |
| `docs/product-intent.md` | Update preset list if new categories |
| `docs/strategy.md` | Add phase tracker row for preset refactor |

### Do not change (behavior only consumes)

| File | Why |
| --- | --- |
| `web/app/(immersive)/room/[code]/play/page.tsx` | Only listens to `visual:preset`; no preset list |
| DB schema | `available_presets` stays as string array snapshot |

---

## 8. Workspace / Monorepo Notes

Today:

```txt
Glow/
  web/          # Next.js
  realtime/     # Socket.io Node
```

Neither is a pnpm workspace root yet. For `packages/glow-presets`:

1. Add root `pnpm-workspace.yaml`:

```yaml
packages:
  - 'web'
  - 'realtime'
  - 'packages/*'
```

2. Add `"glow-presets": "workspace:*"` to `web` and `realtime` dependencies.

3. Ensure `realtime` can import pure TS (no DOM). Current preset code is already pure.

**Alternative without monorepo:** duplicate registry in realtime as generated file from a build script — avoid unless necessary.

---

## 9. Testing Strategy

### Unit tests (`packages/glow-presets/tests/`)

- Each preset returns valid `#RRGGBB` hex
- Deterministic output for fixed `PresetContext`
- `solid` unchanged over time; `flash` toggles with `timeMs`
- `presetsForPlan('free')` excludes `wave`, `rainbow`, etc.

### Integration (manual)

1. Control room → run each available preset → all players sync
2. Standalone → same visual as control for same preset
3. Free plan → wave/rainbow buttons not shown in control
4. Fallback on → wave-like motion on all players
5. Direct color still overrides preset (see `directColorRef` in visual-engine)

### Regression risks

| Area | Risk |
| --- | --- |
| `targetTimestamp` scheduling | Preset starts late if clock skew |
| Matrix 1x1 vs 3x3 | Coordinate presets look different; test both |
| `directColorRef` vs preset | Priority order must stay: fallback > direct > preset |

---

## 10. Prompt for Next Chat

Copy this into a new session to start implementation:

```txt
Read docs/preset-refactoring.md and implement Phase 1 (extract registry) and Phase 2 (PresetPicker UI).

Constraints:
- No visual behavior change in Phase 1
- Use packages/glow-presets workspace package
- Keep English comments in code
- Do not change DB schema
- Run tests and pnpm build for web + realtime when done
```

---

## 11. Open Questions (decide before Phase 3)

1. **Standalone presets:** show all presets for demo, or same tier gating as logged-in user?
2. **Fallback preset:** keep internal `wave` or make orchestrator pick fallback effect?
3. **Stop preset:** need explicit "stop" / return to black, or only overridden by direct color?
4. **Monorepo now:** worth pnpm workspace for one shared package, or folder inside `web` only?

---

## 12. Quick Reference — Current Code Snippets

### Trigger from control (today)

```ts
socket.current?.emit('orchestrator:run_preset', {
  roomCode: code.toUpperCase(),
  presetId,
  seedTimestamp: Date.now(),
  targetTimestamp: Date.now() + 100,
});
```

### Trigger locally in standalone (today)

```ts
visual.schedulePreset({
  presetId,
  seedTimestamp: Date.now(),
  targetTimestamp: Date.now(),
  matrix: { rows: 1, cols: 1 },
});
```

### Render loop (today)

```ts
setColor(computePresetColor(preset.presetId, {
  row: options.row ?? 0,
  col: options.col ?? 0,
  timeMs: elapsed,
  seed: preset.seedTimestamp,
  matrixRows: preset.matrix.rows,
  matrixCols: preset.matrix.cols,
}));
```

---

*Last updated: 2026-06-05 — reflects codebase after matrix-optional rooms, broadcast color, and reconnect work.*
