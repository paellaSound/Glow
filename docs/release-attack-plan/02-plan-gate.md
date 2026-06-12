# Release Attack Plan — Part 02: PlanGate

**Status:** done  
**Prerequisites:** [01-foundations.md](./01-foundations.md) done  
**Blocks:** 03, 04  
**Related:** [plans-marketing-strategy.md](../plans-marketing-strategy.md) §9, [Last-sprint-for-release.md](../Last-sprint-for-release.md) §7.2

---

## Summary

One **`PlanGate`** wrapper and **upgrade modal** replace scattered gated overlays. When a
user hits a limit, show **which plan**, **price**, and **Stripe Checkout** — return to the
control desk after pay.

---

## Goals

1. `<PlanGate />` component with states: `allowed` | `limited` | `preview` | `blocked`.
2. `<UpgradeModal />` with contextual copy + `checkoutAction` / portal.
3. Migrate existing overlays to PlanGate.
4. Server errors from part 01 surface friendly modal where possible.

**Not in this part:** Billing page layout (part 03), depth limits (part 04).

---

## Spec: PlanGate API (sketch)

```tsx
<PlanGate
  feature="max_devices"
  requiredPlan="plus_25"
  state="blocked"           // or derived from entitlements
  limitReason="10 devices connected"
  onUpgrade={() => ...}
>
  <DeviceList />
</PlanGate>
```

Modal copy pattern:

- **Title:** `{limitReason}`
- **Body:** `{requiredPlan} supports up to {N} devices.`
- **CTA:** `Activate Party — €2.99/mo`
- **Secondary:** `Continue with limits`

---

## Implementation checklist

### A. Core components

- [ ] Create `web/components/glow/plan-gate.tsx`
- [ ] Create `web/components/glow/upgrade-modal.tsx`
- [ ] Create `web/lib/plans/plan-meta.ts` — map `planCode` → display name, price cents, CTA label
- [ ] Hook: `usePlanGate(feature)` reading merged entitlements

### B. Checkout integration

- [ ] Reuse `checkoutAction` from `web/lib/payments/actions.ts`
- [ ] Pass `returnUrl` back to current control desk URL
- [ ] If already subscribed, route to `customerPortalAction` with target plan

### C. Migrate existing gates

- [ ] `web/components/glow/media-panel.tsx` — remove local `renderGatedOverlay`
- [ ] `web/components/glow/pattern-sequence-editor.tsx`
- [ ] `web/components/glow/torch-controls.tsx` (if still gated — may be allowed all tiers)
- [ ] `web/components/glow/live-call-controls.tsx`
- [ ] Visuals tab upsell when `!visualsSurface` (if applicable)

### D. Scale triggers (priority)

- [ ] Device list / join at cap — listen for server `plan_limit_hit` or pre-check count
- [ ] Room create when matrix too large (fallback if user bypasses UI)

### E. Docs

- [ ] Add `docs/improvements/10-plan-gate-wrapper.md` (extract from this part when done)

---

## Files to touch

| Path | Change |
| --- | --- |
| `web/components/glow/plan-gate.tsx` | new |
| `web/components/glow/upgrade-modal.tsx` | new |
| `web/lib/plans/plan-meta.ts` | new |
| `web/components/glow/media-panel.tsx` | migrate |
| `web/components/glow/pattern-sequence-editor.tsx` | migrate |
| `web/lib/payments/actions.ts` | returnUrl support |
| `web/lib/payments/stripe.ts` | verify success redirect |

---

## Acceptance criteria

1. Free user at 10 devices sees modal suggesting Party with price — not generic “Feature Gated”.
2. Checkout from modal completes and refreshes entitlements in active desk (reload or SWR mutate).
3. All migrated panels use PlanGate — no duplicate overlay markup.
4. Server-only rejection still possible; client shows modal on known error codes.

---

## Out of scope

- Billing page restructure, logo/QR branding, GIF featured-only, PostHog events (add `billing_upgrade_modal_shown` in part 05).
