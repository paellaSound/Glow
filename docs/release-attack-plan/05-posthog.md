# Release Attack Plan — Part 05: PostHog

**Status:** done  
**Prerequisites:** [01-foundations.md](./01-foundations.md) done; **recommended** after [03-billing-branding.md](./03-billing-branding.md)  
**Blocks:** 06 (recommended)  
**Related:** [posthog-production-analytics.md](../posthog-production-analytics.md)  
**Implementation report:** [web/posthog-setup-report.md](../../web/posthog-setup-report.md)

---

## Summary

Wire **PostHog EU** for product events, upgrade funnel, and **error tracking**. Required
before **public** production launch.

---

## Goals (MVP — not full catalog)

1. Client init with kill switch (`NEXT_PUBLIC_POSTHOG_ENABLED=false` local).
2. Orchestrator `identify` + team group.
3. Core events + `$exception`.
4. Realtime server: device connect/disconnect, unhandled errors.
5. House ad impression event.

---

## Implementation checklist

### Phase A — Setup

- [x] Create PostHog project (EU)
- [x] Add env to `web/.env.example`, `realtime/.env.example`, [deployment.md](../deployment.md)
- [x] Install `posthog-js` (web), `posthog-node` (web server + realtime)

### Phase B — Web client

- [x] `web/lib/posthog-client.ts` (+ config, server, identify)
- [x] Init via `instrumentation-client.ts`
- [x] Pageview on route change (App Router)
- [x] `web/components/analytics/error-boundary.tsx` on control layout
- [x] `/ingest` rewrite for ad-blocker bypass

### Phase C — Identify

- [x] `PostHogIdentify` when user + team loaded
- [x] Update traits on Stripe webhook plan change

### Phase D — Events (minimum)

- [x] `room_created`, `room_create_failed`
- [x] `room_joined` (player + orchestrator)
- [x] `device_connected`, `device_disconnected` (realtime)
- [x] `billing_page_viewed`, `checkout_started`, `checkout_completed`
- [x] `billing_upgrade_modal_shown`, `billing_upgrade_modal_dismissed` (PlanGate)
- [x] `plan_limit_hit`
- [x] `ad_viewed` in `mock-ad.tsx`

### Phase E — Realtime

- [x] `realtime/src/analytics/posthog.ts` singleton
- [x] Flush on shutdown
- [x] `process.on('unhandledRejection')` → `$exception`

### Phase F — Dashboards (PostHog UI)

- [x] Script: `web/scripts/posthog-investor-dashboards.mjs` + spec doc
- [ ] Run script once in prod with personal API key (manual)
- [ ] Alert: `$exception` spike (manual in PostHog UI)

---

## Files to touch

See full list in [posthog-production-analytics.md](../posthog-production-analytics.md) § Files to touch.

---

## Acceptance criteria

1. Staging with `POSTHOG_ENABLED=true`: events appear in Live Events within 30s.
2. Local with `false`: zero requests to PostHog host.
3. Player routes never `identify` with nickname.
4. Thrown error in control desk → `$exception` with `surface: control`.
5. Production deploy checklist includes PostHog env vars.

---

## Out of scope

- Session replay (enable later with flag), full event catalog, feature flags (part 07 optional).
