# 03 — Control Desk: Devices + Visuals Tabs

## Summary

Split the control desk (`/room/[code]/control`) into **two tabs**:

1. **Devices** — the existing desk: matrix, device list, color pad, presets,
   fallback, terminate. (No behavior change; just moves under a tab.)
2. **Visuals** — control of the projection surface ([01](./01-visuals-surface.md)):
   open/share the surface, run the **cue list** of visual arts with a **Next/Go**
   button, edit the live **palette** (seeded from the active rig [02](./02-rigs.md)),
   toggle the logo, and **overwrite the rig** to persist live changes.

This lets the DJ run the projector in one tab/window and control everything from
another, all on one machine — or split across two machines.

> **Status: DONE (2026-06-07)** — desk split into Devices/Visuals tabs with URL
> persistence, the Visuals tab (output/share, cue list + Next, art picker, live palette,
> logo toggle, Overwrite Rig) shipped, `orchestrator:visuals_next_cue` added to realtime,
> and the `glow-visuals` logo type aligned (5 positions + `effect`). The cue-list and
> socials **editors** live in the Rigs Manager ([02](./02-rigs.md), tabs `cues`/`socials`).
> See "Built — drift vs spec" below for two deferred items (`console_config` visibility
> and the `/room/new` rig picker).

---

## Plan gating

- Visuals tab visible only if `visuals_surface` is true. Otherwise show an upsell.
- Palette editing is always available; "Overwrite Rig" needs a writable rig
  ([02](./02-rigs.md)).
- Button/tab visibility is driven by the loaded rig's `console_config`.

---

## Concepts

- The desk loads a **rig** ([02](./02-rigs.md)) and holds a **live working state** for
  visuals: `{ artId, palette, logo, cueIndex }`.
- The working state is initialized from the room's loaded rig (its `palette`,
  `defaultVisualArtId`, logo, and cue list).
- **Cue list + Next:** the rig's `rig_cues` are an ordered queue of visual arts. The
  **Next/Go** button advances `cueIndex` and emits a scene change for that cue (its
  `params` + `transition`). Prev/jump-to-cue are optional.
- Every change emits an `orchestrator:visuals_*` event (→ `visuals:{code}`).
- "Overwrite Rig" PATCHes the working state back into the rig (web API,
  [02](./02-rigs.md)). A "Save as new" option avoids destroying the original.
- An **unsaved-changes** indicator compares working state vs the loaded rig.
- The desk reads `rig.console_config` to show/hide tabs and buttons.

```ts
type VisualsWorkingState = {
  artId: string;
  palette: string[];        // 1..4 hex (custom for this set, may differ from rig)
  logoEnabled: boolean;
  cueIndex: number;         // position in the rig cue list
  dirty: boolean;           // differs from loaded rig
  loadedRigId: string | null;
};
```

---

## Realtime & API

Reuses events from [01](./01-visuals-surface.md):

- `orchestrator:visuals_set_scene` `{ roomCode, artId, params?, palette?, logo?, transition? }`
- `orchestrator:visuals_set_palette` `{ roomCode, palette }`
- `orchestrator:visuals_set_logo` `{ roomCode, logo | null }`
- `orchestrator:visuals_next_cue` `{ roomCode }` (optional convenience; otherwise Next
  just emits `visuals_set_scene` for the next cue)

Rig persistence reuses [02](./02-rigs.md): `PATCH /api/rigs/[id]` (palette/art/logo/
`console_config`) and `PUT /api/rigs/[id]/cues`.

Token/share reuses [01](./01-visuals-surface.md): `POST /api/rooms/[code]/visuals-token`.

---

## UI / UX

### Tabs

- Use the existing shadcn/neon styling. A simple two-tab switcher at the top of the
  desk, below the room header. Keep the room header (code, share, status, terminate)
  **above** the tabs so it is always visible.
- Tab state can live in the URL (`?tab=devices|visuals`) so a refresh keeps the tab.

### Devices tab

- Move the current desk body (matrix card, device list, color pad, preset picker)
  here. No functional change.

### Visuals tab

Sections:

1. **Output** — "Open visuals" (new window on this machine) + "Share to another
   screen" (copyable URL + QR via token). Show whether a surface is connected.
2. **Cue list** — the rig's ordered visual arts with a big **Next/Go** button (and
   prev/jump). Shows current vs next cue. Advancing emits a scene change.
3. **Visual art** — art picker for ad-hoc selection (gated by `available_visual_arts`).
4. **Palette** — 1–4 swatches editor (the live palette). Color pickers; add/remove.
   Changing it updates presets + the surface immediately.
5. **Logo** — toggle + preview (from the rig).
6. **Rig** — rig selector + **"Overwrite Rig"** / **"Save as new"** + unsaved
   indicator.
7. **(Later)** media controls ([06](./06-orchestrator-media.md)), reactions config
   ([05](./05-audience-reactions.md)), live call ([09](./09-webrtc-live-call.md)) live
   under this tab too, or get their own sub-tabs if it grows.

Button/tab visibility throughout the desk respects the rig's `console_config`.
Copy stays in the rave lexicon (see `designSystem.md`).

---

## Implementation phases

### Phase 1 — Tab shell ✅

- [x] Tab switcher (pill-style `DEVICES` / `VISUALS`); existing desk moved to the
      **Devices** tab unchanged. Tab state persisted in URL (`?tab=`). Room header stays
      above the tabs.

### Phase 2 — Visuals tab: output + art + cue list ✅

- [x] "Open visuals" mints a token and opens the surface in a new window.
- [x] "Share" shows URL + QR (6h expiry noted).
- [x] Art picker (filtered by `entitlements.availableVisualArts`) emits
      `orchestrator:visuals_set_scene`.
- [x] Cue list + Next/Go advances through the rig's cues; Prev + jump-to-cue supported.

### Phase 3 — Live palette + logo ✅

- [x] `<PaletteEditor>` (1–4 swatches) seeded from the loaded rig; emits
      `visuals_set_palette`.
- [x] Logo toggle emits `visuals_set_logo` (logo built from the rig's `logoConfig`).

### Phase 4 — Overwrite / save + console_config (partial)

- [x] "Overwrite Rig" (PATCH `/api/rigs/[id]` with palette/art/logoEnabled) + dirty
      ("Unsaved changes") indicator.
- [ ] **`console_config` visibility (deferred):** the desk does not yet hide/show
      tabs/buttons from `console_config`. "Save as new" from the desk also not wired
      (rigs are created/edited in the Rigs Manager).

---

## Files to touch

| Path | Change |
| --- | --- |
| `web/app/(control)/room/[code]/control/page.tsx` | Tabs + visuals tab |
| `web/components/glow/visuals-tab.tsx` | New: visuals controls |
| `web/components/glow/cue-list.tsx` | New: cue list + Next/Go |
| `web/components/glow/palette-editor.tsx` | New: 1–4 color editor |
| `web/components/glow/room-share-controls.tsx` | Reuse for visuals share |
| `web/components/ui/tabs.tsx` | shadcn tabs (add if missing) |

---

## Acceptance criteria

- Desk has Devices + Visuals tabs; Devices behaves exactly as before.
- From Visuals, the DJ opens the surface on the same machine and on another machine.
- The cue list + Next advances visual arts on the surface with the cue's transition.
- Editing the palette updates both presets (devices) and the surface live.
- "Overwrite Rig" persists the live palette/art/logo to the rig; a dirty indicator
  appears when live values differ.
- Hiding a tab/button via `console_config` hides it in the desk.

---

## Built — drift vs spec (2026-06-07)

| Area | Spec | Built |
| --- | --- | --- |
| Tabs | shadcn tabs in URL | pill switcher in `?tab=devices\|visuals` via `router.replace`; room header always above |
| Components | `visuals-tab` + `cue-list` + `palette-editor` | all shipped (`web/components/glow/`); palette uses native `<input type="color">` |
| Cue advance | `visuals_next_cue` optional | **added** to realtime: `RoomState` keeps `cueIndex` + `rigCues` (in-memory), `create_room` snapshots cues sorted by `sort_order`, handler wraps around and emits `visuals:scene`; Prev/Jump emit `visuals_set_scene` directly |
| Overwrite Rig | palette/art/logo/`console_config` | PATCHes **palette + `defaultVisualArtId` + `logoEnabled`** only (logo position/effect/opacity + cues edited in Rigs Manager) |
| Logo type | align package | **done** — `glow-visuals` `VisualArtInput.logo` now has 5 positions + `effect` (matches realtime scene). Collateral: fixed `rigs/page.tsx` mock audio to the `AudioFeatures` shape `{bass, mid, treble, energy}` |
| Cue/socials editors | surface them (carried from 02) | **already in the Rigs Manager** ([02](./02-rigs.md)) — tabs `cues`/`socials` with `formCues`/`formSocials` |

> **Deferred (not a regression):**
> - **`console_config` visibility** — the desk renders all tabs/buttons; it does not yet
>   read `console_config` to hide/show them. Still a known follow-up.
>
> **Resolved:** the **`/room/new` rig picker** now exists — the create page passes
> `rigId` + `paletteSnapshot` to `orchestrator:create_room` (which the realtime backend
> consumes), so `room_sessions.rig_id`/`palette_snapshot` get populated at creation. The
> desk also still auto-loads the rig client-side on rejoin as a fallback.

---

## Open questions

1. Should the live palette also affect the **color pad** defaults in the Devices tab?
2. Sub-tabs vs one long Visuals tab once media/reactions/live-call land?
3. Persist last-used tab per user (vs the rig's `console_config` default)?
4. Should Next/Go support auto-advance on a timer, or manual only?
