# 01 — Visuals Projection Surface

## Summary

A new full-screen, output-only client surface at `/room/[code]/visuals` that the DJ
pushes to a projector — on a **second computer** or a **second tab/window of the same
computer**. It renders a selected **visual art** (a WebGL/canvas scene) and reacts to
instructions sent from the control desk over a dedicated realtime topic
(`visuals:{code}`): scene selection, color palette, logo, audio features, broadcast
media, and audience reactions ([05](./05-audience-reactions.md)).

The existing PoC shader (`web/visual_arts/indext.html`) is the seed of the first
visual art.

---

## Plan gating

| Key | Effect | See |
| --- | --- | --- |
| `visuals_surface` | Can open the surface / mint a token | [plans.md](../plans.md) §4 |
| `available_visual_arts` | Which visual arts are selectable | [plans.md](../plans.md) §4 |

Floor: **Plus 25** for the surface. Free can preview a single basic art locally
(standalone) but cannot drive it from a room. (Decision — see Open questions.)

---

## Concepts & data model

### Visual art

A **visual art** is a registered, self-contained renderer (like a preset, but for the
big screen instead of per-device color). It receives a typed input each frame.

```ts
// packages/glow-visuals/src/types.ts  (new package, mirrors glow-presets layout)
export type VisualArtId = 'pulse-grid' | 'neon-tunnel' | 'audio-shader';

export type VisualArtInput = {
  timeMs: number;
  palette: string[];           // 1..4 hex colors from the active rig / live edit
  audio?: AudioFeatures;       // reuse glow-presets AudioFeatures
  logo?: { url: string; opacity: number; position: 'center' | 'corner' } | null;
  params?: Record<string, number | string | boolean>;
};

export type VisualArtDefinition = {
  id: VisualArtId;
  label: string;
  description?: string;
  minTier: PlanTier;
  // mount into a container, return a controller
  mount: (canvas: HTMLCanvasElement, input: () => VisualArtInput) => VisualArtController;
};

export type VisualArtController = {
  setInput: (input: VisualArtInput) => void; // or pull via the input() getter
  resize: () => void;
  destroy: () => void;
};
```

> Mirror the `glow-presets` registry pattern: `PRESET_REGISTRY` → `VISUAL_ART_REGISTRY`,
> `presetsForPlan` → `visualArtsForPlan`. Keep it a pure package so it can be tested.

### Reaction overlay config

Reaction rendering (size/behavior) is a **parameter of the visuals surface**, not the
art. See [05](./05-audience-reactions.md) for the queue/animation; this doc owns where
it mounts (an overlay layer above the art canvas).

```ts
export type ReactionOverlayConfig = {
  baseSizePx: number;        // normal emoji size
  maxSizePx: number;         // boosted ("mega") emoji size
  showNickname: boolean;     // "❤️ by NICK" like YouTube live chat
  riseDurationMs: number;    // float-up time
  maxConcurrent: number;     // queue cap before coalescing
};
```

---

## Realtime topics & events

The surface is a **consumer** of `visuals:{code}` (see
[architecture.md](../architecture.md) §3). It does not emit control events; it only
subscribes and (for WebRTC, [09](./09-webrtc-live-call.md)) exchanges signaling.

### Subscribe handshake

| Direction | Event | Payload |
| --- | --- | --- |
| visuals → server | `visuals:subscribe` | `{ roomCode, token }` |
| server → visuals | `visuals:subscribed` | `{ ok, sessionId, reason? }` + initial `visuals:scene` |

The realtime service verifies `token` (HMAC-SHA256 signed, scope `visuals`, see
[architecture.md](../architecture.md) §3.2) before joining `visuals:{code}`.

### Server → visuals events

| Event | Payload | Source |
| --- | --- | --- |
| `visuals:scene` | `{ artId, params, palette, logo, transition? }` | desk `orchestrator:visuals_set_scene` (also how a rig **cue** advance lands — see below) |
| `visuals:palette` | `{ palette: string[] }` | desk `orchestrator:visuals_set_palette` |
| `visuals:logo` | `{ url \| null, opacity, position }` | desk |
| `visuals:audio_features` | `{ features, timestamp }` | reuse existing audio stream |
| `visuals:reaction` | `{ emoji, nickname?, boost: number }` | player reactions ([05](./05-audience-reactions.md)) |
| `visuals:media` | `{ kind: 'image'\|'text'\|'gif', ... }` | desk media ([06](./06-orchestrator-media.md)) |
| `visuals:live_layout` | `{ tiles: [...] }` | WebRTC mosaic ([09](./09-webrtc-live-call.md)) |

### Desk → server events (control of visuals)

| Event | Payload |
| --- | --- |
| `orchestrator:visuals_set_scene` | `{ roomCode, artId, params?, palette?, logo? }` |
| `orchestrator:visuals_set_palette` | `{ roomCode, palette }` |
| `orchestrator:visuals_set_logo` | `{ roomCode, logo \| null }` |

Server validates orchestrator ownership + `visuals_surface` entitlement + that
`artId` is in `available_visual_arts`, then re-broadcasts to `visuals:{code}`.

**Cue transitions (Next):** the rig's cue list ([02](./02-rigs.md)) is an ordered set
of visual arts. The desk's **Next/Go** button just emits `orchestrator:visuals_set_scene`
for the next cue (with that cue's `params` + `transition`). The surface applies the
`transition` (`cut` or `fade`) when swapping arts. No separate event is required, but a
convenience `orchestrator:visuals_next_cue { roomCode }` may be added so the server
tracks the active cue index for late-joining surfaces.

### Token minting (Next.js API)

```txt
POST /api/rooms/[code]/visuals-token
  auth: Supabase session, must own the active room session
  -> { url: "/room/CODE/visuals#token=<jwt>", token, expiresAt }
```

Signed with `VISUALS_TOKEN_SECRET` (new env var, web + realtime).

---

## UI / UX

### The surface (`/room/[code]/visuals`)

- Pure black until subscribed; then full-bleed `<canvas>` for the active art.
- Overlay layer (absolute) for reactions and broadcast text/image/GIF.
- No chrome by default. A hidden "i" in a corner reveals room code + connection state
  on hover (so a misconfigured projector is debuggable).
- Reads `#token=` from the URL fragment, never from query (avoid logs).
- Wake lock + fullscreen helpers (reuse `web/components/glow/wake-lock.tsx`,
  `fullscreen-button.tsx`).
- Graceful states: `connecting`, `subscribed`, `token expired`, `room closed`.

### How the DJ opens it (from the desk, [03](./03-control-panel-tabs.md))

- "Open visuals" → mints token, opens `/room/[code]/visuals#token=...` in a new
  window/tab (same machine) **or** shows a copyable URL + QR for another machine.

---

## Implementation phases

> **Status: DONE (2026-06-07).** Surface, package, token auth, realtime topic, audio
> forwarding, replay, and reaction overlay shipped. See "Built — drift vs spec" below
> for what differs from the original plan.

### Phase 1 — `glow-visuals` package + arts ✅

- [x] Create `web/packages/glow-visuals` mirroring `glow-presets` structure.
- [x] Port `web/visual_arts/indext.html` shader into `audio-shader` art (WebGL, palette-driven).
- [x] Add `glow-branded` (Free/default, Canvas2D splash) and `pulse-grid` (Plus 25+).
- [x] Registry + `visualArtsForPlan(planCode)` + 10 unit tests.

### Phase 2 — Surface route (output only) ✅

- [x] `web/app/(immersive)/room/[code]/visuals/page.tsx` renders an art full-screen
      (resize + fullscreen).

### Phase 3 — Realtime topic + token ✅

- [x] Add `VISUALS_TOKEN_SECRET` to web + realtime env.
- [x] `POST /api/rooms/[code]/visuals-token` — **HMAC-SHA256** signed token, 6h expiry.
- [x] Realtime: `visuals:subscribe` handler, verify token (constant-time), join `visuals:{code}`.
- [x] Realtime: `orchestrator:visuals_set_scene/palette/logo` → re-broadcast.
- [x] Surface subscribes, applies `visuals:scene` / `visuals:palette` / `visuals:logo`.

### Phase 4 — Audio + reactions wiring ✅

- [x] Forward `visual:audio_features` → `visuals:audio_features` into the surface.
- [x] Mount reaction overlay (renders floating emoji; player-side bar + validation is
      still feature [05](./05-audience-reactions.md)).

### Phase 5 — Hardening ✅

- [x] Token expiry + "room closed" handling.
- [x] Reconnect (surface re-subscribes on socket reconnect).
- [x] Entitlement enforcement on subscribe + scene change.
- [x] **Replay last state:** late-joining surfaces immediately receive the active
      scene/palette/logo.

---

## Built — drift vs spec (Phase 01)

| Area | Spec said | Built | Action |
| --- | --- | --- | --- |
| Token | "signed JWT" | **HMAC-SHA256**, 6h, in URL fragment, constant-time verify | Doc updated; fine |
| Package path | `packages/glow-visuals` | `web/packages/glow-visuals` (mirrors `glow-presets`) | Keep both in sync if duplicated |
| Arts + tiers | Free=`pulse-grid`, P50=`audio-shader` | Free=`glow-branded`, Plus 25=`pulse-grid` + `audio-shader` | `plans.md` updated |
| New art | — | `glow-branded`: Canvas2D splash (logo, room code, "Join at glowtherave.app") for viral growth | Documented |
| QR overlay | not in 01 | Surface renders a **join QR** periodically or permanently (config from the rig) | See "QR overlay" below + [02](./02-rigs.md) |
| Workspace | — | `pnpm-workspace.yaml` `packages/*`, `next.config.ts` `transpilePackages` | Done |

### QR overlay (new)

The surface can show a **join QR** to grow the crowd, configured per rig
([02](./02-rigs.md), stored in `console_config.qrConfig`):

- `enabled`, `intervalSeconds`, `durationSeconds` — shows the QR every interval for a
  duration, **or** a permanent "Always" mode (QR always on screen).
- The QR encodes the player join URL for the room.

---

## Files to touch

| Path | Change |
| --- | --- |
| `web/packages/glow-visuals/**` | New pure package (arts registry + renderers) |
| `web/app/(immersive)/room/[code]/visuals/page.tsx` | New surface route |
| `web/app/api/rooms/[code]/visuals-token/route.ts` | New token mint API |
| `web/lib/glow/socket.ts` | Optional: visuals subscribe helper |
| `realtime/src/room-manager.ts` | `visuals:*` handlers + token verify |
| `realtime/src/auth.ts` | Add visuals-token verification |
| `realtime/src/env.ts`, `web/.env.example` | `VISUALS_TOKEN_SECRET` |
| `web/lib/entitlements*.ts`, `realtime/src/types.ts` | `visuals_surface`, `available_visual_arts` |

---

## Acceptance criteria

- DJ opens `/room/CODE/visuals` in a second tab on the same machine and sees the art.
- Same URL works on a **second computer** via the copyable link/QR (token-based).
- Changing palette/scene on the desk updates the surface in < 200ms locally.
- A non-owner or expired token is rejected; the surface shows a clear error.
- Free plan cannot open a room-driven surface (or only the basic art — per decision).

---

## Open questions

1. ~~Can Free open the surface?~~ **Resolved:** Free opens the surface with the
   `glow-branded` art only; `pulse-grid` + `audio-shader` are Plus 25+.
2. WebGL vs Canvas2D for arts — standardize, or allow both per art? (Currently mixed:
   `glow-branded`/`pulse-grid` Canvas2D, `audio-shader` WebGL.)
3. Should the surface also be the WebRTC mosaic host ([09](./09-webrtc-live-call.md))
   or a separate layer toggled on top?
4. Multiple simultaneous visuals surfaces per room (main + monitor) — allowed?
