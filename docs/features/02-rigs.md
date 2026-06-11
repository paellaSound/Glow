# 02 — Rigs (DJ Setup Bundles)

## Summary

A **Rig** is the DJ's whole preconfigured setup, saved and reloadable: the visual arts
they bring (as an ordered **cue list** they advance with a **Next** button), how they
want the **control desk** laid out (which tabs/buttons are visible, defaults), the
**color palette** (1–4 colors), an optional **logo**, their **social links**, and an
open **`metadata`** bag for ideas we add later. When a DJ arrives, they "load a Rig"
and everything is ready.

Think of it as the digital equivalent of a VJ/DJ **rig**: console layout + content +
identity, bundled. It is **not** the auth user (that is `profiles`) and **not** a visual
effect (those are presets) — it is the reusable performance configuration.

> **Naming:** entity = `rigs` (table) / `Rig` (type) / "Rig" (UI). Chosen to avoid
> collision with `profiles` (auth user) and `presets` (effects). See
> [architecture.md](../architecture.md) §6.

---

## Plan gating

| Key | Effect |
| --- | --- |
| `max_rigs` | Max saved rigs per user (Free 1 → Pro 50) |

The set of selectable visual arts inside a rig is still gated by
`available_visual_arts` ([01](./01-visuals-surface.md)).

---

## Concepts: three layers inside a Rig

A Rig bundles three distinct things. Modeling keeps stable/queried data in columns and
volatile/evolving data in `jsonb`:

1. **Identity / branding** — palette, logo, social links.
2. **Sequenced content** — an ordered **cue list** of visual arts (`rig_cues`),
   advanced with **Next/Go**.
3. **Console preferences** — control desk layout, which tabs/buttons are visible,
   defaults. Volatile and front-driven → lives in `console_config` (jsonb).

Plus a generic **`metadata` (jsonb)** bag for fast iteration on new front-end fields
without a migration each time.

---

## Data model

### Modeling rule (important)

- **Column** = stable, queried, or validated (palette, logo, default art, flags).
- **`jsonb`** = evolving, front-driven, experimental (`console_config`, `metadata`).
- **`schema_version`** = integer so we can migrate the shape of the jsonb later.
- **Promote** any `metadata` field to a real column once you start querying/filtering
  it for real. `metadata` is the draft; a column is the stable form.

### `rigs`

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `owner_user_id` | uuid → `profiles.id` | the auth user |
| `team_id` | uuid → `teams.id` | scope for entitlement counting |
| `name` | text | "Main set", "Warmup", … |
| `default_visual_art_id` | text | a `VisualArtId` (the art shown before advancing cues) |
| `palette` | jsonb | `string[]` of 1–4 hex colors |
| `logo_asset_path` | text null | Supabase Storage path in `rig-logos` |
| `logo_enabled` | boolean | use logo or not |
| `console_config` | jsonb | desk layout: visible tabs/buttons, defaults (see below) |
| `metadata` | jsonb | open bag for future front-driven fields |
| `schema_version` | integer | shape version for `console_config` + `metadata` |
| `is_default` | boolean | auto-loaded rig for new rooms |
| `created_at` / `updated_at` | timestamptz | |

Constraints:

- `palette` length 1..4, each `^#([0-9a-fA-F]{6})$`.
- One `is_default = true` per user (enforce in app logic).

### `rig_cues` (the cue list / visual art queue)

An ordered queue of visual arts. The DJ advances it live with **Next** (lighting-desk
"GO"). A child table (not a jsonb array) so ordering, reordering, and per-cue params are
clean.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `rig_id` | uuid → `rigs.id` (cascade) | |
| `visual_art_id` | text | a `VisualArtId` |
| `sort_order` | integer | running order; Next = advance `sort_order` |
| `params` | jsonb | per-cue overrides (palette override, speed, art params) |
| `transition` | jsonb | how this cue enters: `{ type: 'cut'\|'fade', durationMs }` |
| `label` | text null | optional cue name ("Drop", "Breakdown") |

### `rig_socials`

Repeatable social links. The **type can repeat** (e.g. two Instagrams) and each has an
**enabled** flag.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `rig_id` | uuid → `rigs.id` (cascade) | |
| `kind` | text | enum-like, see below |
| `label` | text null | optional display label |
| `url` | text | validated per kind |
| `enabled` | boolean | show/use this link |
| `sort_order` | integer | ordering in the list |

Suggested `kind` values (all the usual DJ destinations + `other`):

```txt
soundcloud, spotify, apple_music, bandcamp, beatport, mixcloud, youtube,
instagram, tiktok, x, facebook, threads, twitch, telegram, whatsapp,
website, email, linktree, patreon, other
```

`other` carries a free-form `url` (and `label`); a rig can have **many** `other`
links. The metadata is stored now and **consumed later** (e.g. a "follow the DJ" panel
on the visuals surface, an end-of-set screen, or the join screen).

### `room_sessions` snapshot columns

Add optional `rig_id` and `palette_snapshot` to `room_sessions` so history/analytics
know which rig + look ran (the room snapshots config at creation, like entitlements).

### TypeScript types (web)

```ts
export type RigSocialKind =
  | 'soundcloud' | 'spotify' | 'apple_music' | 'bandcamp' | 'beatport'
  | 'mixcloud' | 'youtube' | 'instagram' | 'tiktok' | 'x' | 'facebook'
  | 'threads' | 'twitch' | 'telegram' | 'whatsapp' | 'website' | 'email'
  | 'linktree' | 'patreon' | 'other';

export type RigSocial = {
  id: string;
  kind: RigSocialKind;
  label?: string;
  url: string;
  enabled: boolean;
  sortOrder: number;
};

export type RigCue = {
  id: string;
  visualArtId: string;
  sortOrder: number;
  params?: Record<string, unknown>;
  transition?: { type: 'cut' | 'fade'; durationMs: number };
  label?: string;
};

// console_config + metadata are intentionally loose; type the parts we know,
// leave room for front-driven growth. Bump schemaVersion when the shape changes.
export type RigConsoleConfig = {
  visibleTabs?: Array<'devices' | 'visuals'>;
  hiddenButtons?: string[];          // button ids the DJ wants hidden
  defaults?: Record<string, unknown>;
  // shipped in Phase 02 (presentation config lives here):
  logoConfig?: {
    position: 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
    effect?: 'none' | 'pulse' | 'spin' | 'float' | 'neon'; // value 'neon'; CSS keyframe is 'neon-glow'
    opacity: number;                 // 0..1
  };
  qrConfig?: {
    enabled: boolean;
    intervalSeconds: number;         // show QR every N seconds…
    durationSeconds: number;         // …for this long; durationSeconds === 0 ⇒ "Always" (permanent)
  };
  [key: string]: unknown;            // forward-compatible
};

export type Rig = {
  id: string;
  name: string;
  defaultVisualArtId: string;
  palette: string[];                 // 1..4 hex
  logoAssetPath: string | null;
  logoEnabled: boolean;
  consoleConfig: RigConsoleConfig;
  metadata: Record<string, unknown>; // open bag
  schemaVersion: number;
  isDefault: boolean;
  cues: RigCue[];
  socials: RigSocial[];
};
```

---

## API (Next.js, Supabase-backed)

CRUD lives in the web app (not realtime), because rigs are account data.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/api/rigs` | List my rigs |
| POST | `/api/rigs` | Create (enforce `max_rigs`) |
| GET | `/api/rigs/[id]` | Read one (with cues + socials) |
| PATCH | `/api/rigs/[id]` | Update name/art/palette/logo/console_config/metadata/default |
| DELETE | `/api/rigs/[id]` | Delete |
| PUT | `/api/rigs/[id]/cues` | Replace cue list (ordered) |
| PUT | `/api/rigs/[id]/socials` | Replace socials list |
| POST | `/api/rigs/[id]/logo` | Upload logo to `rig-logos` (≤256KB, png/svg/webp) |

RLS: owner-only on `rigs` + `rig_cues` + `rig_socials`; storage policy owner-only on
`rig-logos/{user_id}/*`.

### How a rig reaches a room

- On **create room**, the desk loads the selected (or default) rig and sends its
  `palette` + `defaultVisualArtId` + logo + the first cue as the room's initial visuals
  state. The room **snapshots** `rig_id` + `palette_snapshot` into `room_sessions`.
- Presets read the palette through params ([07](./07-preset-mixing-engine.md)); the
  visuals surface reads it via `visuals:palette` ([01](./01-visuals-surface.md)).
- The cue list drives the **Next** control in the desk ([03](./03-control-panel-tabs.md)),
  which advances the active art on the visuals surface.

---

## UI / UX

### Rigs manager (account area, e.g. `/rigs`)

- List of rigs (card per rig: name, palette swatches, art thumbnails, default badge).
- Create/edit form:
  - Name.
  - **Cue list editor**: add visual arts (gated by `available_visual_arts`), reorder,
    set per-cue params + transition, label. This is the ordered queue.
  - Default visual art (the idle art before advancing cues).
  - Palette editor: 1–4 swatches, add/remove, color picker.
  - Logo: upload + "use logo" toggle + preview.
  - Socials editor: add row (kind dropdown + url + optional label + enabled toggle),
    reorder, delete; repeatable kinds allowed; `other` shows label+url.
  - **Console preferences**: which tabs/buttons are visible (writes `console_config`).
- "Set as default".

### In the control desk ([03](./03-control-panel-tabs.md))

- Rig selector in the Visuals tab.
- **Cue list + Next/Go** to advance visual arts live.
- Live palette edits + **"Overwrite Rig"** / **"Save as new"** button (PATCH). A subtle
  "unsaved changes" indicator when live values differ from the stored rig.
- The desk reads `console_config` to show/hide tabs/buttons per the DJ's preference.

---

## Implementation phases

> **Status: DONE (2026-06-07).** Schema, CRUD API (cues + socials + logo), the rigs
> editor (tabs `info`/`cues`/`socials`/`console`), realtime room-load (`create_room`
> loads the rig + persists `rig_id`/`palette_snapshot`), and the `max_rigs` gate all
> shipped. Live edit/overwrite/Next landed with feature [03](./03-control-panel-tabs.md),
> and `/room/new` now has a **rig picker** that passes `rigId` + `paletteSnapshot` at
> creation. See "Built — drift vs spec" below.

### Phase 1 — Schema + migration ✅

- [x] Add `rigs`, `rig_cues`, `rig_socials` to `web/lib/db/schema.ts`
      (incl. `console_config`, `metadata`, `schema_version`).
- [x] Add optional `rig_id` to `room_sessions` (`palette_snapshot` still pending).
- [x] Migration + RLS policies.

### Phase 2 — CRUD API + storage ✅

- [x] `rigs` routes (list/create/read/update/delete) — **verify `max_rigs` gate**.
- [x] Cues + socials replace endpoints (`/api/rigs/[id]/cues`, `/socials`).
- [x] `rig-logos` bucket + logo upload endpoint (size/type validation; **GIF allowed**
      for animated logos).

### Phase 3 — Rigs manager UI ✅

- [x] Rigs list + create/edit form with an **Info & Colors** tab (palette + logo + QR).
- [x] Logo: position (center + 4 corners), animation (pulse/spin/float/neon-glow),
      opacity, GIF support.
- [x] QR config (interval/duration or permanent "Always"), preview modal.
- [x] Draft autosave to `localStorage` + restore/discard banner; dirty checking;
      real-time validation with per-tab error dots.
- [x] Default rig logic.
- [ ] Cue-list editor UI (API exists; editor surfaces with [03](./03-control-panel-tabs.md)).
- [ ] Socials editor UI (API exists; surface in the manager).

### Phase 4 — Room integration ✅ (backend done; desk UI in 03)

- [x] `room_sessions.rig_id` + `palette_snapshot` columns exist.
- [x] Realtime `orchestrator:create_room` accepts `{ rigId, paletteSnapshot }`, persists
      them to `room_sessions`, and builds the initial `lastVisualsScene` from the rig:
      `artId` (default art), `palette`, `logo` (url + position + effect + opacity), and
      `qrConfig` — all replayed to late-joining surfaces.
- [ ] **Desk UI to pick which rig to load on room create** (and pass `rigId`) — this is
      part of [03](./03-control-panel-tabs.md) / room creation.

### Phase 5 — Live edit + overwrite + Next → moved to [03](./03-control-panel-tabs.md)

- [ ] Wire the desk Visuals tab to edit palette/art live, advance cues (Next), and
      overwrite the rig. **This is the next phase (control desk).**

---

## Built — drift vs spec (Phase 02)

| Area | Spec said | Built | Note |
| --- | --- | --- | --- |
| Logo config | `logo_enabled` + path | + **position** (center + 4 corners), **effect** (`none`/`pulse`/`spin`/`float`/`neon`), **opacity** | stored in `console_config.logoConfig` |
| Logo formats | png/svg/webp | + **GIF** (animated logos) | |
| QR on surface | not in 02 | rig-level **QR config** (`enabled`, `intervalSeconds`, `durationSeconds`; `0` = "Always") | stored in `console_config.qrConfig`; rendered + replayed by [01](./01-visuals-surface.md) |
| Editor UX | basic form | **draft autosave** + restore/discard, **dirty checking**, **live validation** + per-tab error dots | shipped |
| Draft storage | localStorage | **account-scoped** key `glow_rig_draft_${userId}` (no leak across accounts on shared device) | shipped |
| `metadata` vs `console_config` | logo/QR → columns/metadata | logo + QR live in **`console_config`** jsonb (`logoConfig`, `qrConfig`) | consistent with the "volatile→jsonb" rule |
| Room integration | spec'd as Phase 4 | **done at realtime/schema**: `create_room` loads rig (art/palette/logo/qr) + persists `rig_id` + `palette_snapshot` | desk auto-loads default rig client-side (→ 03); explicit `/room/new` picker still deferred |
| Cue/socials editors | spec'd | **done** — Rigs Manager has `cues` + `socials` tabs (`formCues`/`formSocials`) | runtime cue control (Next/Prev/Jump) shipped on the desk (→ 03) |

> **Type drift to fix:** `glow-visuals` `VisualArtInput.logo` is typed
> `{ url; opacity; position: 'center' | 'corner' }`, but the realtime scene + rig use 5
> positions (center + 4 corners) **and** an `effect` field. The realtime
> `lastVisualsScene.logo` type already carries both; align the `glow-visuals` package
> type (positions + `effect`) so the surface renders from one shared shape.

---

## Files to touch

| Path | Change |
| --- | --- |
| `web/lib/db/schema.ts` | New tables + room_sessions columns |
| `web/lib/db/migrations/**` | Migration |
| `web/app/api/rigs/**` | CRUD + cues + socials + logo |
| `web/app/(account)/rigs/**` | Manager UI |
| `web/lib/glow/rig.ts` | Types + client helpers |
| `web/lib/entitlements*.ts` | `max_rigs` |

---

## Acceptance criteria

- A user can create up to `max_rigs` rigs; the next is blocked with a clear message +
  upgrade hint.
- A rig stores: a cue list of visual arts (ordered, with per-cue params/transition), a
  default art, 1–4 palette colors, an optional logo, N socials (repeatable kinds +
  multiple `other`), console preferences, and an open `metadata` bag.
- Creating a room loads the default rig's palette/art/logo and first cue.
- Editing colors live in the desk and pressing "Overwrite Rig" persists them.
- Adding a new front-driven field works via `metadata` without a migration; bumping
  `schema_version` documents the change.

---

## Open questions

1. Are rigs owned by the **user** or the **team** (shared)? (Spec assumes user, team
   scope only for counting.)
2. Logo formats: allow SVG (sanitization needed) or raster only?
3. Should palette enforce contrast/validation, or accept anything?
4. Should socials belong on the rig or on a separate "DJ public page"? (Stored on the
   rig now; can be promoted later.)
5. Cue transitions: support crossfade between two arts (needs both mounted) or just
   cut/fade-to-black?
