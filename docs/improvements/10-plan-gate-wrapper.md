# Improvement 10 — PlanGate + Upgrade Modal

**Status:** done (Release Attack Plan Part 02)  
**Related:** [02-plan-gate.md](../release-attack-plan/02-plan-gate.md), [plans-marketing-strategy.md](../plans-marketing-strategy.md) §9

---

## Summary

Unified monetization UX: one **`PlanGate`** wrapper and **`UpgradeModal`** replace scattered
"Feature Gated" overlays. Limits show **marketing plan name**, **price**, and **Stripe Checkout**
with return to the active control desk or `/room/new`.

---

## Components

| Path | Role |
| --- | --- |
| `web/lib/plans/plan-meta.ts` | `planCode` → Party/Venue/Pro, price, device cap, feature → min plan |
| `web/lib/plans/use-plan-gate.ts` | Hook: merged entitlements + gate state + copy |
| `web/components/glow/plan-gate.tsx` | Wrapper: `allowed` \| `limited` \| `preview` \| `blocked` |
| `web/components/glow/upgrade-modal.tsx` | Contextual modal + checkout / portal CTA |
| `web/components/glow/device-cap-banner.tsx` | Control desk banner at `maxDevices` |

### Gate states

| State | Behavior |
| --- | --- |
| `allowed` | Renders children normally |
| `limited` | Children + inline upgrade banner |
| `preview` | Same as limited (desk-only preview; server blocks emit) |
| `blocked` | Overlay + upgrade modal on click |

---

## Feature → minimum plan

| Feature key | Plan | Marketing name |
| --- | --- | --- |
| `max_devices`, `matrix_too_large`, `sequencedText`, `deviceFlashControl`, `visualsSurface` | `plus_25` | Party |
| `customMediaUpload`, `gifBroadcast`, `effect_layering` | `plus_50` | Venue |
| `webrtcLiveCall` | `pro` | Pro |

---

## Checkout deep link

- `checkoutAction` / `createCheckoutSession` accept `returnUrl` (path only, must start with `/`).
- Success handler (`/api/stripe/checkout`) redirects to `returnUrl?checkout=success`.
- Active subscribers route to Stripe Customer Portal with target plan instead of new checkout.
- Control desk and `/room/new` revalidate `/api/user` and `/api/team` on `checkout=success`.

---

## Migrated surfaces

- `media-panel.tsx` — image / text / GIF tabs
- `pattern-sequence-editor.tsx` — sequenced text, GIF, effect layering banner
- `torch-controls.tsx` — device flash
- `live-call-controls.tsx` — Pro upsell card
- `visuals-tab.tsx` — visuals surface upsell (when entitlement false)
- `room/new/page.tsx` — `matrix_too_large` modal (client + server)
- `control/page.tsx` — device cap banner

---

## Acceptance criteria

1. Free user at device cap sees **Party — €2.99/mo** modal, not generic "Feature Gated".
2. Checkout from modal completes and refreshes entitlements on return.
3. No duplicate `renderGatedOverlay` in migrated components.
4. `matrix_too_large` on room create shows upgrade modal.

---

## Out of scope (Part 03+)

- Billing page marketing rewrite
- Logo / QR branding enforcement
- PostHog `billing_upgrade_modal_shown` (Part 05)
