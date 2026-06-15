# 05 — Control Device Page (mobile/tablet, operate-only)

## Summary

A new **operate-only** control surface so the DJ can run the show from a device or tablet
placed next to the mixer — without a laptop. It exposes the **same live tools** as the
control desk (both **Devices** and **Visuals** tabs), but with **no create/edit
operations** (no rig CRUD, no sequence library management) so it cannot break stored state.
Touch-first, big buttons.

This depends on the cleanups in [02](./02-visuals-desk-controls.md) and
[03](./03-live-call-state-persistence.md) — build it after those so it can reuse the
hardened controls and the lifted live-call state.

---

## Concept

- New route, e.g. `web/app/(control)/room/[code]/control-device/page.tsx`.
- Two tabs, mirroring the desk:
  - **Devices**: lights, effects/pattern selection (from saved sequences), send text/GIF
    to play devices, torch controls, device targeting.
  - **Visuals**: switch art, palette, logo/show name, custom text/QR to the surface, live
    call controls (go live / layout / stop).
- **Operate-only**: it can *use* every tool but cannot *create or edit*:
  - No rig creation/editing, no sequence rename/delete, no destructive actions.
  - Sequence/rig selection is allowed (load a saved one), editing is not.
- Same **orchestrator authentication/gating** as `/control` (only the room owner).
- Same realtime events as the desk — this is a thin alternate UI over the existing
  control logic, not a new control protocol.

---

## UI / UX

- Mobile/tablet-first layout: large touch targets, minimal text entry, no tiny sliders
  where a stepper works better.
- Tab bar identical in meaning to the desk (Devices / Visuals).
- Reuse the desk control components in an "operate" mode that hides CRUD affordances
  (flag like `mode="operate"` or compose only the action sub-components).
- Should not show editor-only panels (save/overwrite sequence, rig editor links, draft
  banners).

---

## Implementation phases

### Phase 1 — Route + auth + shell

- [ ] New route under `(control)` with orchestrator gating (same as `/control`).
- [ ] Two-tab touch shell.

### Phase 2 — Reuse Devices tools (operate-only)

- [ ] Lights, pattern selection from saved sequences, text/GIF to players, torch, device
      targeting — reusing existing components with CRUD hidden.

### Phase 3 — Reuse Visuals tools (operate-only)

- [ ] Art/palette/logo/show-name, custom text/QR to surface, live-call controls — reusing
      the components from [02](./02-visuals-desk-controls.md) and the lifted live-call
      state from [03](./03-live-call-state-persistence.md).

### Phase 4 — Touch polish

- [ ] Large hit targets, orientation handling, prevent accidental destructive paths.

---

## Files to touch

| Path | Change |
| --- | --- |
| `web/app/(control)/room/[code]/control-device/page.tsx` | New operate-only route |
| `web/components/glow/visuals-tab.tsx` + Devices components | Add an `operate` mode (hide CRUD) |
| `web/lib/glow/` | Reuse lifted live-call hook/provider ([03](./03-live-call-state-persistence.md)) |

---

## Acceptance criteria

- The DJ can fully run a live session from a device/tablet: lights, effects, text/GIF to
  players, torch, art/palette/logo, custom text/QR to the surface, and live call.
- No create/edit/delete of rigs or sequences is reachable from this surface.
- Only the room's orchestrator can open it (same gating as `/control`).
- Actions reflect on players and the visuals surface exactly like the desktop desk.
