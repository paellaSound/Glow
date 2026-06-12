# Glow Plans & Feature Gating

This document is the source of truth for **which plan unlocks which feature**.
Every v2 feature ([features/00-feature-index.md](./features/00-feature-index.md))
maps to one or more plan entitlement keys here.

Use this doc when:

- deciding the `minTier` of a new feature,
- editing `web/lib/entitlements.ts` (`PLAN_SEED_DATA`),
- writing the entitlement checks in `realtime/src/room-manager.ts`.

Related:

- [product-intent.md](./product-intent.md) — plan intent (Free / Plus 25 / Plus 50 / Pro).
- [plans-marketing-strategy.md](./plans-marketing-strategy.md) — positioning, copy, upgrade UX.
- [Last-sprint-for-release.md](./Last-sprint-for-release.md) — release sprint backlog (scale / branding / depth).
- [architecture.md](./architecture.md) §4.1 — new entitlement keys.

---

## 1. Plans

The four plans stay as defined in `product-intent.md`. v2 does not add a new plan;
it adds new entitlement keys onto the existing tiers.

| Plan | Code | Price (cents/mo) | Devices | Matrix cells | Ads | Intent |
| --- | --- | --- | --- | --- | --- | --- |
| Free | `free` | 0 | 10 | 10 (`rows×cols ≤ 10`, grid UI cap 5×5) | yes | Try the core experience |
| Party | `plus_25` | 299 | 25 | 25 (max grid 5×5) | no | Small parties |
| Venue | `plus_50` | 500 | 50 | 50 (max grid 10×10, custom sizes) | no | Venues, advanced effects |
| Pro | `pro` | 2500 | 999 | 999 (max grid 31×31) | no | Events, all effects, live call |

> Prices and limits are the current seed values in `web/lib/entitlements.ts`. Adjust there;
> this table is descriptive, the seed is authoritative. **`max_matrix_cells` always equals
> `max_devices`** — billing copy must never imply more slots than device cap.

---

## 2. Tier order

```txt
free  <  plus_25  <  plus_50  <  pro
```

A feature with `minTier = plus_25` is available to `plus_25`, `plus_50`, `pro`.
This is the same ordering already implemented in `presetsForPlan()`
(`packages/glow-presets/src/registry.ts`).

---

## 3. v1 entitlements (current seed — for reference)

| Key | Free | Plus 25 | Plus 50 | Pro |
| --- | --- | --- | --- | --- |
| `max_devices` | 10 | 25 | 50 | 999 |
| `max_matrix_cells` | 10 | 25 | 50 | 999 |
| `ads_enabled` | true | false | false | false |
| `audio_reactive` | true | true | true | true |
| `matrix_mode` | true | true | true | true |
| `advanced_matrix` | false | true | true | true |
| `custom_grid_size` | false | false | true | true |
| `max_grid_rows` / `cols` | 5 / 5 | 5 / 5 | 10 / 10 | 31 / 31 |
| `max_room_duration_minutes` | 60 | 180 | 360 | 720 |
| `manual_fallback_mode` | true | true | true | true |
| `priority_reconnect_window_seconds` | 60 | 120 | 180 | 300 |
| `available_presets` | solid, flash, pulse, audio | + wave, rainbow (no audio) | + diagonal, audio | all + strobe |

---

## 4. v2 entitlements (proposed)

Defaults must be **safe/off** so an unseeded plan never accidentally unlocks a
paid feature. Recommended tier assignment:

| Key | Type | Free | Plus 25 | Plus 50 | Pro | Feature |
| --- | --- | --- | --- | --- | --- | --- |
| `visuals_surface` | boolean | false | true | true | true | [01](./features/01-visuals-surface.md) |
| `available_visual_arts` | string[] | `['glow-branded']` | `+ pulse-grid, audio-shader` | all | all | [01](./features/01-visuals-surface.md) |
| `max_rigs` | number | 1 | 3 | 10 | 50 | [02](./features/02-rigs.md) |
| `audience_reactions` | boolean | true* | true | true | true | [05](./features/05-audience-reactions.md) |
| `custom_media_upload` | boolean | false | false | true | true | [06](./features/06-orchestrator-media.md) |
| `sequenced_text` | boolean | false | true | true | true | [06](./features/06-orchestrator-media.md) |
| `gif_broadcast` | boolean | false | false | true | true | [06](./features/06-orchestrator-media.md) |
| `device_flash_control` | boolean | false | true | true | true | [08](./features/08-device-flash-control.md) |
| `effect_layering` | boolean | false | false | true | true | [07](./features/07-preset-mixing-engine.md) |
| `max_pattern_sequences` | number | 1 | 3 | 10 | 50 | [07](./features/07-preset-mixing-engine.md) |
| `webrtc_live_call` | boolean | false | false | false | true | [09](./features/09-webrtc-live-call.md) |
| `max_live_call_devices` | number | 0 | 0 | 0 | 6 | [09](./features/09-webrtc-live-call.md) |
| `custom_rig_logo` | boolean | false | false | true | true | Venue+ white-label on surface / rig |
| `custom_qr_branding` | boolean | false | false | true | true | Venue+ host socials on QR / share |

\* Reactions on Free are allowed but capped harder (lower rate limit, fewer emojis,
no "mega" boosted reactions). See [05](./features/05-audience-reactions.md).

> These are **starting points**. The goal is: Free = taste of everything cheap to
> serve; Plus 50 = the "real DJ" tier (media + GIFs + layering); Pro = everything
> incl. WebRTC.

---

## 5. Feature → entitlement → check matrix

For each feature, the gate must be enforced in **two** places: UI (hide/disable) and
server (reject in `room-manager.ts`). UI-only gating is not secure.

| Feature | Entitlement key(s) | UI gate | Server gate |
| --- | --- | --- | --- |
| Visuals surface | `visuals_surface`, `available_visual_arts` | hide tab / token mint | verify on `visuals:subscribe` |
| Rigs | `max_rigs` | block "new rig" | reject create over limit (API) |
| Audience reactions | `audience_reactions` | hide reaction bar | drop `player:reaction` |
| Custom media | `custom_media_upload` | hide upload | reject `orchestrator:media_image` |
| Sequenced text | `sequenced_text` | hide text panel | reject `orchestrator:media_text` |
| GIF broadcast | `gif_broadcast` | hide GIF search | reject `orchestrator:media_gif` + block proxy |
| Flash control | `device_flash_control` | hide torch toggle | reject `orchestrator:set_torch` |
| Pattern sequences | `max_pattern_sequences` | block "save" over limit | reject create over limit (API) |
| Effect layering | `effect_layering` | single-effect UI | reject multi-effect `run_distribution` payload |
| WebRTC live call | `webrtc_live_call`, `max_live_call_devices` | hide live-call | reject `webrtc:start` + cap N |
| Custom rig logo | `custom_rig_logo` | PlanGate on rig editor + visuals toggle | `visuals_set_logo` forces Glow logo |
| Custom QR / socials | `custom_qr_branding` | PlanGate on socials + share QR | strip socials in `share-info` + join ACK |

**Branding rule:** Free and Party always show **Glow Rave** on surface logo and share QR.
Venue+ may use host logo upload and rig social links. See
[release-attack-plan/03-billing-branding.md](./release-attack-plan/03-billing-branding.md).

---

## 6. How to add a v2 entitlement (checklist)

1. Add the key to `DEFAULT_ENTITLEMENTS` (`web/lib/entitlements-defaults.ts`) with a
   safe default (off / 0 / minimal array).
2. Add the camelCase mapping in `KEY_MAP` (`web/lib/entitlements.ts`).
3. Add the field to the `PlanEntitlements` type in **both**
   `web/lib/entitlements.ts` and `realtime/src/types.ts` (keep them in sync).
4. Add per-tier values in every entry of `PLAN_SEED_DATA`.
5. Re-run `pnpm db:seed` (writes `plan_entitlements` rows).
6. Add the server check in `realtime/src/room-manager.ts`.
7. Add the UI gate (read `roomState.entitlements.<key>`).
8. Add a row to §5 above.

> The room snapshots entitlements at creation (`entitlements_snapshot` in
> `room_sessions`), so changing a plan mid-room does not change an active room.

---

## 7. Open questions

1. Should `audience_reactions` be fully free, or off on Free to push upgrades?
2. Should `available_visual_arts` mirror `available_presets` (string-array seed) or be
   derived from a registry `minTier` like `presetsForPlan()`? (Recommend registry.)
3. Is WebRTC Pro-only forever, or a paid add-on across tiers?
4. Should `max_rigs` count archived rigs?
