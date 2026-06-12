# Release Attack Plan — Index

**Purpose:** seven sequential, self-contained work packages to ship Glow to public production.  
**Pick one part per chat**, implement, verify acceptance criteria, then move on.

**Strategy docs (read once):**

- [Last-sprint-for-release.md](../Last-sprint-for-release.md) — product rules & entitlement matrix
- [plans-marketing-strategy.md](../plans-marketing-strategy.md) — positioning & copy
- [visuals-architecture.md](../visuals-architecture.md) — Stage vs Floor model

---

## How to use

1. Open the next part doc below.
2. Confirm **Prerequisites** are done (previous part acceptance criteria).
3. Execute the **Implementation checklist** in order.
4. Run **Acceptance criteria** + [08-qa-regression-checklist.md](../improvements/08-qa-regression-checklist.md) for affected flows.
5. Mark part **done** in the status table and start the next part.

Each part is scoped to **one focused implementation session** (roughly 1–2 days).

---

## Parts (strict order)

| Part | Doc | Goal | Release gate |
| --- | --- | --- | --- |
| **01** | [01-foundations.md](./01-foundations.md) | Close decisions, fix seed, server scale rules, regression QA | **Private beta OK** |
| **02** | [02-plan-gate.md](./02-plan-gate.md) | Unified `PlanGate` + upgrade modal + checkout deep link | Monetization UX |
| **03** | [03-billing-branding.md](./03-billing-branding.md) | Billing page rewrite + Venue white-label (logo/QR) | Can sell honestly |
| **04** | [04-freemium-depth.md](./04-freemium-depth.md) | Try-everything limits: visuals, GIFs, test mode | Free tier complete |
| **05** | [05-posthog.md](./05-posthog.md) | PostHog events + error tracking | **Public prod gate** |
| **06** | [06-onboarding.md](./06-onboarding.md) | In-app first-party onboarding | Activation |
| **07** | [07-raffle-post-launch.md](./07-raffle-post-launch.md) | Raffle mode + post-launch backlog | v1.1+ |

```txt
01 Foundations
    ↓
02 PlanGate ──────────────┐
    ↓                     │
03 Billing + branding     │
    ↓                     │
04 Freemium depth         │
    ↓                     ├── can overlap 05 after 03
05 PostHog                │
    ↓                     │
06 Onboarding ────────────┘
    ↓
07 Raffle + post-launch
    ↓
🚀 Public release (after 01–06; 07 optional for v1.0)
```

**Minimum public release:** parts **01 → 06** complete. Part **07** raffle can ship in v1.0 if time allows; song requests / live polls stay in 07 as post-launch.

---

## Status

| Part | Status | Notes |
| --- | --- | --- |
| 01 | done | Seed + server scale enforcement; private beta OK |
| 02 | done | PlanGate + UpgradeModal + checkout deep link |
| 03 | done | Billing marketing rewrite + Venue white-label |
| 04 | done | freemium depth shipped |
| 05 | pending | next — PostHog (01–04 done) |
| 06 | pending | blocked by 05 recommended |
| 07 | pending | blocked by 04 |

---

## v1.0 vs v1.1 scope

| In v1.0 (parts 01–06) | In v1.1 (part 07+) |
| --- | --- |
| Correct entitlements + server enforcement | Raffle + WebRTC winner call |
| PlanGate + billing + branding | Song requests (Venue+) |
| Freemium depth (visuals, GIF featured) | Live polls production |
| PostHog core + errors | Annual pricing, MP4 house ad |
| Onboarding checklist in-app | Full docs sync (`plans.md`) |

---

## Resolved defaults (part 01 confirms)

These are the recommended defaults until changed in part 01:

| Decision | Default |
| --- | --- |
| Party price | €2.99/mo (299 cents) — update seed |
| Free matrix | `rows × cols ≤ 10` strict |
| Poll production | Party+ (scale); Free = test UI only |
| Venue WebRTC | 0 publishers until Pro |
| Marketing names | Party / Venue / Pro in UI; DB codes unchanged |
