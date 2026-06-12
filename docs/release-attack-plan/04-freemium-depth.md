# Release Attack Plan — Part 04: Freemium Depth

**Status:** pending  
**Prerequisites:** [03-billing-branding.md](./03-billing-branding.md) done  
**Blocks:** 07 (raffle branding uses same patterns)  
**Related:** [Last-sprint-for-release.md](../Last-sprint-for-release.md) §5–§6, [visuals-architecture.md](../visuals-architecture.md)

---

## Summary

Free users **try everything cool** with **depth limits**, not hard hides. Preview locked
visuals in desk; emit one per mode type; GIF featured page only; live call & polls in
**test mode** only.

---

## Goals

1. Visuals: preview vs emit; optional per-mode slot limits.
2. GIF: `gif_search_mode: featured_page1 | full` on Klipy proxy.
3. Test mode flags for WebRTC + polls on Free.
4. PlanGate explains depth limits with correct upgrade tier (Venue for GIF full, etc.).

---

## Implementation checklist

### A. Entitlements

- [ ] Add / wire in seed:
  - `gif_search_mode`: `featured_page1` | `full`
  - `visuals_emit_slots_per_mode`: number (Free=1, Party=2, Venue=999 or -1 unlimited)
  - `live_call_test_mode_only`: boolean (Free/Party true)
  - `poll_production_enabled`: boolean or derive from device scale

### B. Visuals depth

- [ ] Desk art/mode picker: locked items show **Preview** badge
- [ ] `VisualsPreview`: allow local preview for locked modes
- [ ] Server: reject `orchestrator:visuals_set_mode` / emit when over slot or locked mode
- [ ] Track per-room which modes have been **emitted** this session (server or client sync)

### C. GIF

- [ ] `web/app/api/klipy/search/route.ts` — if `featured_page1`, force featured endpoint / page=1 only
- [ ] media-panel / pattern-sequence GIF tab — PlanGate when searching page 2+

### D. Test mode — live call

- [ ] Free: desk shows layout preview; block `webrtc:start` production on server
- [ ] UI label: “Preview — upgrade to Pro for live mosaic”

### E. Test mode — polls (stub if full polls in part 07)

- [ ] Desk: build question + fake bars locally on Free
- [ ] Block `player:poll_vote` / production poll open until Party+ and device headroom
- [ ] Or: minimal poll state in room-manager with production gate only

### F. Other depth

- [ ] `effect_layering`: keep single-effect on Free/Party; multi on Venue+
- [ ] `sequenced_text`: char limit on Free if desired

---

## Files to touch

| Path | Change |
| --- | --- |
| `web/lib/entitlements.ts` | seed values |
| `realtime/src/room-manager.ts` | visuals mode, GIF N/A, webrtc, poll gates |
| `web/components/glow/visuals-tab.tsx` | preview vs emit |
| `web/components/glow/visuals-preview.tsx` | preview locked |
| `web/app/api/klipy/search/route.ts` | featured limit |
| `web/components/glow/media-panel.tsx` | GIF PlanGate |
| `web/components/glow/live-call-controls.tsx` | test mode UX |

---

## Acceptance criteria

1. Free user can preview YouTube/3D in desk but cannot push to real surface (or 1 mode total emit).
2. Free GIF search never returns page 2; Venue gets full search.
3. Free live call: preview only; Pro publishes to surface.
4. No feature **removed** when upgrading Free → Party (audio reactive, flash, etc.).

---

## Out of scope

- Full live polls feature spec (part 07), song requests, raffle.
