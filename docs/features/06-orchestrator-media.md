# 06 — Orchestrator Media Broadcasting

## Summary

Give the orchestrator richer content to push to **player devices** (and optionally the
visuals surface):

1. **Custom images** — upload an image (**≤ 1 MB**) and display it on selected devices.
2. **Sequenced text** — push text that plays back **in sequence** across the screen
   (or across devices) when it is too large to fit one screen (marquee / word-by-word /
   spread-across-the-grid).
3. **GIFs** — search and broadcast GIFs via **Klipy** (`api.klipy.com`).
4. **Device targeting slider** — choose **which devices** play **which content**, so
   effects/media can be mixed across the room (works with the layered engine
   [07](./07-preset-mixing-engine.md)).

---

## Plan gating

| Key | Effect |
| --- | --- |
| `custom_media_upload` | Upload + broadcast images |
| `sequenced_text` | Broadcast sequenced/scrolling text |
| `gif_broadcast` | Search + broadcast Klipy GIFs |

Floors (proposed): images & GIFs **Plus 50**, text **Plus 25**. See
[plans.md](../plans.md) §4.

---

## Concepts & data model

### Device targeting

A reusable selector describing **who** receives a piece of content.

```ts
export type DeviceTarget =
  | { kind: 'all' }
  | { kind: 'devices'; publicIds: string[] }     // explicit set (the "slider"/multiselect)
  | { kind: 'matrix_range'; fromRow: number; toRow: number; fromCol: number; toCol: number }
  | { kind: 'fraction'; from: number; to: number }; // 0..1 slice of ordered devices
```

The "slider" UX maps to `fraction` (a range handle over the ordered device list) or to
`devices` (multiselect). The server resolves a target to concrete device sockets.

### Image upload

| Column (`room_media_assets`) | Type | Notes |
| --- | --- | --- |
| `id` | uuid pk | |
| `room_session_id` | uuid → `room_sessions.id` | |
| `team_id` | uuid → `teams.id` | counting/cleanup |
| `storage_path` | text | `room-media/{session}/{id}` |
| `mime` | text | `image/png|jpeg|webp|gif` |
| `bytes` | integer | enforce ≤ 1_048_576 |
| `created_at` | timestamptz | |

- Upload via Next.js API `POST /api/rooms/[code]/media` → validate size/type → Supabase
  Storage `room-media` bucket → return a signed/public URL.
- Devices receive a **URL**, not bytes.

### Sequenced text

```ts
export type SequencedTextPayload = {
  text: string;
  mode: 'marquee' | 'word_by_word' | 'spread_grid';
  // marquee: scroll horizontally; word_by_word: timed words on each screen;
  // spread_grid: distribute chunks across matrix cells in reading order
  speed: number;        // chars/sec or words/sec
  colorHex?: string;    // defaults to palette
  loop: boolean;
};
```

### GIF (Klipy)

GIFs are referenced, never stored. The web app proxies Klipy to keep the key server-side
and add required attribution.

```ts
export type GifBroadcastPayload = {
  slug: string;           // Klipy item slug
  url: string;            // chosen render URL (size-appropriate)
  width: number;
  height: number;
};
```

---

## Klipy integration

Docs: https://docs.klipy.com/gifs-api · Base URL: `https://api.klipy.com`

- **Key is server-side.** Add `KLIPY_APP_KEY` (web env). Never expose it to the client.
- **Proxy route** `GET /api/klipy/search?q=&page=&per_page=` →
  `GET https://api.klipy.com/api/v1/{app_key}/gifs/search?q={q}&page={page}&per_page={per_page}&customer_id={anonId}&content_filter={level}`.
- Also useful: `…/gifs/trending`, `…/gifs/categories`, and the **share trigger**
  `POST …/gifs/share/{slug}` (call when a GIF is broadcast, improves personalization).
- **Content filter:** always pass a safe `content_filter` level (no NSFW) for a public
  rave context.
- **Attribution:** Klipy requires visible KLIPY branding in the picker UI — include it
  in the GIF search component.
- **Limits:** testing keys are capped (100 req/h). Request production access before
  shipping. Allowlist `klipy.com`, `api.klipy.com`, `static*.klipy.com`.
- **`customer_id`:** pass a stable anonymous id (e.g. hashed room/session) — no PII.

Media delivery for the chosen GIF can come straight from `static*.klipy.com` to the
devices/surface (just an `<img>`/`<video>` URL).

---

## Realtime topics & events

| Direction | Event | Payload |
| --- | --- | --- |
| desk → server | `orchestrator:media_image` | `{ roomCode, url, target: DeviceTarget, fit, durationMs? }` |
| desk → server | `orchestrator:media_text` | `{ roomCode, ...SequencedTextPayload, target }` |
| desk → server | `orchestrator:media_gif` | `{ roomCode, ...GifBroadcastPayload, target }` |
| desk → server | `orchestrator:media_clear` | `{ roomCode, target }` |
| server → device | `visual:media` | `{ kind, url|text|..., fit, durationMs }` (per resolved device) |
| server → visuals (opt) | `visuals:media` | same, for the big screen |

Server resolves `DeviceTarget` → device sockets, checks the matching entitlement, then
emits `visual:media` to each. `visual:media` takes priority over presets/colors while
active (extend the visual-engine priority chain — see [07](./07-preset-mixing-engine.md)).

### Player rendering

The player visual engine (`web/lib/glow/visual-engine.ts`) gains a **media layer**:

- `image` / `gif`: render the URL full-bleed with `fit` (`cover`/`contain`), above the
  color/preset layer, for `durationMs` (or until `media_clear`).
- `text`: render according to `mode` (this device's slice for `spread_grid`).

---

## UI / UX (desk Visuals tab / Devices tab)

- **Image:** drop/upload (shows size check, rejects > 1 MB), preview, choose target,
  "Send" / "Clear".
- **Text:** textarea + mode + speed + color + loop + target + "Send".
- **GIF:** Klipy search box (with attribution), grid of results, click to broadcast,
  target selector.
- **Targeting slider:** a range slider over the ordered device list (fraction) and/or a
  multiselect of device chips; live count "→ 12 / 30 devices".

---

## Implementation phases

### Phase 1 — Media layer in the player engine ✅ (2026-06-08)

- [x] `activeMedia` layer in `visual-engine.ts`, priority **below identify, above
      preset/color**; handles `visual:media` + clear. Blackout (`#000000`) behind
      contain-fit images/GIFs to stop preset leakage. Mirrored on the visuals surface.

### Phase 2 — Device targeting ✅ (2026-06-08)

- [x] `DeviceTarget` + `resolveTargetSockets` resolver in `room-manager.ts` (deterministic
      sort + slice for `all` / `fraction` / `devices` chips / `matrix_range`). Targeting UI
      reuses the allocation/distribution approach from [07](./07-preset-mixing-engine.md).

### Phase 3 — Images (backend ✅ / desk UI deferred)

- [x] `POST /api/rooms/[code]/media` (≤ 1 MB, png/jpeg/webp/gif), `room-media` bucket,
      `room_media_assets` table + cleanup on session end.
- [ ] **Image broadcast UI is commented out in the desk** (TODO in the sequence editor
      media subtab) — only text + GIF overlays are wired in the UI for now. `media_image`
      path/backend exist.

### Phase 4 — Sequenced text ✅ (2026-06-08)

- [x] Text panel + `orchestrator:media_text` + player render modes (marquee / word-by-word
      / grid; visuals surface mirrors with a grid display mode).

### Phase 5 — GIFs (Klipy) ✅ (2026-06-08)

- [x] `KLIPY_APP_KEY` server-side + proxy routes `/api/klipy/search|trending|share`
      (hashed user id, safe content filter, share tracking, 401 when unauthenticated).
- [x] GIF search component (KLIPY attribution) + `orchestrator:media_gif`.

---

## Built — drift vs spec (2026-06-08)

- **Text + GIF shipped end-to-end; image broadcast UI deferred.** The upload API,
  `room-media` bucket and `room_media_assets` exist, but the desk's **Image** tab is
  commented out with a TODO — media overlays in the UI are text + GIF for now.
- **Targeting** reuses the fraction/allocation model from [07](./07-preset-mixing-engine.md);
  `resolveTargetSockets` supports `all` / `fraction` / `devices` / `matrix_range`.
- **Gating (seeded):** `sequenced_text` Plus 25+, `custom_media_upload` + `gif_broadcast`
  Plus 50+; Free has none. API returns 401 unauthenticated.
- **Engine:** media renders below identify, above patterns/colors, with blackout behind
  contain-fit assets. Storage + DB records are cleaned up when a room session ends.
- Unrelated tidy-ups shipped same round: desk **"Patterns" tab renamed to "Play Devices"**;
  preset **"Solid Red" renamed to "Solid"** in `glow-presets/registry.ts` (package rebuilt).

---

## Files to touch

| Path | Change |
| --- | --- |
| `web/lib/glow/visual-engine.ts` | Media layer + priority |
| `web/lib/glow/types.ts` | Media + target types |
| `web/app/api/rooms/[code]/media/route.ts` | Image upload |
| `web/app/api/klipy/**` | Klipy proxy (search/trending/share) |
| `web/components/glow/media-panel.tsx` | New: image/text/gif controls |
| `web/components/glow/device-target-slider.tsx` | New: targeting |
| `web/components/glow/gif-search.tsx` | New: Klipy picker + attribution |
| `realtime/src/room-manager.ts` | `orchestrator:media_*` + target resolve |
| `web/lib/db/schema.ts` | `room_media_assets` |
| `web/lib/entitlements*.ts`, `realtime/src/types.ts` | media entitlements |
| `web/.env.example`, `realtime/src/env.ts` | `KLIPY_APP_KEY` |

---

## Acceptance criteria

- DJ uploads a ≤1 MB image and it appears on the targeted devices; >1 MB is rejected
  client- and server-side.
- DJ pushes long text; it plays in sequence (marquee/word/grid) and is readable.
- DJ searches Klipy, picks a GIF, and it plays on the targeted devices/surface, with
  KLIPY attribution shown in the picker and the key never exposed.
- The targeting slider sends content to only the selected subset; others keep their
  current effect (mixing).

---

## Open questions

1. Image fit defaults per orientation; auto-rotate to device orientation?
2. Cleanup policy for `room-media` (delete on room close vs TTL).
3. `spread_grid` text ordering for sparse matrices (skip empty cells?).
4. Klipy: also enable Stickers/Clips/Memes, or GIFs only for now?
5. Do images/GIFs also need a moderation step for public events?
