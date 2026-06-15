# Glow Implementation Strategy

## Purpose

This document tracks the implementation strategy for transforming the current SaaS boilerplate into the Glow MVP.

Use `docs/product-intent.md` as the product and architecture source of truth. Use this file as the execution tracker: what to do, in what order, why it matters, and when each phase is considered complete.

## Strategy Principles

- Validate the product locally before deploying.
- Keep the MVP focused on synchronization, matrix control, and anonymous player joining.
- Replace boilerplate code when it conflicts with the product direction.
- Preserve useful infrastructure: Next.js, shadcn/ui, Drizzle, Stripe, Supabase packages.
- Move auth to Supabase OAuth before building paid room logic.
- Keep realtime state outside Next.js.
- Avoid persisting high-frequency visual events.
- Make every feature plan-aware through database entitlements.
- Prefer simple local-first implementation before scaling infrastructure.

## Current Starting Point

The repository currently contains:

- `web`: Next.js SaaS starter.
- `docs/product-intent.md`: product intent and target architecture.
- No realtime service yet.
- No product-specific Glow routes yet.
- No Supabase Auth integration active yet.
- Existing auth is custom password/JWT and must be replaced.

## Target Local Development Shape

During MVP development, the app should run locally with at least two processes:

```bash
# Web app
cd web
pnpm dev

# Realtime service
cd realtime
pnpm dev
```

Expected local URLs:

```txt
http://localhost:3000
http://localhost:4000
```

For mobile device testing on the same WiFi:

```txt
http://LOCAL_MACHINE_IP:3000
http://LOCAL_MACHINE_IP:4000
```

## Phase Tracker

| Phase | Status | Goal | Exit Criteria |
| --- | --- | --- | --- |
| 0. Repo inventory | Done | Confirm current files, package manager, env requirements, and safe deletion scope. | Known list of files to keep, replace, and remove. |
| 1. Database schema | Done | Replace SaaS schema with Glow schema. | Plans, entitlements, profiles, teams, room sessions, and ad impressions are represented. |
| 2. Supabase OAuth | Done | Replace password/JWT auth with Supabase OAuth. | User can sign in with OAuth and gets a default team + free plan. |
| 3. Billing and entitlements | Done | Map Stripe subscriptions to internal plans. | Team plan updates from Stripe webhook and entitlements resolve correctly. |
| 4. Realtime service | Done | Create Socket.io room engine. | Host can create a room and anonymous players can join locally. |
| 5. Matrix core | Done | Support sparse matrix, labels, positions, and device feedback. | Host can see devices, assign positions, identify devices, and handle empty cells. |
| 6. Visual engine | Done | Render direct colors, presets, target timestamps, and fallback. | Host can light a cell and run at least one coordinate-based preset. |
| 7. Product routes | Done | Replace SaaS UI with Glow screens. | Landing, join, player, standalone, control, and billing routes exist. |
| 8. Ads and PWA | Done | Add mock ads and app-like mobile behavior. | Free rooms show ads, paid rooms do not, and player supports fullscreen/wake-lock best effort. |
| 9. Boilerplate cleanup | Done | Remove confusing SaaS starter leftovers. | No password auth, invitations, starter copy, or irrelevant dashboard remains. |
| 10. Local validation | Ready | Test the MVP with multiple browsers/devices. | End-to-end local flow works with a sparse matrix and multiple players. |
| 11. First deployment | Ready | Deploy only after local validation. | Web, realtime, Supabase, and Stripe test mode work together remotely. See `docs/deployment.md`. |

## v2 Phase Tracker (feature expansion)

The MVP (phases 0–11) is complete. The second wave is tracked here. Each row maps to a
numbered spec in [features/](./features/00-feature-index.md). Recommended order follows
the dependency graph; gating per [plans.md](./plans.md).

| Phase | Feature | Doc | Status | Exit Criteria |
| --- | --- | --- | --- | --- |
| v2.1 | Pattern sequences | [07](./features/07-preset-mixing-engine.md) | **Done** | Saved sequences (palette + weighted effects) distributed across devices via `run_distribution`; `max_pattern_sequences` + `effect_layering` gates; editor + library + embedded preview |
| v2.2 | Rigs | [02](./features/02-rigs.md) | **Done** | Schema + CRUD (cues/socials/logo) + editor (info/cues/socials/console) + realtime room-load + `max_rigs` gate + `/room/new` rig picker |
| v2.3 | Visuals surface | [01](./features/01-visuals-surface.md) | **Done** | Token-auth (HMAC) surface renders arts (glow-branded/pulse-grid/audio-shader); desk events + replay + reaction overlay |
| v2.4 | Control desk tabs | [03](./features/03-control-panel-tabs.md) | **Done** | Devices + Visuals tabs (URL-persisted); cue list + Next/Prev/Jump; live palette + logo; Overwrite Rig. Deferred: `console_config` visibility (BUG-005) |
| v2.5 | Player identity & controls | [04](./features/04-player-identity-and-controls.md) | **Done** | Mandatory nickname gate (persist + `/join` prefill); top-right HUD toolbar (share/QR/fullscreen/exit). Reactions bar deferred to v2.6 |
| v2.6 | Audience reactions | [05](./features/05-audience-reactions.md) | **Done** | Player toolbar → `player:reaction` (rate-limited + boosted, plan allowlists) → `visuals:reaction` float-up overlay with coalescing `×N` |
| v2.7 | Orchestrator media | [06](./features/06-orchestrator-media.md) | **Done** | Sequenced text + Klipy GIF overlays + device targeting + media render layer; image upload backend done, desk image UI deferred (TODO) |
| v2.8 | Device flash control | [08](./features/08-device-flash-control.md) | **Done** | Push-to-flash desk (Hold Pulse/Strobe) + player opt-in & manual flash; screen-flash fallback; strobe-preset torch sync; gated `device_flash_control` |
| v2.9 | WebRTC live call | [09](./features/09-webrtc-live-call.md) | **Mostly done** | Mesh publisher→surface, per-device consent, PiP/Half/2×2/3×3 layouts, gated Pro (≤6), `surface_reconnect`. STUN/LAN only; **TURN (Phase 4) pending** for cross-network |

## Phase 0: Repo Inventory

Goal:

- Understand exactly what exists before deleting or replacing boilerplate code.

Tasks:

- Check git status.
- Confirm package manager and lockfile.
- Confirm whether the repo should become a workspace with `web` and `realtime`.
- Review current env vars.
- Review current Supabase config.
- Review current Stripe config.
- List old auth files to delete later.
- List routes to replace.

Do not:

- Start schema migration before this inventory is clear.
- Delete files blindly.

Exit criteria:

- We know which parts of the starter are infrastructure and which parts are throwaway product code.

## Phase 1: Database Schema

Goal:

- Establish the product data model before UI and realtime logic depend on it.

Target tables:

- `profiles`
- `teams`
- `team_members`
- `plans`
- `plan_entitlements`
- `room_sessions`
- `ad_impressions`
- Optional later: `activity_logs`

Tasks:

- Replace the current serial `users` model with Supabase Auth-compatible `profiles`.
- Remove `password_hash`.
- Convert team ownership to Supabase user IDs.
- Add internal plans.
- Add flexible entitlements.
- Add room session summaries.
- Add ad impression tracking.
- Seed Free, Plus 25, Plus 50, and Pro.
- Add typed entitlement resolver.

Exit criteria:

- Free plan exists without Stripe price.
- Paid plans can store Stripe price IDs.
- A team can resolve a full typed entitlement object.
- Schema has no dependency on password auth.

## Phase 2: Supabase OAuth

Goal:

- Make Supabase Auth the only auth system.

Tasks:

- Wire Supabase browser and server clients.
- Implement OAuth sign-in.
- Implement auth callback.
- Update middleware/session refresh.
- Add `getCurrentUser`.
- Add `getCurrentTeam`.
- Bootstrap profile and default team after first login.
- Remove password sign-in/sign-up paths.

Exit criteria:

- User signs in with Google OAuth.
- User has a `profiles` row.
- User has a default `teams` row.
- User starts on Free plan.
- Protected routes require Supabase session.
- Player/join routes remain public.

## Phase 3: Billing And Entitlements

Goal:

- Make Stripe payment update internal product access.

Tasks:

- Replace Base/Plus plan UI with Free, Plus 25, Plus 50, Pro.
- Ensure Free does not create checkout.
- Start Checkout for paid plans using `plans.stripe_price_id`.
- Store `team_id` and `plan_code` in Checkout metadata.
- Update webhook logic to map Stripe price ID to internal `plans.id`.
- On cancellation or inactive subscription, return team to Free.
- Show current plan and limits in billing UI.

Exit criteria:

- Checkout starts for paid plans.
- Webhook updates team plan.
- Canceled subscription falls back to Free.
- Entitlements reflect the active plan.

## Phase 4: Realtime Service

Goal:

- Create the authoritative live room engine.

Tasks:

- Create `realtime` service folder.
- Add Node.js + TypeScript setup.
- Add Socket.io server.
- Add env config for Supabase and database access.
- Validate Supabase access token for orchestrator room creation.
- Load team and entitlements.
- Create in-memory `RoomState`.
- Create `room_sessions` on room creation.
- Let anonymous players join by room code.
- Enforce `max_devices`.
- Emit `room:state`.
- Implement room close.
- Implement cleanup interval.

Exit criteria:

- Host can create a room locally.
- Player can join anonymously.
- Realtime service rejects missing rooms.
- Realtime service rejects rooms over device limit.
- Room closes when host disconnects beyond reconnect window.

## Phase 5: Matrix Core

Goal:

- Make matrix mode physically useful.

Tasks:

- Implement sparse matrix state.
- Derive labels from row/column.
- Let players request initial position.
- Let host assign or reassign position.
- Decide MVP behavior for occupied target cells: reject by default.
- Let host identify a device.
- Track device latency and status.
- Represent empty cells in room state.

Exit criteria:

- Matrix can have holes.
- Players can be connected without a position.
- Players can show labels such as `A1` or `A25`.
- Host can identify a physical device.
- Host can reassign an unoccupied cell.

## Phase 6: Visual Engine

Goal:

- Prove the core visual synchronization loop.

Tasks:

- Implement direct color rendering.
- Implement `targetTimestamp` scheduling in the player.
- Implement click-to-light for matrix cells.
- Implement at least one coordinate-based preset.
- Implement basic frame or preset broadcast.
- Implement manual fallback mode using room code + seed timestamp.

Exit criteria:

- Clicking a matrix cell lights the correct player.
- Empty cells do not break effects.
- Preset color is calculated by `(row, col, time)`.
- Manual fallback runs locally on players.

## Phase 7: Product Routes

Goal:

- Replace SaaS starter screens with Glow screens.

Routes:

- `/`
- `/sign-in`
- `/join`
- `/standalone`
- `/room/new`
- `/room/[code]/control`
- `/room/[code]/play`
- `/billing` or `/pricing`

Tasks:

- Replace landing copy.
- Build join flow.
- Build player fullscreen screen.
- Build create room screen.
- Build control panel.
- Build standalone screen.
- Rework billing screen.
- Remove old team settings as the main dashboard.

Exit criteria:

- User can navigate the intended product flow without seeing SaaS starter copy.

## Phase 8: Ads And PWA

Goal:

- Add the commercial MVP behavior and mobile app basics.

Tasks:

- Create mock ad component.
- Show ad before free room creation.
- Show ad before free room join.
- Track `ad_impressions`.
- Add manifest.
- Add app metadata.
- Add fullscreen helper.
- Add wake lock best-effort helper.
- Improve mobile safe-area handling.

Exit criteria:

- Free rooms show mock ads.
- Paid rooms skip mock ads.
- Ad impressions are tracked.
- Player feels app-like on mobile.

## Phase 9: Boilerplate Cleanup

Goal:

- Remove code that conflicts with the product direction.

Tasks:

- Remove custom auth helpers.
- Remove bcrypt usage.
- Remove password pages.
- Remove invitation flows.
- Remove starter landing content.
- Remove irrelevant dashboard sections.
- Update README or add setup docs.
- Remove dead imports and dependencies.

Exit criteria:

- There is no visible SaaS starter functionality unrelated to Glow.
- There is no password auth path.
- Build and lint pass.

## Phase 10: Local Validation

Goal:

- Validate the product before deployment.

Test matrix:

- One desktop browser as orchestrator.
- One desktop browser as player.
- Two or more phones as players on the same WiFi.
- Sparse matrix with empty cells.
- At least one player without position.
- At least one reassigned player.

Scenarios:

- Create Free room.
- See room creation ad.
- Join as anonymous player.
- See room join ad.
- Select position.
- Show label.
- Identify device.
- Click cell to light device.
- Run preset.
- Toggle fallback.
- Disconnect orchestrator.
- Verify cleanup.

Exit criteria:

- The concept is demoable locally.

## Phase 11: First Deployment

Goal:

- Deploy only after the local MVP validates the core behavior.

Suggested deployment:

- `web` on Vercel.
- `realtime` on Railway, Fly.io, Render, Cloud Run, or a small VPS.
- Supabase for Auth/Postgres.
- Stripe in test mode.

Tasks:

- Configure production env vars.
- Configure OAuth redirect URLs.
- Configure Stripe webhook URL.
- Configure CORS for realtime.
- Test a remote room with multiple devices.

Exit criteria:

- A remote user can create a room.
- Remote players can join.
- Stripe test checkout updates plan.
- Paid test plan disables ads.

## Tracking Log

Use this section to record implementation decisions and progress.

### 2026-06-09 (v2.11 — Post-demo improvements wave)

Tracked in [improvements/00-index.md](./improvements/00-index.md). After the first full
end-to-end demo, a wave of fixes/enhancements shipped:

- **01 Visuals surface fixes (done):** room-ended now reaches the surface (SESSION ENDED
  screen), reliable palette/art via `controller.setInput`, and **media channel separation**
  (player media no longer leaks to the surface). Reworked late-join into an **authoritative
  state model**: `room.visualsState` + `room.playerVisualState` (versioned), always defined,
  delivered as a **full snapshot in the join/subscribe ACK** + deltas live. Players replay
  current state on join (old E1) and via `player:resync`.
- **06 Pattern sequence live sync (done):** palette/effect edits now push live (200 ms
  debounce); preview gained **Split vs Single-Device** modes through the shared device render
  path (parity with what a device shows).
- **02 Visuals desk controls (done):** embedded visuals preview + Mix/Out-of-Mix cards for
  logo/text/QR, live `orchestrator:visuals_set_text`/`visuals_set_qr`, rig **display name**,
  QR natural-language periodic timer.
- **03 Live-call state persistence (done):** Option A — `LiveCallDeskProvider` /
  `useLiveCallDesk` owned by the control page + `orchestrator:get_live_call_state` server
  resync; survives tab switches and reloads.
- **04 Play devices fixes (done):** E1 verified, media overlay in preview (E2), **video-only
  live call** (no mic, E3), torch/live-call camera conflict + iOS note (E4), fullscreen
  support gate hides dead button (E5), DJ socials at start + SESSION ENDED via room state +
  `/api/rooms/[code]/share-info` (E6).
- **05 Control Device (done):** touch-first operate-only console (`mode="operate"` hides
  CRUD) at `/room/[code]/control-device` + "Device Mode" QR on the desktop desk.
- **Clock sync:** `clockOffset` (NTP-style over socket) in `use-orchestrator-delay.ts`, fed
  into `visual-engine.ts` + `torch.ts` so scheduled transitions/flashes land together across
  devices. See [architecture.md §5.1](./architecture.md).
- **07 Orchestrator auth hardening (done):** `RoomState.ownerUserId` added; set on
  `create_room`. `orchestrator:rejoin_room` now requires `accessToken`, validates it, and
  verifies owner (or room team) before granting control — returns `Unauthorized`/`Forbidden`
  otherwise. Both desks (`control` + `control-device`) pass `session.access_token` and
  redirect to sign-in / home on failure. Closes the room-code takeover hole (incl. Device
  Mode QR).

### 2026-06-08 (v2.10 — Railway monorepo deploy fix + WebRTC Phase 4 + entitlements merge)

- **Railway deploy fixed (monorepo pnpm).** Root cause: Railway deployed `realtime/` as an
  isolated project, but it depends on the full pnpm workspace (`glow-presets`/`glow-visuals`
  in `web/packages/*` + root lockfile). Fix: deploy from repo **root** with
  `nixpacks.toml` + root `package.json` (`packageManager: pnpm@10.32.1`) forcing pnpm;
  `realtime/railway.toml` build/start with `--filter glow-realtime` + widened
  `watchPatterns`; `.railwayignore`. `realtime` `build` now compiles both workspace deps via
  explicit `pnpm -C ../web/packages/...` paths (the `glow-presets` name was duplicated), and
  `start` runs `node dist/index.js` (no `tsx`/devDeps at runtime). Also bumped `next` to
  clear a Railway CVE scan on the monorepo lockfile. See
  [deployment.md §4.6](./deployment.md).
- **WebRTC Phase 4 shipped (TURN + resilience).** Runtime ICE via
  `GET /api/webrtc/ice-servers` (`ice-servers-server.ts`, `no-store`), `webrtc.ts` async
  ICE fetch with STUN-only fallback. Publisher ICE-restart + PC recreate + re-offer on
  `online`/`visibilitychange`/`surface_reconnect`; viewer per-publisher signaling queue +
  deferred cleanup; realtime `surface_reconnect` cooldown (5s/publisher). TURN provider:
  **Metered** (static creds, web-only). Feature 09 → **done**; SFU (Phase 5) still not
  planned.
- **Entitlements merge fix.** UI gates read only the room snapshot, so Pro upgrades / old
  rooms showed wrong gates. New `use-team-entitlements.ts` (SWR → `/api/user`) +
  `mergeEntitlementsForUi(room, team)` in `entitlements-defaults.ts` (defaults → room →
  team, team wins). Moved out of `@/lib/entitlements` to avoid server-only imports in
  client (`Can't resolve 'fs'`). Server refreshes via `refreshRoomEntitlementsFromTeam()`
  on rejoin + visuals/live-call handlers. See [architecture.md §4.2](./architecture.md).

### 2026-06-08 (v2.9 — WebRTC live-call mosaic, feature 09, Phases 1–3)

- **Mesh shipped (no SFU).** Publishers → visuals surface (only viewer); realtime relays
  `webrtc:signal` (offer/answer/ice) + `live_call_start/stop` + per-device consent
  (requested/live/declined). Player consent modal + `getUserMedia`; surface renders one
  `<video>` per `LiveTile`.
- **Layouts:** PiP (default) / Half / 2×2 / 3×3 with "Apply layout" (recompose without
  restart). Gated `webrtc_live_call` (Pro) + capped `max_live_call_devices` (6) on UI +
  server. Decline + disconnect handled; `surface_reconnect` re-offers to a late surface.
- **STUN/LAN at this stage; TURN (Phase 4) shipped later** — see v2.10 above for
  cross-network/venue support. SFU/LiveKit intentionally not planned (decision 2026-06-08).

### 2026-06-08 (v2.8 — Device flash / torch, feature 08)

- **Shipped (MVP + manual player button).** `web/lib/glow/torch.ts` opt-in (camera +
  `torch` capability), `player:torch_capability` report, white screen-flash fallback for
  unsupported/iOS. `device:torch` scheduled via `targetTimestamp`; safeguards + camera
  auto-release after 5 min idle.
- **Desk:** `torch-controls.tsx` in "Play Devices" with **Hold Pulse / Hold Strobe**
  (push-to-flash, no On/Off), shared target selector, "X flash-capable / Y targeted" count;
  `orchestrator:set_torch` gated by `device_flash_control` (UI + server).
- **Extras:** player has its own circular Flash button (independent of DJ); live `strobe`
  preset emits a synced 125 ms torch pattern when entitled. Gating: Free blocked, Plus 25+.

### 2026-06-08 (v2.7 — Orchestrator media, feature 06)

- **Text + GIF media broadcasting shipped.** `visual-engine.ts` gains an `activeMedia`
  layer (below identify, above patterns/colors) with blackout behind contain-fit assets;
  player + visuals surface render marquee / word-by-word / grid text and Klipy GIFs.
- **Targeting:** `resolveTargetSockets` (all / fraction / devices chips / matrix_range),
  reusing the 07 allocation model. `orchestrator:media_*` handlers gated by entitlements.
- **Klipy:** server-side `KLIPY_APP_KEY` proxy (`/api/klipy/search|trending|share`, hashed
  id, safe filter, 401 unauth). **Images:** upload API + `room-media` bucket +
  `room_media_assets` + session-end cleanup done, but the **desk image UI is commented out**
  (TODO) — UI overlays are text + GIF for now.
- **Gating seeded:** `sequenced_text` Plus 25+, `custom_media_upload` + `gif_broadcast`
  Plus 50+, Free none (verified against DB).
- Tidy-ups: desk "Patterns" tab → "Play Devices"; preset "Solid Red" → "Solid".

### 2026-06-08 (v2.6 — Audience reactions, feature 05)

- **Full feature shipped.** Shared allowlist/glyphs/constants in
  `web/packages/glow-visuals/src/reactions.ts` (Free vs Paid sets). Player bottom-center
  floating `reactions-toolbar.tsx` → `player:reaction`. Server validates device + plan +
  allowlist + per-device sliding-window rate limit (Free 5/10s, Paid 15/10s) + boost
  (Free cap 1, Paid cap 3) → `visuals:reaction`. Surface overlay coalesces identical
  (emoji+nickname) into a `×N` boosted sprite (40→80px), avoids center 35–65%, prunes on
  expiry. `audience_reactions` seeded true on all tiers; limits differentiate.
- Desk `ReactionOverlayConfig` + `room:reaction_stats` (Phase 4) left optional/not built.

### 2026-06-08 (v2.5 — Player identity & controls, feature 04)

- **Phases 1–2 shipped.** Mandatory nickname gate on `/room/[code]/play` (trimmed 1–24,
  stored via `player-session`, prefilled in `/join`); matrix picker runs after the gate.
- **HUD:** collapsible top-right glassmorphic toolbar (`player-menu.tsx`) — Share (copy),
  View QR (modal), Fullscreen, and a "More" drawer with nickname/label + Exit (clean
  teardown → `/join`) + a reactions placeholder.
- **Immersive dark theme** forced at `(immersive)/layout.tsx` so the light surface renders
  correctly regardless of global theme. No realtime change (server already took nickname).
- **Phase 3 (reactions bar)** deferred to feature 05.

### 2026-06-08 (v2.1 — Pattern Sequences, feature 07)

- **Feature 07 shipped as Pattern Sequences** (pivot from the original layer/blend plan).
  A sequence = saved `{ name, palette(1–12), effects[] }` where each effect has `active`
  + `weight` (%). New table `pattern_sequences` (`0003_add_pattern_sequences.sql`) + CRUD
  API + library page `/pattern-sequences` + account-menu entry.
- **Engine model = weighted audience distribution, not per-pixel blend compositing.**
  `orchestrator:run_distribution` → `visual:preset` (single) or `visual:effect_distribution`
  (multi); players resolve their slice deterministically from `devicePublicId` + weights.
  `effect_layering` gates `effects.length > 1`. New `max_pattern_sequences` entitlement
  (1/3/10/50).
- **Control desk UX:** embedded live preview (`pattern-sequence-preview.tsx`, replaced the
  deleted top-fixed `ControlLivePreview`), audience-split slider (`allocation-bar.tsx`,
  fixed a double-count drag jump), In-mix (cyan) vs Preview (violet) distinction, and a
  single **smart save** button (Save first / Overwrite current / Add new) with
  case-insensitive duplicate-name validation. Selecting a sequence loads + previews + goes
  live automatically; rename/delete only in the library page.
- **Drift vs spec:** `EffectStack`/`EffectLayer` + `run_stack`/`visual:effect_stack` from
  the original plan are superseded by `run_distribution`/`visual:effect_distribution`; doc
  07 keeps the old plan as historical context. Phase 1 (palette params) was already done.
- **Pending:** full device priority chain (media [06] + torch [08] hooks) finishes with
  those features.

### 2026-06-07 (v2 — visuals surface + rigs)

- **Feature 01 (Visuals surface) — done.** New `web/packages/glow-visuals` package with
  three arts: `glow-branded` (Free, Canvas2D branded splash with room code + join CTA),
  `pulse-grid` and `audio-shader` (Plus 25+; audio-shader is the WebGL PoC port). New
  `/room/[code]/visuals` output surface, authed by an **HMAC-SHA256** token (6h, URL
  fragment) verified in constant time. Realtime: `visuals:subscribe` +
  `orchestrator:visuals_set_scene/palette/logo` + `visuals:audio_features` forwarding +
  **replay last state** for late joiners + reaction overlay. New entitlements
  `visuals_surface`, `available_visual_arts`; `pnpm db:seed` run.
- **Feature 02 (Rigs) — done** (cue/socials editors confirmed in v2.4). Tables
  `rigs`/`rig_cues`/`rig_socials` +
  `room_sessions.rig_id`. CRUD API incl. cues/socials/logo (logo upload allows **GIF**).
  Rigs editor with Info & Colors tab: palette, logo (position center+4 corners,
  effects pulse/spin/float/neon, opacity), and **QR config** (interval/duration
  or permanent "Always"). Draft autosave + restore, dirty checking, live validation.
  Logo + QR config stored in `console_config` (`logoConfig`/`qrConfig`); logo `effect`
  value is `neon` (CSS keyframe `neon-glow`); QR "Always" = `durationSeconds === 0`;
  drafts are account-scoped (`glow_rig_draft_${userId}`). `max_rigs` gate **confirmed**.
- **Room integration done at realtime/schema:** `orchestrator:create_room` accepts
  `{ rigId, paletteSnapshot }`, persists `rig_id` + `palette_snapshot`, and builds the
  initial visuals scene (art/palette/logo/qrConfig), replayed to late joiners.
- **Decisions / drift:** naming finalized as **Rig**; token is HMAC (not JWT); art tiers
  differ from the original `plans.md` guess (`plans.md` updated); QR-on-surface is a new
  sub-feature spanning 01+02. `glow-visuals` `VisualArtInput.logo` type still needs the
  5 positions + `effect` field (realtime scene already has them).
- A per-feature walkthrough doc was generated during Phase 02 implementation (VJ brand
  customizations) — extra reference, not the canonical spec; canonical = these docs.

### 2026-06-07 (v2.4 — control desk tabs)

- **Feature 03 (Control desk) — done.** `/room/[code]/control` split into **Devices** +
  **Visuals** tabs (pill switcher, state persisted in `?tab=`; room header stays above).
  Devices tab unchanged.
- **Visuals tab** (`web/components/glow/visuals-tab.tsx`) with 6 sections: Output
  (mint token → open/share + QR, 6h), Cue List, Visual Art picker (filtered by
  `availableVisualArts`), Live Palette, Logo toggle, Rig (Overwrite). New components
  `cue-list.tsx` + `palette-editor.tsx`.
- **Cue control:** added `orchestrator:visuals_next_cue` to realtime — `RoomState` keeps
  `cueIndex` + `rigCues` (in-memory), `create_room` snapshots cues by `sort_order`,
  handler wraps around and emits `visuals:scene`. Prev/Jump emit `visuals_set_scene`.
- **Type alignment:** `glow-visuals` `VisualArtInput.logo` now carries 5 positions +
  `effect` (matches realtime scene); collateral fix to `rigs/page.tsx` mock audio
  (`AudioFeatures` shape `{bass, mid, treble, energy}`). `tsc --noEmit` clean on both
  web + realtime.
- **Editors:** cue-list + socials **editors already exist** in the Rigs Manager (tabs
  `cues`/`socials`) — so feature 02 is now fully done.
- **Drift / deferred (not regressions):**
  - **`console_config` visibility** not consumed yet — the desk shows all tabs/buttons
    (tracked in `docs/bugs.md` BUG-005).
  - **Overwrite Rig** persists palette + `defaultVisualArtId` + `logoEnabled` only.
- **Resolved after v2.4:** `/room/new` now has a **rig picker** that passes `rigId` +
  `paletteSnapshot` to `create_room`, populating `room_sessions.rig_id`/`palette_snapshot`.

### 2026-06-07 (local-dev bugs logged)

- Logged a bug batch (then `docs/bugs.md` was removed once fixed): create-session button
  hang (BUG-001), broken local dev (BUG-002), `pnpm db:seed` `tsx` missing (BUG-003),
  DB reset (BUG-004), `console_config` visibility deferred (BUG-005, still open), and
  **one-active-session-per-user + home "ongoing session" indicator** (BUG-006). All fixed
  except BUG-005 (deferred); BUG-006 shipped as `ongoing-session-banner.tsx`.

### 2026-06-05 (implementation)

- MVP implementation completed across web + realtime services.
- Schema migrated to Glow product model with plans/entitlements.
- Supabase OAuth replaces password auth.
- Stripe billing maps to internal plans.
- Realtime Socket.io service created at `realtime/`.
- Product routes: landing, join, player, standalone, control, billing.
- Mock ads, PWA manifest, wake lock, and fullscreen helpers added.
- SaaS boilerplate dashboard/login/pricing removed.
- Next.js production build passes.

### 2026-06-05

- Product intent documented in `docs/product-intent.md`.
- Strategy tracker created in `docs/strategy.md`.
- Key architecture decision: realtime service will run separately from Next.js.
- Key product decision: players are anonymous; orchestrator uses Supabase OAuth.
- Key monetization decision: plan entitlements live in Postgres, not Stripe.

## Decision Log

### Realtime Service Separate From Next.js

Decision:

- Use a long-running Node.js Socket.io service instead of hosting sockets inside Next.js.

Reason:

- Active rooms require in-memory state, cleanup intervals, presence, matrix state, and low-latency bidirectional messaging.

### Supabase Realtime Not Used As Core Room Engine

Decision:

- Do not use Supabase Realtime as the authoritative room engine for MVP.

Reason:

- The app needs custom plan enforcement, anonymous players, sparse matrix state, cleanup, latency tracking, and controlled host/player permissions.

### Players Anonymous

Decision:

- Players join by room code without account.

Reason:

- The join path must be frictionless during parties/events.

### Entitlements In DB

Decision:

- Store plan features and limits in `plan_entitlements`.

Reason:

- Stripe handles payment. Postgres defines product access.

## Next Immediate Step

Start Phase 0.

Before making product changes:

1. Inspect git status.
2. Confirm package manager.
3. Confirm whether to create a root workspace or keep `web` and `realtime` independent.
4. Review existing env setup.
5. Then begin Phase 1 with the database schema.

