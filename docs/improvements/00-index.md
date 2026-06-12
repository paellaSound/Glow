# Glow — Post-demo Improvements Index

This folder holds **post-demo fixes and enhancements** found during the first full
end-to-end run (2026-06-08). Each doc is self-contained and written to be picked up in a
fresh chat to produce an implementation plan, then build and verify step by step — same
philosophy as [../features/00-feature-index.md](../features/00-feature-index.md).

These are improvements on top of already-shipped features (01–09), not new features.

Read first:

- [../architecture.md](../architecture.md) — v2 system architecture.
- [../features/00-feature-index.md](../features/00-feature-index.md) — base feature specs.

---

## How to use these docs

Each doc has:

- **Summary** — what's wrong / missing.
- **Root cause** — confirmed diagnosis with file references (where applicable).
- **Realtime topics & events** — new/changed events (where applicable).
- **Fix / implementation phases** — shippable, checkbox steps.
- **Files to touch** — concrete paths.
- **Acceptance criteria** — how to verify.

Turn the phases into a plan and execute one doc per chat.

---

## Catalog

| # | Improvement | Doc | Surface | Touches | Complexity |
| --- | --- | --- | --- | --- | --- |
| 01 | Visuals surface fixes (room-ended, palette/scene apply, media independence) | [01](./01-visuals-surface-fixes.md) | Visuals surface + realtime | `room-manager.ts`, visuals page | Medium |
| 02 | Visuals desk controls & preview (custom text, QR control, rig show name, preview) | [02](./02-visuals-desk-controls.md) | Control desk · Visuals tab | `visuals-tab.tsx`, rig editor, realtime | Medium |
| 03 | Live-call state persistence across desk tabs | [03](./03-live-call-state-persistence.md) | Control desk | `control/page.tsx`, live-call hook | Medium |
| 04 | Play devices fixes (initial render, preview media, mic, torch, fullscreen, socials) | [04](./04-play-devices-fixes.md) | Player | play page, webrtc, torch, preview, realtime | Medium |
| 05 | Control Device page (mobile/tablet operate-only) | [05](./05-control-device-page.md) | New surface | new route, reused controls | High |
| 06 | Pattern sequence live sync & preview parity | [06](./06-pattern-sequence-live-sync.md) | Control desk · Play Devices | `pattern-sequence-editor.tsx`, preview, visual-engine | Medium |
| 07 | Orchestrator auth hardening (rejoin) | [07](./07-orchestrator-auth-hardening.md) | Realtime · Control desk | `room-manager.ts`, `types.ts`, control desks | Medium · **security** |
| 08 | QA / regression checklist (post-demo) | [08](./08-qa-regression-checklist.md) | All | end-to-end verification | — |
| 10 | PlanGate + upgrade modal (monetization UX) | [10](./10-plan-gate-wrapper.md) | Control desk + billing | `plan-gate.tsx`, `upgrade-modal.tsx`, `plan-meta.ts` | Medium |
| 11 | PostHog analytics & error tracking (production gate) | [../posthog-production-analytics.md](../posthog-production-analytics.md) | Web + Realtime | `web/lib/analytics/*`, `realtime/src/analytics/*` | Medium |

---

## Recommended order

`01 → 06 → 02 → 03 → 04 → 05 → 07`

01–06 shipped (high-impact live bugs + controls + mobile surface). **07 is a security fix
(do it next, before relying on Phone Mode in production):** the orchestrator `rejoin_room`
must validate token + ownership.

---

## Status

| # | Improvement | State |
| --- | --- | --- |
| 01 | Visuals surface fixes | **done** (2026-06-09) — room-ended on surface, reliable palette/art via `setInput`, media channel separated; reworked to authoritative `visualsState`/`playerVisualState` (versioned) + snapshot on join ACK |
| 02 | Visuals desk controls & preview | **done** (2026-06-09) — embedded visuals preview + Mix/Out-of-Mix cards for logo/text/QR; live `visuals_set_text`/`visuals_set_qr` + rig display name; QR natural-language periodic timer |
| 03 | Live-call state persistence | **done** (2026-06-09) — Option A: `use-live-call-desk` context/provider at control page + `orchestrator:get_live_call_state` server resync; `live-call-controls` consumes lifted state |
| 04 | Play devices fixes | **done** (2026-06-09) — E1 verified (playerVisualState replay), E2 media in preview, E3 video-only call, E4 torch/live-call conflict + iOS note, E5 fullscreen support gate, E6 DJ socials at start/end via room state + share-info |
| 05 | Control Device page | **done** (2026-06-09) — touch-first operate-only console (`mode="operate"` hides CRUD), `control-device` route + orchestrator rejoin, "Phone Mode" QR on desktop desk |
| 06 | Pattern sequence live sync & preview parity | **done** (2026-06-09) — palette/effect edits push live (200ms debounce); preview Split vs Single-Device modes via shared device render path |
| 07 | Orchestrator auth hardening (rejoin) | **done** (2026-06-09) — `RoomState.ownerUserId`; `rejoin_room` validates `accessToken` + owner/team; both desks pass the token and redirect on Unauthorized/Forbidden |
| 08 | QA / regression checklist | `checklist` — run end-to-end before next live use |
