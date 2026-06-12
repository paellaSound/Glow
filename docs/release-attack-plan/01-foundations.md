# Release Attack Plan — Part 01: Foundations

**Status:** done  
**Prerequisites:** none  
**Blocks:** all other parts  
**Related:** [Last-sprint-for-release.md](../Last-sprint-for-release.md) §3–§5, [08-qa-regression-checklist.md](../improvements/08-qa-regression-checklist.md)

---

## Summary

Fix the product **source of truth** and **server enforcement** so plans do not lie: matrix
aligned with device caps, no regressive upgrades, seed synced to docs. Run full regression
QA. After this part, Glow is safe for **private beta**.

---

## Goals

1. Close open pricing/entitlement decisions (record in docs).
2. Update `PLAN_SEED_DATA` + types (web + realtime).
3. Enforce scale rules on server (`max_devices`, `rows×cols ≤ max_matrix_cells`).
4. Pass end-to-end QA on existing features.

**Not in this part:** PlanGate, billing redesign, PostHog, new features.

---

## Decisions to lock (checkbox)

- [ ] Party price: **299 cents/mo** (or document alternative)
- [ ] Free: `max_devices=10`, `max_matrix_cells=10`, grid examples `5×2`, `3×3`
- [ ] Party: `25` devices, `5×5` max grid
- [ ] Venue: `50` devices, `custom_grid_size=true`
- [ ] **`audio_reactive: true`** on all tiers (fix Party regression)
- [ ] Poll production floor: Party+ (document only — implement in part 04/07)
- [ ] Record decisions in [00-index.md](./00-index.md) status + [Last-sprint-for-release.md](../Last-sprint-for-release.md) §10

---

## Implementation checklist

### A. Entitlement keys & seed

- [ ] Add to `DEFAULT_ENTITLEMENTS` (`web/lib/entitlements-defaults.ts`):
  - `max_matrix_cells` (default = same as `max_devices` pattern)
  - Stub keys for later parts: `custom_rig_logo`, `custom_qr_branding`, `gif_search_mode` (safe defaults)
- [ ] Add `KEY_MAP` entries in `web/lib/entitlements.ts`
- [ ] Extend `PlanEntitlements` in **both** `web/lib/entitlements.ts` and `realtime/src/types.ts`
- [ ] Update every tier in `PLAN_SEED_DATA`:
  - Fix `max_grid_rows/cols` per [Last-sprint-for-release.md](../Last-sprint-for-release.md) §3
  - Set `max_matrix_cells` per tier
  - Fix `audio_reactive: true` on Party
  - Party price cents if decided
- [ ] Mirror mapping in `realtime/src/db.ts` if needed
- [ ] Run `pnpm db:seed` on dev/staging

### B. Server enforcement

- [ ] `realtime/src/room-manager.ts` — on `orchestrator:create_room`:
  - Reject if `matrix.rows * matrix.cols > entitlements.maxMatrixCells`
  - Clamp rows/cols to entitlements (already partial — verify)
- [ ] Reject `player:join_room` when device count would exceed `maxDevices`
- [ ] Return clear error codes for UI/PlanGate later (`plan_limit_hit`, `matrix_too_large`)

### C. Client validation (light)

- [ ] `/room/new` — clamp rows/cols UI to plan; show `max_matrix_cells` in helper text
- [ ] Prevent create when `rows * cols > maxMatrixCells`

### D. Docs sync (minimal)

- [ ] Update [plans.md](../plans.md) §1 table (prices, matrix note)
- [ ] Mark part 01 decisions in [00-index.md](./00-index.md)

### E. QA

- [ ] Run [08-qa-regression-checklist.md](../improvements/08-qa-regression-checklist.md)
- [ ] Free: create 3×3 room, join 2 devices, preset works
- [ ] Party (seed/test team): 5×5 create succeeds; 6×5 rejected or clamped
- [ ] Stripe test checkout still updates plan
- [ ] House ad shows on Free create/join

---

## Files to touch

| Path | Change |
| --- | --- |
| `web/lib/entitlements-defaults.ts` | New keys + defaults |
| `web/lib/entitlements.ts` | KEY_MAP, PLAN_SEED_DATA, type |
| `realtime/src/types.ts` | PlanEntitlements sync |
| `realtime/src/db.ts` | Entitlement row mapping |
| `realtime/src/room-manager.ts` | Scale enforcement |
| `web/app/(control)/room/new/page.tsx` | Matrix validation UX |
| `docs/plans.md` | Descriptive table |
| `docs/release-attack-plan/00-index.md` | Status |

---

## Acceptance criteria

1. Party tier has `audio_reactive: true` in DB seed and room snapshot.
2. Creating a room with `rows×cols > max_matrix_cells` fails on server (not UI-only).
3. Joining when at `max_devices` fails on server with structured reason.
4. QA checklist passes for create → join → preset → control desk.
5. No unrelated feature work in this PR.

---

## Out of scope

- PlanGate modal, billing copy, branding enforcement, GIF limits, PostHog, raffle.
