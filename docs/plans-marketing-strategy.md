# Glow — Plans Marketing Strategy

**Purpose:** positioning, packaging, copy, and upgrade psychology for Glow’s four plans.  
**Implementation backlog:** [Last-sprint-for-release.md](./Last-sprint-for-release.md)  
**Technical entitlements:** [plans.md](./plans.md) · **Product vision:** [product-intent.md](./product-intent.md)  
**Visuals context:** [visuals-architecture.md](./visuals-architecture.md)

---

## 1. What we sell

Glow is not “more phones on a grid.” It is a **dual-output show system**:

| Output | What it is | User mental model |
| --- | --- | --- |
| **Stage** (Visuals surface) | Projector / TV / second screen — arts, YouTube, 3D, overlays | “What the crowd watches on the big screen” |
| **Floor** (Player devices) | Each phone = one light pixel in the matrix | “What people hold in their hands” |

The two systems share only the **palette**. They are independent render pipelines ([visuals-architecture.md](./visuals-architecture.md)).

**One-line pitch:** *Control the floor and the stage from the same desk.*

**Monetization tagline:** **Scale as much as you need.**

---

## 2. What costs us money (and what we charge for)

Primary cost driver: **concurrent connected devices** on the realtime server.

| Cost driver | Plan lever |
| --- | --- |
| Connected devices | `max_devices` |
| Session length | `max_room_duration_minutes` |
| Matrix size (must match devices) | `max_matrix_cells` (= devices) |
| Poll votes | 1 vote = 1 device → scale |
| WebRTC publishers | `max_live_call_devices` |

Secondary levers (depth + branding) drive upgrades without blocking discovery:

- **Depth** — try everything, use a little (1 visual per mode, GIF featured page)
- **Branding** — Free/Party show Glow; Venue+ shows the host

---

## 3. Philosophy shift: limit → promote

### Old mindset (avoid)

- Hide “cool” features behind paywalls
- Sell specs: “Max Devices: 25”
- Regressive upgrades (paying tier loses a free feature — e.g. audio reactive off on Party)
- Matrix dimensions that exceed device caps (10×10 grid with 25 devices)

### New mindset (release)

| Instead of… | We do… |
| --- | --- |
| “You can’t use GIFs” | Featured GIFs page 1; full search on Venue+ |
| “No visuals surface on Free” | All modes tryable; 1 emit per type; preview the rest |
| “Upgrade for logo” | Free shows **Glow Rave** logo → viral self-promotion |
| “Upgrade generic” | Modal: *“You need 25 devices for this party — Party €X/mo”* |

Free users should leave thinking *“this is amazing”*, not *“this is crippled.”*  
Paid users buy **scale**, **brand**, and **production depth**.

---

## 4. Plan personas

### Free — “Try the full show (Glow branded)”

**Who:** curious host, first-time user, small hangout  
**Job to be done:** prove the idea works with friends  

**Gets:**

- All wow features in **limited / test** form
- Up to **10 devices**, matrix ≤ 10 cells, 1 h session
- Visuals: every mode, **1 active emit per type**; preview locked content in desk
- GIFs: **featured, page 1 only**
- Raffle: **1 winner**, Glow branding on winner screen
- Live call + polls: **test mode** in desk (preview / simulate — not production at scale)
- Logo + QR: **Glow Rave only** (no host socials)

**Upgrade trigger:** “More people showed up” / “I want my logo on screen” / “I need real poll votes”

---

### Party (`plus_25`) — “Scale your party now”

**Who:** house party, birthday, ~25 people  
**Job to be done:** remove friction **in the moment** when Free limits bite  

**Gets:**

- **25 devices**, matrix ≤ 25 cells (e.g. 5×5), 3 h session, **no ads**
- Expanded depth limits (more rigs, sequences, raffle winners)
- Still **Glow branding** on logo / QR (autopromo at scale)

**Pricing psychology:** impulse tier — cheap enough to subscribe mid-party from the upgrade modal.

**Upgrade trigger:** “I run a venue / want my brand” / “I need 50+ phones” / “I want crowd song requests”

---

### Venue (`plus_50`) — “Your brand, your venue” ⭐ Recommended

**Who:** bar, club room, mobile DJ, regular host  
**Job to be done:** professional show with **host identity** + crowd interaction  

**Gets:**

- **50 devices**, matrix ≤ 50 cells (custom rectangular grids), 6 h session
- **Custom logo** on surface / rig
- **Custom QR** with host social links
- Full GIF search, unlimited visual emits, effect layering, full media stack
- Raffle with **host branding**, multiple winners
- **Song requests** (future) — audience queue + DJ management + vote priority
- **Live polls** (future) — production vote counting on surface

**This is the anchor plan** — full dual-screen DJ product. Highlight as “Most popular” on billing.

**Upgrade trigger:** “Festival / 100+ devices” / “Live camera mosaic” / “Raffle winner on stage via call”

---

### Pro — “Live production & events”

**Who:** event producer, festival booth, serious production  
**Job to be done:** maximum scale + **live moments**  

**Gets:**

- **999 devices**, large matrix, 12 h session
- **WebRTC live call** mosaic on surface (up to 6 publishers)
- **Raffle + WebRTC:** call the winner on stage to collect a prize
- Everything in Venue

---

## 5. Three axes of value (billing structure)

Every plan card should show four sections, not a flat spec list:

```
┌─ STAGE (Projector) ──────────────────────┐
│ Standard · YouTube · 3D · overlays       │
└──────────────────────────────────────────┘
┌─ FLOOR (Phones) ─────────────────────────┐
│ Presets · sequences · media · flash      │
└──────────────────────────────────────────┘
┌─ CROWD ──────────────────────────────────┐
│ Reactions · raffle · polls · requests    │
└──────────────────────────────────────────┘
┌─ SCALE ──────────────────────────────────┐
│ Devices · matrix cells · duration · ads  │
└──────────────────────────────────────────┘
```

### Comparison table (customer-facing)

| | Free | Party | Venue ⭐ | Pro |
| --- | --- | --- | --- | --- |
| **Tagline** | Try everything | Scale the party | Your brand on stage | Live production |
| Devices | 10 | 25 | 50 | 999 |
| Matrix (max cells) | 10 | 25 | 50 | 999 |
| Session | 1 h | 3 h | 6 h | 12 h |
| Ads | Yes | No | No | No |
| Your logo / QR socials | Glow only | Glow only | ✅ | ✅ |
| YouTube / 3D on projector | 1 each (emit) | expanded | ✅ full | ✅ full |
| GIF search | Featured p.1 | partial | ✅ full | ✅ full |
| Effect layering (floor) | preview | single | ✅ multi | ✅ multi |
| Live poll (production) | test only | ✅* | ✅ | ✅ |
| Song requests | — | — | ✅ (future) | ✅ |
| Raffle | 1 winner | 3 winners | N + host brand | + WebRTC to winner |
| Live camera on screen | test only | — | — | ✅ |

\*Poll production requires enough device headroom on the plan — polls are a **scale** feature.

---

## 6. Matrix ↔ devices (credibility rule)

**Never advertise a grid larger than the device cap.**

| Plan | Devices | Max matrix | Valid example |
| --- | --- | --- | --- |
| Free | 10 | 10 cells | 5×2, 3×3 |
| Party | 25 | 25 cells | 5×5 |
| Venue | 50 | 50 cells | 10×5, 7×7 |
| Pro | 999 | 999 cells | 31×31 |

Billing shows: *“Up to 25 devices · matrix up to 25 cells”* — not *“10×10 matrix”* when cap is 25.

Sparse matrices (empty cells) remain supported, but **cells × cap** must stay honest in copy.

---

## 7. Depth limits (freemium taste)

### Visuals surface

Per [visuals-architecture.md](./visuals-architecture.md), modes include `standard`, `youtube`, `3d`, `custom-video`, `pptt`.

| Mode | Free | Venue+ |
| --- | --- | --- |
| Emit to real surface | 1 per mode category | unlimited |
| Locked content | visible in desk with “Preview — upgrade to emit” | all emit |
| Overlays (text, reactions) | limited | full |

### GIFs

- **Free:** Klipy **featured**, first page only
- **Venue+:** full search

### Media / sequences

- Free: short text, single-effect sequences, taste of media
- Venue+: uploads, GIF broadcast, multi-effect layering

---

## 8. Branding as marketing (Free + Party)

When `custom_rig_logo` / `custom_qr_branding` are false:

| Surface | Behavior |
| --- | --- |
| Rig / surface logo | Glow Rave asset |
| Join QR | Glow branding, standard join URL |
| Raffle winner screen | Glow logo + win animation |

**Why Party keeps Glow branding:** the impulse tier optimizes for **scale**, not white-label. Every free and party room is a marketing touchpoint.

**Venue unlock:** *“Put your logo on the big screen and your Instagram on the join QR.”*

---

## 9. PlanGate + upgrade modal (conversion UX)

Replace scattered overlays (`media-panel`, `pattern-sequence-editor`, etc.) with one wrapper.

### Gate states

| State | Behavior |
| --- | --- |
| `allowed` | Normal use |
| `limited` | Works within cap (featured GIFs, 1 visual per type) |
| `preview` | Desk preview only; server blocks emit |
| `blocked` | Modal with upgrade path |

### Modal copy pattern

1. **Moment:** what they tried to do  
   *“You’ve reached 10 connected devices.”*
2. **Solution:** minimum plan that fixes it  
   *“Party supports up to 25 devices.”*
3. **Price:** monthly (optional annual)  
   *“€2.99/mo — activate now”*
4. **Primary CTA:** Stripe Checkout → return to control desk  
5. **Secondary:** “Continue with Free limits”

### Contextual plan routing

| Limit hit | Suggest |
| --- | --- |
| Device cap | Party |
| Logo / QR socials | Venue |
| Full GIF / layering / song requests | Venue |
| Live call production / raffle + call | Pro |
| Poll with N voters > plan devices | next scale tier |

---

## 10. Test mode vs production

Some features must be **tryable on Free** without granting production scale.

| Feature | Test (Free) | Production |
| --- | --- | --- |
| WebRTC live call | Desk preview, 1 local test publisher | Pro: mosaic on surface |
| Live poll | Build question, preview bars in desk | Live votes = devices → paid scale |
| Visual arts / modes | Preview locked items | Emit requires entitlement |
| Raffle | 1 winner, Glow brand | Venue+: N winners, host brand |

**Polls:** monetize through **device count**, not a boolean “polls enabled.” A poll with 40 voters needs at least Party/Venue headroom.

---

## 11. New engagement features

### Raffle mode (release sprint)

- DJ triggers draw; N random connected devices win.
- Winner phone: logo + custom color / animation.
- **Pro variant:** WebRTC call to winner → stage moment.

**Marketing angle:** *“Turn your crowd into a game show.”*

### Song requests (Venue+, future)

- Chat-style suggestions from phones.
- DJ internal queue: pending → played / dismissed.
- Public sees queue and **votes priority**.

**Marketing angle:** *“Let the crowd pick the next track.”*

### Live polls (Venue+, future)

- DJ defines question + N options.
- Real-time bars on surface (+ optional desk view).
- Free: test UI only; production requires scale.

**Marketing angle:** *“Ask the room, see answers live on the projector.”*

---

## 12. Pricing direction (not final seed)

Current seed (€1 / €5 / €25) misaligns with perceived value jumps. Direction:

| Plan | Direction | Rationale |
| --- | --- | --- |
| Party | **€2–4/mo** or **~€25/yr** | Impulse; cheaper than a drink |
| Venue | **€12–18/mo** | Anchor; YouTube + 3D + brand + crowd tools |
| Pro | **€35–49/mo** | Events; WebRTC + max scale |

**Venue should feel like 2–3× Party**, not 5×, unless Party price rises too.

Annual pricing with visible discount improves LTV for regular DJs.

---

## 13. Problems in current billing (fix in sprint)

| Issue | Fix |
| --- | --- |
| Specs only (devices, matrix rows×cols) | Stage / Floor / Crowd / Scale blocks |
| Matrix 10×10 with 25 device cap | Align cells to devices |
| Killer features hidden (YouTube, 3D) | Surface modes on card |
| No recommended plan | Badge Venue as “Most popular” |
| CTA “Upgrade Grid” | Benefit CTAs per plan |
| `audio_reactive` false on Party | Never regress features on upgrade |
| Visuals modes ungated by tier | Depth + preview model |
| Same gated overlay copy everywhere | PlanGate with contextual modal |

---

## 14. Narrative arc (user journey)

```
FREE     →  “Does this work with my friends?”
            Taste everything · Glow branded · 10 phones

PARTY    →  “Shit, more people arrived.”
            25 phones · no ads · still Glow branded · impulse price

VENUE    →  “I’m the DJ here.”
            My logo · full visuals · GIFs · crowd tools

PRO      →  “This is a real event.”
            999 scale · live camera · raffle on stage
```

---

## 15. Messaging snippets (English UI copy)

### Free

> Try the full Glow experience with up to 10 phones. All visuals modes in preview — one live at a time. Powered by Glow Rave.

### Party

> No ads. Up to 25 synchronized phones. Perfect when the party grows.

### Venue ⭐

> Your logo on the projector. Full YouTube, 3D, and GIF search. Built for bars, clubs, and working DJs.

### Pro

> Festival-scale rooms. Live camera mosaic. Call raffle winners on stage.

### Upgrade modal (generic template)

> **{feature} needs {plan}**  
> {one sentence benefit}  
> **{price}/mo** · Activate in 30 seconds  
> [Upgrade] [Not now]

---

## 16. Related docs to update when implementing

| Doc | Change |
| --- | --- |
| [plans.md](./plans.md) | Entitlement matrix, new keys |
| [product-intent.md](./product-intent.md) | § Plans And Monetization |
| [Last-sprint-for-release.md](./Last-sprint-for-release.md) | Implementation checklist |
| [posthog-production-analytics.md](./posthog-production-analytics.md) | Analytics & errors (production gate) |
| [features/00-feature-index.md](./features/00-feature-index.md) | Polls, song requests |
| [improvements/00-index.md](./improvements/00-index.md) | Raffle, PlanGate |

---

## 17. Success metrics (post-release)

| Metric | Signal |
| --- | --- |
| Free → Party conversion within 24 h of first room | Impulse modal works |
| Modal → Checkout completion rate | Price / copy fit |
| Party → Venue within 30 days | Brand need validated |
| Avg devices per paid room vs plan cap | Right-sizing tiers |
| % Free rooms with Glow QR scans | Branding autopromo works |
