# Release Attack Plan — Part 03: Billing & Branding

**Status:** done  
**Prerequisites:** [02-plan-gate.md](./02-plan-gate.md) done  
**Blocks:** 04  
**Related:** [plans-marketing-strategy.md](../plans-marketing-strategy.md) §5–§8, [Last-sprint-for-release.md](../Last-sprint-for-release.md) §4, §8

---

## Summary

Rewrite **`/billing`** so it sells **Stage / Floor / Crowd / Scale**, not raw specs. Enforce
**Venue+ white-label**: custom rig logo and QR/socials; Free/Party show **Glow Rave**
branding on surface, QR, and share panels.

---

## Goals

1. Billing cards match marketing strategy (Party / Venue ⭐ / Pro).
2. Honest matrix copy (`max matrix cells`, not misleading 10×10).
3. Server + UI enforce `custom_rig_logo` / `custom_qr_branding`.
4. PlanGate modal uses same plan metadata as billing.

---

## Implementation checklist

### A. Billing page

- [ ] Refactor `web/app/(account)/billing/page.tsx`:
  - Section blocks: Stage, Floor, Crowd, Scale
  - Marketing names (Party / Venue / Pro)
  - **Recommended** badge on Venue
  - CTAs: “Scale your party” / “Your brand on stage” / “Live production”
- [ ] Show `max_matrix_cells` alongside `max_devices`
- [ ] List key depth features (YouTube/3D, GIF, layering) per tier

### B. Branding enforcement — UI

- [ ] When `!customRigLogo`: rig editor + visuals logo toggle shows Glow asset only
- [ ] When `!customQrBranding`: `RoomShareControls` / `RoomQrPanel` hide host socials; Glow branding
- [ ] `/api/rooms/[code]/share-info` — strip socials for Free/Party

### C. Branding enforcement — server

- [ ] `orchestrator:visuals_set_logo` — reject or replace with Glow logo if not entitled
- [ ] Rig PATCH logo path — reject upload/set if not entitled (or ignore field)
- [ ] QR config events — force Glow join URL branding when not entitled

### D. Assets

- [ ] Confirm default Glow logo path for surface/rig/QR (reuse `GlowLogo` or static asset in `public/`)

### E. Stripe / seed

- [ ] Update plan `description` fields in seed for new copy
- [ ] Party price if changed in part 01

### F. Docs

- [ ] Update [product-intent.md](../product-intent.md) § Plans (short pointer to attack plan)
- [ ] Update [plans.md](../plans.md) branding rows

---

## Files to touch

| Path | Change |
| --- | --- |
| `web/app/(account)/billing/page.tsx` | rewrite layout |
| `web/components/glow/room-share-controls.tsx` | branding gate |
| `web/components/glow/room-qr-panel.tsx` | branding gate |
| `web/app/api/rooms/[code]/share-info/route.ts` | strip socials |
| `realtime/src/room-manager.ts` | logo/QR payload enforcement |
| `web/app/(account)/rigs/page.tsx` | logo upload gate |
| `web/components/glow/visuals-tab.tsx` | logo toggle gate |

---

## Acceptance criteria

1. Free/Party billing card shows Glow branding note; Venue shows “Your logo & QR socials”.
2. Free team: share QR modal shows no custom Instagram/social links.
3. Venue team: rig logo appears on surface when enabled.
4. Upgrade from Free to Venue via billing removes Glow-only restriction without code deploy.

---

## Out of scope

- Visuals mode depth limits (part 04), GIF featured page (part 04), raffle winner branding (part 07).
