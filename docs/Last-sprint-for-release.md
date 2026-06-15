# Last Sprint for Release — Glow MVP

> ⚠️ **SUPERSEDED (2026-06-15) para el modelo de planes.** La matriz de feature-gating por
> tier de este doc ya no aplica: ahora se cobra solo por escala (devices) + branding y todas
> las features están desbloqueadas en todos los planes. Fuente de verdad actual:
> **[plans.md](./plans.md)**.

**Status:** planning · **Target:** release-ready product definition + implementation backlog  
**Execution order:** [release-attack-plan/00-index.md](./release-attack-plan/00-index.md) — **7 parts, one per chat**  
**Supersedes / updates:** [plans.md](./plans.md), [product-intent.md](./product-intent.md) § Plans, billing UX  
**Related:** [release-attack-plan/00-index.md](./release-attack-plan/00-index.md), [plans-marketing-strategy.md](./plans-marketing-strategy.md), [visuals-architecture.md](./visuals-architecture.md), [posthog-production-analytics.md](./posthog-production-analytics.md), [improvements/00-index.md](./improvements/00-index.md), [features/00-feature-index.md](./features/00-feature-index.md)

---

## 1. Product philosophy (release)

Glow monetizes **server scale** (concurrent connected devices). Feature gating uses three layers:

| Layer | Purpose | Examples |
| --- | --- | --- |
| **Scale** | Direct server cost | `max_devices`, session duration, matrix cells |
| **Depth** | Try everything, limited use | 1 visual per mode, GIF featured page only, preview locked arts |
| **Branding** | Free = Glow self-promotion | Glow logo on surface/raffle; QR without host socials until Venue+ |

**Free tier mindset:** users can experience all non-commercial “wow” features in limited form. Restrictions promote Glow (logo, QR) instead of hiding the product.

**Impulse upgrade:** `PlanGate` wrapper + modal with plan name + price → Stripe Checkout in-context.

Tagline for plans: **“Scale as much as you need.”**

See [plans-marketing-strategy.md](./plans-marketing-strategy.md) for positioning, copy, and billing UX.

---

## 2. Plans (release names)

| Code | Marketing name | Price (TBD seed) | Intent |
| --- | --- | --- | --- |
| `free` | Free | €0 | Full taste, Glow branding, strict scale |
| `plus_25` | **Party** | Low (impulse) | Scale bump at the party moment |
| `plus_50` | **Venue** | Mid | Host branding + crowd tools |
| `pro` | **Pro** | High | Events, WebRTC at scale, raffle + live call |

Stable DB codes stay `plus_25` / `plus_50`; UI uses Party / Venue / Pro.

---

## 3. Scale entitlements (aligned matrix ↔ devices)

**Rule:** `matrix.rows × matrix.cols ≤ max_matrix_cells` where `max_matrix_cells === max_devices`.

A 10×10 grid with a 25-device cap is invalid — the matrix must never imply more slots than connected devices allowed.

| Entitlement | Free | Party | Venue | Pro |
| --- | --- | --- | --- | --- |
| `max_devices` | 10 | 25 | 50 | 999 |
| `max_matrix_cells` | 10 | 25 | 50 | 999 |
| `max_grid_rows` | 5 | 5 | 10 | 31 |
| `max_grid_cols` | 5 | 5 | 10 | 31 |
| `custom_grid_size` | false | false | true | true |
| `max_room_duration_minutes` | 60 | 180 | 360 | 720 |
| `ads_enabled` | true | false | false | false |

**Valid grid examples:**

| Plan | Devices | Example grids |
| --- | --- | --- |
| Free | 10 | `5×2`, `2×5`, `3×3` (9 cells) |
| Party | 25 | `5×5` |
| Venue | 50 | `10×5`, `5×10`, `7×7` (49) |
| Pro | 999 | any rect with `rows×cols ≤ 999` |

**Implementation:** enforce in room create (`/room/new`), rig editor, and `realtime/src/room-manager.ts` on matrix resize.

**Billing copy:** show **devices** and **max matrix cells**, not misleading dimensions (e.g. never “10×10” when cap is 25 devices).

---

## 4. Branding entitlements (Venue+)

| Entitlement | Free | Party | Venue | Pro |
| --- | --- | --- | --- | --- |
| `custom_rig_logo` | false | false | true | true |
| `custom_qr_branding` | false | false | true | true |
| `raffle_winner_branding` | `glow` | `glow` | `host` | `host` |

When branding is off:

- Surface / rig logo slot shows **Glow Rave** asset only.
- Join QR shows **Glow branding** (no host social links).
- Raffle winner screen uses Glow logo + Glow palette.

Party keeps Glow branding — impulse upgrade is for **scale**, not white-label.

---

## 5. Depth entitlements (try everything, limit depth)

| Feature | Free | Party | Venue | Pro |
| --- | --- | --- | --- | --- |
| Visuals surface | ✅ limited | ✅ expanded | ✅ full | ✅ full |
| Visual modes emit | 1 per mode type | expanded | unlimited | unlimited |
| Locked arts/modes | preview in desk | preview | all emit | all emit |
| GIF search | featured page 1 | featured or partial | full Klipy | full |
| `effect_layering` | preview / single | single | multi | multi |
| `sequenced_text` | short / limited | ✅ | ✅ | ✅ |
| `device_flash_control` | ✅ | ✅ | ✅ | ✅ |
| `audio_reactive` | ✅ | ✅ | ✅ | ✅ |
| `max_rigs` | 1 | 3 | 10 | 50 |
| `max_pattern_sequences` | 1 | 3 | 10 | 50 |
| `max_live_call_devices` | 0 (test only) | 0 | 0–2 TBD | 6 |
| `max_raffle_winners` | 1 | 3 | configurable | configurable + WebRTC call |

**Visuals preview:** desk and `VisualsPreview` may render locked content; server rejects emit to the real surface until entitled.

**Never remove a feature when upgrading** (e.g. `audio_reactive` must stay true from Free upward).

---

## 6. Test mode (Free — no scale, no production)

Certain features are **tryable without a paid plan** via test/preview mode. They do not count as production use and stay within Free device limits.

| Feature | Test mode (Free) | Production |
| --- | --- | --- |
| **WebRTC live call** | Desk preview, simulated layout, ≤1 local publisher test | Pro: live mosaic on surface, up to `max_live_call_devices` |
| **Live poll** | Create question + preview UI / simulated bars in desk | **Live vote counting** requires a plan covering **expected voter devices** (Party+) |
| **Raffle** | 1 winner, Glow branding on winner device | Venue+: N winners, host branding; Pro: optional WebRTC call to winner |

**Poll monetization:** each vote is a connected player (server cost). Free can test the UX; launching a poll to the room requires upgrading when the orchestrator needs more devices than the current plan allows.

---

## 7. New features (this sprint)

### 7.1 Raffle mode — `docs/improvements/09-raffle-mode.md` (to create)

- DJ picks N winners from connected devices.
- Winner device: logo + custom win color/animation.
- Pro: optional WebRTC call to winner (“come on stage”).
- Gating: see §6 test vs production.

**Realtime (sketch):**

- Desk → `orchestrator:raffle_start { count, animationPreset?, useLiveCall?: boolean }`
- Server → winners: `device:raffle_won { logoUrl, palette, animation, liveCallOffer? }`

### 7.2 PlanGate wrapper — `docs/improvements/10-plan-gate-wrapper.md` (to create)

- Unified wrapper replacing ad-hoc overlays in `media-panel.tsx`, `torch-controls.tsx`, etc.
- States: `allowed` | `limited` | `preview` | `blocked`.
- Modal: specific limit hit + **minimum plan** + **price** + Stripe Checkout CTA.
- Server mirrors all gates in `room-manager.ts`.

### 7.3 Song requests — future — `docs/features/10-song-requests.md` (to create)

- **Venue+:** audience suggests tracks from device; DJ queue (pending / played / dismissed); public vote priority.

### 7.4 Live polls — future — `docs/features/11-live-polls.md` (to create)

- **Venue+:** question + N options; live count on surface.
- Free: test mode only (§6).
- Production: gated by device scale.

---

## 8. Billing page (release)

Per plan card, three blocks + scale footer:

1. **Stage (surface)** — modes, visuals limits, YouTube / 3D
2. **Floor (devices)** — presets, sequences, media, flash
3. **Crowd** — reactions, raffle, polls (test vs live), song requests (Venue+)
4. **Scale** — devices, max matrix cells, session duration, ads

CTAs:

| Plan | CTA |
| --- | --- |
| Party | “Scale your party” |
| Venue | “Your brand on stage” |
| Pro | “Live production” |

Venue is the **recommended** anchor plan (full dual-screen DJ stack).

---

## 8.1 House ad (Free tier — `mock-ad.tsx`)

Free plan shows a **short sponsored slot** before room create and before room join
(`web/components/glow/mock-ad.tsx`). For release, replace the orange placeholder with a
**Glow-owned bumper video** (no third-party ad network yet).

| Item | Spec |
| --- | --- |
| Placements | `room_create`, `room_join` |
| Skip rule | 3 s countdown, then **Continue** (unchanged) |
| Video | Silent MP4/WebM, **~3 s**, loops once or holds last frame |
| **Release v1** | **HTML/CSS house ad** in `mock-ad.tsx` (logo + animated device ring) — no video asset |
| Aspect | **16:9** recommended (`aspect-video` in card — bump slot from `h-40`) |
| Asset path | e.g. `web/public/ads/glow-house-ad.mp4` |
| Message | Self-promo: scale the party, remove ads with Party, phones as lights |
| PostHog | Keep existing `onTrack` → ad impression event |

Video prompt & storyboard: see [onboarding-first-party.md](./onboarding-first-party.md) (onboarding film) — house ad uses the **same neon schematic aesthetic**, shorter and punchier.

**Checklist:**

- [x] HTML house ad in `mock-ad.tsx` (Glow logo + Tailwind animations)
- [ ] Optional: replace with MP4 bumper later
- [ ] Optional: `placement`-specific cut (create vs join) or single asset
- [x] Track impressions via PostHog (`ad_viewed`)

---

## 9. Implementation checklist

### Docs

- [x] [Last-sprint-for-release.md](./Last-sprint-for-release.md) (this file)
- [x] [plans-marketing-strategy.md](./plans-marketing-strategy.md)
- [x] [posthog-production-analytics.md](./posthog-production-analytics.md)
- [x] [onboarding-first-party.md](./onboarding-first-party.md)
- [ ] Update [plans.md](./plans.md) §1, §4, §5 with scale / branding / depth matrix
- [ ] Update [product-intent.md](./product-intent.md) § Plans And Monetization
- [ ] Add [improvements/09-raffle-mode.md](./improvements/09-raffle-mode.md)
- [x] Add [improvements/10-plan-gate-wrapper.md](./improvements/10-plan-gate-wrapper.md)
- [ ] Add [features/10-song-requests.md](./features/10-song-requests.md)
- [ ] Add [features/11-live-polls.md](./features/11-live-polls.md)
- [ ] Update [features/00-feature-index.md](./features/00-feature-index.md)
- [ ] Update [improvements/00-index.md](./improvements/00-index.md)

### Entitlements & seed

- [x] Add `max_matrix_cells`, `custom_rig_logo`, `custom_qr_branding`, `gif_search_mode`, `visuals_emit_slots_per_mode`, raffle keys
- [x] Fix matrix rows/cols in `PLAN_SEED_DATA` per §3
- [x] Remove regressive gates (e.g. `audio_reactive: false` on Party)
- [ ] `pnpm db:seed` (run in staging/prod)

### Server

- [x] Enforce `rows × cols ≤ max_matrix_cells` in room-manager
- [x] Enforce branding on logo / QR payloads
- [ ] Enforce poll votes only when plan covers device count (production) — v1.1
- [x] Enforce visuals preview vs emit

### UI

- [x] `<PlanGate />` + upgrade modal + checkout deep link
- [x] Billing page restructure (Stage / Floor / Crowd / Scale)
- [x] Test mode toggles for live call + poll in desk
- [x] Matrix picker respects `max_matrix_cells`
- [x] House ad HTML in `mock-ad.tsx` — see §8.1

### QA

- [ ] Free: all wow features reachable in limited / test form
- [ ] Party: 25 devices, grid never > 25 cells
- [ ] Upgrade modal from device limit during live room
- [ ] Venue: custom logo + QR socials
- [ ] Pro: raffle + WebRTC to winner

### Observability (production gate)

- [ ] PostHog project (EU) + env vars on Vercel + Railway — see [posthog-production-analytics.md](./posthog-production-analytics.md) and [deployment.md](./deployment.md) § Paso 5b
- [x] Core events: `room_created`, `device_connected`, billing funnel (`billing_page_viewed`, modal, `checkout_started`)
- [x] Error tracking: `$exception` on web + realtime
- [x] PostHog disabled by default in local dev

### Onboarding (production gate)

- [ ] In-app checklist / empty states from [onboarding-first-party.md](./onboarding-first-party.md) — **in progress (Luis)**
- [ ] AI onboarding video produced from doc storyboard + prompts
- [ ] Video embedded on landing or first `/room/new` visit

---

## 10. Open decisions

**Resolved (Part 01 — 2026-06-12):**

1. Party impulse price: **€2.99/mo (299 cents)** — seeded in `PLAN_SEED_DATA`.
2. Free matrix: **strict `rows×cols ≤ 10`** with 5×5 UI cap; `max_matrix_cells === max_devices`.
3. Poll production floor: **Party+** (document only; implement in Part 04/07).
4. Venue WebRTC cap: **0 publishers until Pro** (unchanged).

**Still open:**

1. Stripe proration shown in modal vs flat monthly price only.

---

## 11. References

- Dual render model: [visuals-architecture.md](./visuals-architecture.md)
- Marketing & positioning: [plans-marketing-strategy.md](./plans-marketing-strategy.md)
- Production analytics: [posthog-production-analytics.md](./posthog-production-analytics.md)
- First-party onboarding: [onboarding-first-party.md](./onboarding-first-party.md)
- Technical gating (current): [plans.md](./plans.md)
- Current seed: `web/lib/entitlements.ts` → `PLAN_SEED_DATA`
- Billing UI: `web/app/(account)/billing/page.tsx`
- Prior gating overlays: `web/components/glow/media-panel.tsx`, `pattern-sequence-editor.tsx`
