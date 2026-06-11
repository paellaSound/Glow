# Glow MVP — local development

## Prerequisites

- Node.js 20+
- pnpm
- Supabase project linked
- Stripe test keys (optional for billing tests)

## Setup

### 1. Database

```bash
cd web
cp .env.example .env.local
# Fill POSTGRES_URL, Supabase keys, and optionally SUPABASE_SERVICE_ROLE_KEY

# Apply migration (run SQL in Supabase SQL editor or via drizzle)
pnpm db:migrate

# Seed plans, entitlements, and test user (test@test.com / admin123)
pnpm db:seed
```

For local testing without Google OAuth, sign in at `/sign-in` with email and password.
The seed creates `test@test.com` / `admin123` when `SUPABASE_SERVICE_ROLE_KEY` is set.
Alternatively, create an account at `/sign-up` (disable email confirmation in Supabase Auth for faster dev).

### 2. Web app

```bash
cd web
pnpm install
pnpm dev
```

Runs at http://localhost:3000

### 3. Realtime service

```bash
cd realtime
cp .env.example .env
# Fill POSTGRES_URL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

pnpm install
pnpm dev
```

Runs at http://localhost:4000

## Test flow

1. Sign in at `/sign-in` with Google OAuth
2. Create room at `/room/new`
3. Open `/join` in another browser/device
4. Enter room code and pick a matrix position
5. Use control panel at `/room/[code]/control` to light cells

## Mobile testing

Use your machine IP instead of localhost:

```txt
http://YOUR_IP:3000
```

The web app auto-connects the socket to `http://YOUR_IP:4000` when opened via LAN IP.

Restart both services after pulling changes:

```bash
# terminal 1
cd web && pnpm dev

# terminal 2
cd realtime && pnpm dev
```

Verify realtime from the phone browser: `http://YOUR_IP:4000` should return `{"status":"ok","service":"glow-realtime"}`.

If it still hangs on "Connecting...", check macOS firewall allows incoming connections on port 4000.

## Deploy to production

See [docs/deployment.md](./docs/deployment.md) for step-by-step instructions (Vercel + Railway + Supabase + Stripe).
