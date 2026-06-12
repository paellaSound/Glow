<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into the Glow project. The integration covers client-side event tracking via `posthog-js`, server-side event tracking via `posthog-node`, user identification tied to Supabase auth, and a reverse proxy through Next.js rewrites routing to the EU PostHog cluster.

## Files created

| File | Purpose |
|------|---------|
| `instrumentation-client.ts` | Initializes PostHog client-side via Next.js 15.3+ instrumentation hook |
| `lib/posthog-server.ts` | Server-side PostHog client factory for API routes and Server Actions |
| `components/posthog-identify.tsx` | Client component that calls `posthog.identify()` on Supabase auth state changes and `posthog.reset()` on sign-out |

## Files modified

| File | Change |
|------|--------|
| `next.config.ts` | Added EU reverse proxy rewrites (`/ingest/*`) and `skipTrailingSlashRedirect: true` |
| `app/layout.tsx` | Added `<PostHogIdentify />` component to trigger user identification on every page |
| `.env.local` | Set `NEXT_POSTHOG_PROJECT_TOKEN` and `NEXT_POSTHOG_HOST` |
| `lib/auth/actions.ts` | Added `signin_completed` capture + server-side identify in `signInWithPassword` |

## Events instrumented

| Event | Description | File |
|-------|-------------|------|
| `signup_completed` | New user creates an account via email/password | `lib/auth/actions.ts` |
| `signin_completed` | Existing user signs in with email/password | `lib/auth/actions.ts` |
| `room_created` | DJ successfully creates a new lightshow room | `app/(control)/room/new/page.tsx` |
| `room_ended` | DJ ends an active room session from the control desk | `app/(control)/room/[code]/control/page.tsx` |
| `pattern_sent_live` | DJ fires a pattern sequence distribution to all devices | `app/(control)/room/[code]/control/page.tsx` |
| `room_joined` | Guest player taps Connect Device and enters the join flow | `app/(join)/join/page.tsx` |
| `player_device_joined` | Player device accepted into the room by the realtime server | `app/(immersive)/room/[code]/play/page.tsx` |
| `ad_viewed` | House ad displayed before room creation or join | `components/glow/mock-ad.tsx` |
| `checkout_started` | User initiates the Stripe checkout upgrade flow | `lib/payments/actions.ts` |
| `checkout_completed` | Stripe checkout succeeds and subscription is stored | `app/api/stripe/checkout/route.ts` |
| `subscription_activated` | Team subscription becomes active or trialing (webhook) | `lib/payments/stripe.ts` |
| `subscription_cancelled` | Team subscription is cancelled or downgraded (webhook) | `lib/payments/stripe.ts` |

## Next steps

We've built a dashboard and five insights for you to keep an eye on user behavior:

### Dashboard

- [Analytics basics (wizard)](https://eu.posthog.com/project/200710/dashboard/744738)

### Insights

1. [User Acquisition (wizard)](https://eu.posthog.com/project/200710/insights/IQXL28vO) — Daily unique signups and sign-ins over 30 days
2. [Host Onboarding Funnel (wizard)](https://eu.posthog.com/project/200710/insights/M9llRmEP) — Conversion: `signup_completed` → `room_created` → `pattern_sent_live`
3. [Checkout Conversion Funnel (wizard)](https://eu.posthog.com/project/200710/insights/p4rqOtNc) — Conversion: `checkout_started` → `checkout_completed`
4. [Player Engagement (wizard)](https://eu.posthog.com/project/200710/insights/iH5sPjex) — Room joins, device connections, and rooms created over 30 days
5. [Subscription Health (wizard)](https://eu.posthog.com/project/200710/insights/yvE2kkoD) — Weekly subscription activations vs cancellations (churn signal)

### Agent skill

We've left an agent skill folder in your project at `.claude/skills/integration-nextjs-app-router/`. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
