# 02 — Visuals Desk Controls & Preview

## Summary

The Visuals tab of the control desk (`web/components/glow/visuals-tab.tsx`) is missing
live controls that the demo proved necessary:

1. **Custom text to the surface** — a button to send custom text overlays to the visuals
   surface (independent from the Play-Devices media channel; see
   [01](./01-visuals-surface-fixes.md) §3).
2. **Live QR control** — show/hide and control how the QR is displayed on the surface
   (periodic vs permanent, size/position) **at runtime**, not only via the rig editor.
3. **Rig "show name"** — a display name distinct from the internal rig name (e.g. internal
   `rig1` → shown `DJ Rig1`), plus the logo, rendered on the surface.
4. **Visuals preview** — an embedded preview of the surface in the desk, like the one in
   the Play-Devices tab (`pattern-sequence-preview.tsx`).

These build on the **media channel separation** from
[01](./01-visuals-surface-fixes.md): the surface gets its own text/media events instead of
mirroring player media.

---

## Concepts & data model

### Rig display name

- Add `displayName` to the rig. Either a first-class column in
  `web/lib/db/schema.ts` (`rigs.display_name`) or inside `console_config`/`metadata` for a
  zero-migration path. Prefer a real column for clarity.
- Surface renders `displayName` (fallback to `name`) alongside the logo.

### Live QR config (runtime)

Reuse the existing `console_config.qrConfig` shape from the rig editor (interval,
duration, "Always"). The desk should be able to **override it live** for the current
session without editing the rig.

---

## Realtime topics & events (new, surface-only)

| Direction | Event | Payload |
| --- | --- | --- |
| desk → server | `orchestrator:visuals_set_text` | `{ roomCode, text, mode, speed, colorHex, fontSize, loop }` |
| desk → server | `orchestrator:visuals_clear_text` | `{ roomCode }` |
| desk → server | `orchestrator:visuals_set_qr` | `{ roomCode, qrConfig }` |
| desk → server | `orchestrator:visuals_set_display` | `{ roomCode, displayName, logo }` |
| server → surface | `visuals:text` / `visuals:text_clear` | mirror of the text payload |
| server → surface | `visuals:qr` | `{ qrConfig }` |
| server → surface | `visuals:scene` (extended) | include `displayName` |

All surface state must be stored in `room.lastVisualsScene` for late-join replay.

> These are **separate** from the `orchestrator:media_*` / `visuals:media` events used for
> Play Devices, which after [01](./01-visuals-surface-fixes.md) no longer reach the
> surface.

---

## UI / UX (desk · Visuals tab)

- **Custom text** card: input + mode (marquee / word-by-word / grid), speed, color,
  font size, loop; Send / Clear buttons. Reuse the sequenced-text renderer used elsewhere.
- **QR control** card: toggle show/hide, periodic vs permanent, interval/duration (hidden
  when permanent), position/size. Mirrors the rig editor controls but applies live.
- **Show name + logo** field: editable display name for the session; preview shows it.
- **Visuals preview** panel: embedded canvas using `glow-visuals` engine that reflects the
  current art + palette + logo + display name + text/QR overlays in real time, mirroring
  the Play-Devices `pattern-sequence-preview.tsx` ergonomics (play/pause, orientation,
  viewport).

---

## Implementation phases

### Phase 1 — Rig show name

- [ ] Add `displayName` (schema + rig editor input + propagation into the visuals scene).
- [ ] Surface renders display name + logo.

### Phase 2 — Live custom text to surface

- [ ] Desk text card + `orchestrator:visuals_set_text` / `_clear_text`.
- [ ] Server handlers (gated, store in `lastVisualsScene`) emit `visuals:text` to
      `visuals:{code}` only.
- [ ] Surface renders the text overlay (reuse `VisualsSequencedTextRenderer`).

### Phase 3 — Live QR control

- [ ] Desk QR card + `orchestrator:visuals_set_qr`.
- [ ] Surface applies QR config live (periodic/permanent).

### Phase 4 — Embedded visuals preview

- [ ] Preview component (mirror of `pattern-sequence-preview.tsx`) using `glow-visuals`.

---

## Files to touch

| Path | Change |
| --- | --- |
| `web/components/glow/visuals-tab.tsx` | Text/QR/show-name cards + preview |
| `web/components/glow/` | New visuals preview component |
| `web/app/(account)/rigs/.../page.tsx` (rig editor) | `displayName` input |
| `web/lib/db/schema.ts` | `rigs.display_name` (if first-class) |
| `realtime/src/room-manager.ts` | New `orchestrator:visuals_*` handlers + `lastVisualsScene` |
| `realtime/src/types.ts` | Extend `lastVisualsScene` (text, qr, displayName) |
| `web/app/(immersive)/room/[code]/visuals/page.tsx` | Render text/qr/displayName from surface events |

---

## Acceptance criteria

- DJ can send custom text to the surface and clear it, without it touching player screens.
- DJ can show/hide and reconfigure the QR on the surface live.
- The rig's display name (e.g. `DJ Rig1`) and logo show on the surface; internal name
  stays `rig1`.
- The desk shows a live preview of the surface comparable to the Play-Devices preview.
- A late-joining surface receives current text/QR/display name via `lastVisualsScene`.
