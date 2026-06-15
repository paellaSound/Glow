# Marketing & SEO (landing + discoverability)

Improve discoverability, social sharing, and crawl hygiene for the public marketing
surface — without changing the neon visual style.

**Status:** Phase A **done** (2026-06-12). Phases B–F are backlog.

Read first:

- [../architecture.md](../architecture.md)
- [../product-intent.md](../product-intent.md) — product positioning

---

## Summary

The marketing homepage at `web/app/(marketing)/` had good on-page copy and a clear H1, but
almost no SEO infrastructure: no `metadataBase`, Open Graph, Twitter cards, canonical URLs,
`sitemap.xml`, `robots.txt`, or structured data. Content also underplayed Visuals, live polls,
raffles, and the broader “real-time connector suite” positioning.

**Brand rule (locked in):**

| Layer | Value |
| --- | --- |
| Short name | **Glow** |
| Descriptor | **Real-time connector suite for raves, meetings & festivals** |
| Lockup UI | “GLOW” + “THE RAVE” stays in the header lockup — visual identity only, not in `<title>` / OG |

No social profiles exist yet — omit `sameAs` and `twitter:site` until accounts are created.

---

## Phase A — Shipped (2026-06-12)

### A1. Shared SEO module

- [x] `web/lib/seo/site.ts` — `getSiteUrl()`, tagline, description, keywords, `buildMarketingMetadata()`
- [x] `web/lib/seo/json-ld.ts` — `WebSite`, `Organization`, `WebApplication` graph for homepage

**Env:** set `BASE_URL` in production (e.g. `https://glow.app`). Falls back to `https://glow.app`.

### A2. Metadata & social preview

- [x] Root `web/app/layout.tsx` — uses `buildMarketingMetadata()` + PWA manifest
- [x] `web/app/(marketing)/layout.tsx` — marketing defaults
- [x] `web/app/(marketing)/page.tsx` — canonical `/`, homepage title + JSON-LD
- [x] OG / Twitter image: `/logo-wide.png` (interim asset; replace with dedicated 1200×630 when ready)

### A3. Crawl hygiene

- [x] `web/app/robots.ts` — allow `/`, `/join`, `/standalone`, `/privacy`, `/terms`; disallow app routes
- [x] `web/app/sitemap.ts` — public routes only

### A4. Homepage copy (same layout & style)

- [x] Hero badge → “Real-time connector · No app install”
- [x] Hero paragraph → lights + visuals + polls + raffles + reactions + rave/meeting/festival
- [x] CTAs & “How it works” steps updated for Visuals and crowd tools
- [x] Semantic `<section>`, `<h2>`, `<h3>` without visual regressions
- [x] Removed `PageTransitionWrapper` fade-in on marketing layout (LCP / first paint)

### A5. PWA manifest alignment

- [x] `web/public/manifest.webmanifest` description updated to match brand descriptor

### Files touched (Phase A)

| File | Change |
| --- | --- |
| `web/lib/seo/site.ts` | New — metadata helpers |
| `web/lib/seo/json-ld.ts` | New — structured data |
| `web/app/robots.ts` | New |
| `web/app/sitemap.ts` | New |
| `web/app/layout.tsx` | Metadata via SEO module |
| `web/app/(marketing)/layout.tsx` | Metadata; no entrance fade |
| `web/app/(marketing)/page.tsx` | Copy, semantics, JSON-LD |
| `web/public/manifest.webmanifest` | Description |

### Acceptance (Phase A)

- [ ] View source on `/` — `<title>`, `og:*`, `twitter:*`, canonical, JSON-LD present
- [ ] `curl /robots.txt` — disallow rules for `/room/`, `/api/`, etc.
- [ ] `curl /sitemap.xml` — five public URLs with correct `BASE_URL`
- [ ] Share preview (Slack/iMessage/Discord) shows `logo-wide.png` + new title/description
- [ ] Lighthouse SEO score ≥ 90 on `/`
- [ ] No visual change to neon layout beyond copy text

---

## Phase B — FAQ section + FAQPage schema (backlog)

**Goal:** Capture long-tail queries (“do guests need an app?”, “how many phones?”) and enable
FAQ rich results.

### B1. Content (5–8 questions)

Suggested starters:

1. Do guests need to download an app?
2. How many phones can sync in one room?
3. Can I use Glow without signing in?
4. What are Visuals — can I drive a projector?
5. Do you support live polls and raffles?
6. Does it work at meetings as well as raves?

### B2. UI

- Add an FAQ block below “How it works” — same card style (`border`, `bg-card/40`, `rounded-2xl`)
- Use `<details>` / `<summary>` for zero-JS expand (accessible, crawlable)

### B3. Schema

- Extend `buildHomePageJsonLd()` with `FAQPage` when FAQ ships

### Files to touch

- `web/app/(marketing)/page.tsx`
- `web/lib/seo/json-ld.ts`

---

## Phase C — Internal links & footer (backlog)

**Goal:** Help crawlers and users discover public entry points.

### C1. Footer additions

- Link: **Join a room** → `/join`
- Link: **Try solo presets** → `/standalone`
- Optional: **Host a room** → `/auth/signin?redirect=/room/new`

### C2. In-body text links

- One sentence in hero or how-it-works with inline links (not only button CTAs)

### Files to touch

- `web/app/(marketing)/layout.tsx`

---

## Phase D — Core Web Vitals & header (backlog)

**Goal:** Further improve LCP and reduce marketing-page JS.

### D1. Static marketing header

- Split `MarketingHeader`: server shell + lazy client auth chip
- Avoids `/api/user` SWR fetch on anonymous landing first paint

### D2. Dedicated OG image

- Replace `logo-wide.png` with `app/opengraph-image.tsx` or static 1200×630 branded card
- Include tagline + “No app · QR join” subline

### D3. `prefers-reduced-motion`

- If re-introducing entrance animation elsewhere, gate behind reduced-motion preference

### Files to touch

- `web/components/glow/marketing-header.tsx`
- `web/app/opengraph-image.tsx` (optional)

---

## Phase E — Internationalization (backlog)

**Goal:** Spanish (or other) landing when audience expands.

### E1. Route structure

- Option A: `/es` marketing route group
- Option B: `next-intl` with locale prefix

### E2. SEO

- `hreflang` alternates in metadata
- Separate sitemap entries per locale
- `lang` on `<html>` per locale layout

### Files to touch

- New `(marketing)/[locale]/` or i18n config
- `web/app/sitemap.ts`
- `web/lib/seo/site.ts`

---

## Phase F — Social profiles & analytics (backlog)

**Goal:** Wire social when accounts exist.

### F1. Organization schema

- Add `sameAs: ['https://…']` to JSON-LD when URLs are live

### F2. Twitter / OG

- `twitter:site` / `twitter:creator` when handles exist

### F3. Search Console

- Verify domain after `BASE_URL` is stable
- Submit sitemap manually once

---

## Recommended order

```
A (done) → B (FAQ) → C (footer links) → D (OG image + header) → E (i18n) → F (social)
```

B + C are low effort and high SEO value. D before any paid acquisition. E/F when product
market expands.

---

## Keywords reference (for future content)

Use naturally in copy — avoid stuffing:

- sync device lights · rave lighting · live event visuals
- crowd connectivity · live polls · raffle · audience reactions
- projector visuals · matrix grid · audio-reactive
- no app install · QR room join · browser-based

---

## Related docs

- [../posthog-production-analytics.md](../posthog-production-analytics.md) — track landing → host/join funnel
- [12-freemium-depth.md](./12-freemium-depth.md) — polls production gate
- [../release-attack-plan/07-raffle-post-launch.md](../release-attack-plan/07-raffle-post-launch.md) — raffle backlog
