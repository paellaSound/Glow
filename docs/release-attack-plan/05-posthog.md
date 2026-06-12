# Release Attack Plan — Part 05: PostHog

**Status:** pending  
**Prerequisites:** [01-foundations.md](./01-foundations.md) done; **recommended** after [03-billing-branding.md](./03-billing-branding.md)  
**Blocks:** 06 (recommended)  
**Related:** [posthog-production-analytics.md](../posthog-production-analytics.md)

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

- [ ] Create PostHog project (EU)
- [ ] Add env to `web/.env.example`, `realtime/.env.example`, [deployment.md](../deployment.md)
- [ ] Install `posthog-js` (web), `posthog-node` (web server + realtime)

### Phase B — Web client

- [ ] `web/lib/analytics/posthog-client.ts`
- [ ] `web/components/analytics/posthog-provider.tsx` — wrap in `web/app/layout.tsx`
- [ ] Pageview on route change (App Router)
- [ ] `web/components/analytics/error-boundary.tsx` on control + immersive layouts
- [ ] Optional: `/api/ph` rewrite for ad-blocker bypass

### Phase C — Identify

- [ ] `usePostHogIdentify` when user + team loaded
- [ ] Update traits on Stripe webhook plan change

### Phase D — Events (minimum)

- [ ] `room_created`, `room_create_failed`
- [ ] `room_joined` (player + orchestrator)
- [ ] `device_connected`, `device_disconnected` (realtime)
- [ ] `billing_page_viewed`, `billing_checkout_started`, `billing_checkout_completed`
- [ ] `billing_upgrade_modal_shown`, `billing_upgrade_modal_dismissed` (from part 02)
- [ ] `plan_limit_hit`
- [ ] `ad_impression` in `mock-ad.tsx` `onTrack`

### Phase E — Realtime

- [ ] `realtime/src/analytics/posthog.ts` singleton
- [ ] Flush on shutdown
- [ ] `process.on('unhandledRejection')` → `$exception`

### Phase F — Dashboards (PostHog UI)

- [ ] Funnel: sign-in → room_created → device_connected (≥2)
- [ ] Funnel: plan_limit_hit → modal → checkout → completed
- [ ] Alert: `$exception` spike

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
