# PostHog — Setup Report & Status

**Last updated:** 2026-06-12  
**Project:** Glow EU — [PostHog project 200710](https://eu.posthog.com/project/200710)  
**Full spec:** [docs/posthog-production-analytics.md](../docs/posthog-production-analytics.md)  
**Release part:** [docs/release-attack-plan/05-posthog.md](../docs/release-attack-plan/05-posthog.md) — **done**  
**Investor dashboards:** [posthog-investor-dashboards.md](./posthog-investor-dashboards.md)

---

## Current status

| Area | Status |
| --- | --- |
| Client (`posthog-js`) | ✅ EU proxy `/ingest`, init via `instrumentation-client.ts` |
| Server (`posthog-node`) | ✅ No-op when disabled — safe in dev |
| Kill switch | ✅ **Off by default in `development`** (`NEXT_PUBLIC_POSTHOG_ENABLED=false`) |
| Identify (Supabase auth) | ✅ `team_id`, `plan_code`, `subscription_status` from `/api/team` |
| Group analytics | ✅ `posthog.group('team', …)` client + `groupIdentify` server |
| OAuth (Google) sign-in | ✅ `signin_completed` + `signup_completed` in `auth/callback/route.ts` |
| Realtime (Railway) | ✅ `device_connected`, `device_disconnected`, `room_closed`, `plan_limit_hit` |
| Source maps / Error Tracking | ✅ `@posthog/nextjs-config` on Vercel production build |
| Session replay | ✅ Orchestrator routes only (`/billing`, `/room/new`, `/room/*/control`) |
| Error boundary | ✅ Control layout → `$exception` with `surface: control` |
| Billing funnel | ✅ `billing_page_viewed`, modal shown/dismissed, `checkout_started` with `source` |
| Investor-grade dashboards | ✅ Script + manual spec in `posthog-investor-dashboards.md` |

---

## Architecture

```txt
instrumentation-client.ts          → posthog.init() if isPostHogEnabled()
lib/posthog-config.ts              → token, host, isPostHogEnabled()
lib/posthog-client.ts              → captureClientEvent() (client, guarded)
lib/posthog-server.ts              → getPostHogClient() (singleton or noop)
lib/posthog-analytics.ts           → identifyOrchestrator(), captureServerEvent()
lib/posthog-identify-traits.ts     → client identify + group helpers
components/posthog-identify.tsx    → identify / reset + session replay routing
components/analytics/error-boundary.tsx
next.config.ts                     → rewrites /ingest/* + withPostHogConfig (source maps)
realtime/src/analytics/posthog.ts  → server events + $exception
```

### Enablement rules (`isPostHogEnabled`)

PostHog is **OFF** when:

- `NEXT_PUBLIC_POSTHOG_ENABLED=false` (recommended for local dev)
- `NODE_ENV=development` **unless** `NEXT_PUBLIC_POSTHOG_ENABLED=true`
- No project token set

PostHog is **ON** in production when token is set and not explicitly disabled.

Realtime uses `POSTHOG_ENABLED` with the same development default.

---

## Environment variables

Add to **`web/.env.example`** (see file) and **Vercel** for production:

```env
# Off in local dev (default behaviour even if token is present)
NEXT_PUBLIC_POSTHOG_ENABLED=false

# Production (Vercel)
NEXT_PUBLIC_POSTHOG_ENABLED=true
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://eu.i.posthog.com

# Source map upload (Vercel build only — server-only, never expose to client)
POSTHOG_PERSONAL_API_KEY=phx_...
POSTHOG_PROJECT_ID=200710
```

Railway realtime:

```env
POSTHOG_ENABLED=true
POSTHOG_API_KEY=phc_...
POSTHOG_HOST=https://eu.i.posthog.com
```

**Local dev:** set `NEXT_PUBLIC_POSTHOG_ENABLED=false` — no token required, no network calls.

**Test PostHog locally:** `NEXT_PUBLIC_POSTHOG_ENABLED=true` + valid token → Live Events in EU project.

---

## Events instrumented

| Event | Description | Where |
| --- | --- | --- |
| `signup_completed` | Email or Google signup | `lib/auth/actions.ts`, `auth/callback/route.ts` |
| `signin_completed` | Email or Google sign-in | `lib/auth/actions.ts`, `auth/callback/route.ts` |
| `room_created` | Room created successfully | `app/(control)/room/new/page.tsx` |
| `room_ended` | DJ closes room | `control/page.tsx` |
| `pattern_sent_live` | Pattern sequence sent live | `control/page.tsx` |
| `room_joined` | Guest taps Connect (intent, pre-ad) | `app/(join)/join/page.tsx` |
| `player_device_joined` | Device accepted by realtime | `play/page.tsx` |
| `device_connected` | Server device join | `realtime/room-manager.ts` |
| `device_disconnected` | Server device leave | `realtime/room-manager.ts` |
| `room_closed` | Room lifecycle end | `realtime/room-manager.ts` |
| `plan_limit_hit` | Entitlement cap (`max_devices`, `matrix_too_large`) | realtime + web client |
| `ad_viewed` | House ad shown | `components/glow/mock-ad.tsx` |
| `billing_page_viewed` | `/billing` page load | `components/glow/billing-page-tracker.tsx` |
| `billing_upgrade_modal_shown` | PlanGate opens upgrade modal | `components/glow/plan-gate.tsx` |
| `billing_upgrade_modal_dismissed` | Modal closed without checkout | `components/glow/plan-gate.tsx` |
| `checkout_started` | Stripe checkout initiated | `lib/payments/actions.ts` (`source: billing \| modal`) |
| `checkout_completed` | Checkout success redirect | `app/api/stripe/checkout/route.ts` |
| `subscription_activated` | Webhook active/trialing | `lib/payments/stripe.ts` |
| `subscription_cancelled` | Webhook cancelled/downgrade | `lib/payments/stripe.ts` |
| `$exception` | JS errors (client + realtime) | `capture_exceptions`, error boundary, realtime handlers |

---

## Onboarding person properties (Part 06)

Define these **boolean** person properties in PostHog → Settings → Person properties:

| Property | Purpose |
| --- | --- |
| `onboarding_step_1_completed` | Shared QR / link |
| `onboarding_step_2_completed` | First device connected |
| `onboarding_step_3_completed` | First preset sent live |
| `onboarding_step_4_completed` | Visuals tab (optional) |
| `first_device_connected` | Milestone — once per user |
| `first_preset_run` | Milestone — once per user |
| `onboarding_checklist_complete` | User finished tour |
| `onboarding_checklist_dismissed` | User chose "Don't show again" |

Code reads them after `identify` via `posthog.get_property()` and sets them with
`posthog.setPersonProperties()` in `web/lib/onboarding/person-properties.ts`.
When PostHog is off (local dev), `localStorage` keys `glow_onboarding_v1` / `glow_ph_*` are used instead.

**First login:** if `onboarding_checklist_complete` and `onboarding_checklist_dismissed` are null/false, the checklist shows after `identify`. Step props null → start at step 1.

### Debug URL (control desk)

| URL | Effect |
| --- | --- |
| `/room/ABC/control?onboarding=inspect` | **Debug HUD** — read PostHog props on screen, no force |
| `/room/ABC/control?onboarding=debug` | Force checklist + debug HUD |
| `/room/ABC/control?onboarding=first-party` | Force checklist (ignores complete/dismissed) |
| `/room/ABC/control?onboarding=1` | Same as first-party |
| `/room/ABC/control?onboarding=reset-local` | Clears localStorage fallback keys only |

PostHog person props are not cleared by URL — reset in PostHog person profile or use a fresh user.

| Event | Description | Where |
| --- | --- | --- |
| `onboarding_step_completed` | Checklist step done (1–4) | `lib/onboarding/analytics.ts` |
| `first_device_connected` | First guest device (once per user) | `lib/onboarding/analytics.ts` |
| `first_preset_run` | First Send Live (once per user) | `lib/onboarding/analytics.ts` |

---

## Investor dashboard pack

Run once with a personal API key:

```bash
POSTHOG_PERSONAL_API_KEY=phx_... node web/scripts/posthog-investor-dashboards.mjs
```

See [posthog-investor-dashboards.md](./posthog-investor-dashboards.md) for manual setup and insight definitions.

---

## Quick verify

```txt
1. Production/preview: NEXT_PUBLIC_POSTHOG_ENABLED=true + token on Vercel
2. Google sign-in → Live Events: signin_completed { method: google }
3. Create room → room_created; player join → device_connected
4. Hit device cap → plan_limit_hit
5. Local dev: ENABLED=false → zero requests to /ingest
6. Vercel build with POSTHOG_PERSONAL_API_KEY → source maps uploaded
```
