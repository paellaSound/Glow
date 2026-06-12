# PostHog — Investor Dashboard Pack

**Project:** [Glow EU — 200710](https://eu.posthog.com/project/200710)

## Create dashboards (automated)

```bash
POSTHOG_PERSONAL_API_KEY=phx_... node web/scripts/posthog-investor-dashboards.mjs
```

Creates dashboard **Glow — Investor Pack** with six insights:

| Insight | Type | Events |
| --- | --- | --- |
| Activation — Sign-in to live room | Funnel | `signin_completed` → `room_created` → `device_connected` (≥2) → `pattern_sent_live` |
| Monetization — Limit hit to subscription | Funnel | `plan_limit_hit` → `checkout_started` → `checkout_completed` → `subscription_activated` |
| Retention — Rooms per team (weekly) | Trend | `room_created` by `plan_code`, weekly |
| Scale — Peak devices by plan tier | Trend | avg `peak_device_count` on `device_connected` by `plan_code` |
| Acquisition — Sign-ins by method | Trend | `signin_completed` by `method` (email vs google) |
| Reliability — Exceptions by surface | Trend | `$exception` by `surface` |

## Manual setup (if API script unavailable)

1. PostHog → **Dashboards** → New dashboard → name **Glow — Investor Pack**
2. Add each funnel/trend from the table above using **Live events** names
3. Enable **Group analytics** on project settings → group type `team`
4. Pin dashboard for weekly investor review

## Prerequisites in PostHog UI

- **Group analytics:** Settings → Group analytics → enable `team` group type
- **Error Tracking:** Settings → Error Tracking → authorize source map upload
- **Session replay:** Project settings → enable; client only starts on `/billing`, `/room/new`, `/room/*/control`

## Env vars (Vercel production)

```env
NEXT_PUBLIC_POSTHOG_ENABLED=true
NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN=phc_...
POSTHOG_PERSONAL_API_KEY=phx_...   # source maps + dashboard script only
POSTHOG_PROJECT_ID=200710
```

Railway realtime:

```env
POSTHOG_ENABLED=true
POSTHOG_API_KEY=phc_...   # same project token
```
