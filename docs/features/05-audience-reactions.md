# 05 — Audience Emoji Reactions

## Summary

Players send **emoji reactions** from their phones that float up on the **visuals
surface** ([01](./01-visuals-surface.md)), YouTube-live-chat style: an emoji rising
from the bottom with `"<emoji> by <nickname>"`. Spamming the same emoji **boosts** it
to a larger size (up to a max). The visuals surface runs a **reaction queue** so it can
coalesce, batch, and prioritize incoming reactions without losing the visual.

Emoji set is a curated **allowlist** (no thumbs-down / derogatory options).

---

## Plan gating

| Key | Effect |
| --- | --- |
| `audience_reactions` | Players can send reactions |

Free: allowed but with a tighter rate limit, a smaller emoji set, and no "mega" boost.
Paid: full set + boost. See [plans.md](../plans.md) §4.

---

## Concepts & data model

### Reaction event

```ts
export type ReactionEmoji =
  | 'heart' | 'fire' | 'star' | 'clap' | 'raised_hands'
  | 'party' | 'sparkles' | 'mind_blown' | 'rocket' | 'sun' | 'lightning';
// curated, positive-only; mapped to actual glyphs on the client

export type PlayerReactionPayload = {
  roomCode: string;
  emoji: ReactionEmoji;
};

// server → visuals
export type VisualsReactionEvent = {
  emoji: ReactionEmoji;
  nickname?: string;
  boost: number;   // 1..MAX_BOOST; size tier derived from rapid repeats
  id: string;      // for dedup/animation keys
};
```

The allowlist lives in a shared place (e.g. `packages/glow-visuals` or a small shared
constants module) so client (bar), server (validation), and surface (render) agree.

### Boost logic (server-side)

- The realtime service tracks, per device, recent reaction timestamps per emoji.
- Rapid repeats of the **same** emoji within a window raise `boost` (e.g. 1 → 2 → 3),
  capped at `MAX_BOOST` (the surface maps `MAX_BOOST` to `maxSizePx`).
- A **rate limit** (e.g. N reactions / 10s, tighter on Free) drops excess silently.
- Reactions are **not persisted** (high frequency, like visual events).

### Queue (visuals surface)

The surface holds a bounded queue (`ReactionOverlayConfig.maxConcurrent` from
[01](./01-visuals-surface.md)):

- Enqueue incoming reactions; spawn floating sprites at a controlled rate.
- If the queue exceeds the cap, **coalesce** identical emojis into one larger/boosted
  sprite with a count badge (so a burst stays readable and performant).
- Boosted reactions get priority placement + larger size + longer rise.

```ts
type QueuedReaction = VisualsReactionEvent & { receivedAt: number };
// behaviors: spawn, coalesce(sameEmojiWithinWindow), prioritize(boost desc)
```

---

## Realtime topics & events

| Direction | Event | Payload | Notes |
| --- | --- | --- | --- |
| player → server | `player:reaction` | `PlayerReactionPayload` | validated: allowlist, entitlement, rate limit |
| server → visuals | `visuals:reaction` | `VisualsReactionEvent` | fan-out to `visuals:{code}` |
| server → orchestrator (opt) | `room:reaction_stats` | `{ countsByEmoji, perMinute }` | for a desk meter |

Server validation in `room-manager.ts`:

1. Device is in the room.
2. `room.entitlements.audienceReactions` is true.
3. `emoji` is in the allowlist.
4. Rate limit per device passes.
5. Compute `boost`, look up nickname, broadcast to `visuals:{code}`.

---

## UI / UX

### Player reactions bar ([04](./04-player-identity-and-controls.md))

- A row of the allowed emojis at the bottom of the light surface.
- Tap = send one reaction. Rapid taps escalate boost (visual feedback: the button
  pulses bigger as the player taps faster).
- Subtle local feedback (haptic if available) but the authoritative render is on the
  surface.

### Visuals overlay (surface)

- Sprites rise from the bottom edge over `riseDurationMs`, drifting slightly, fading
  near the top — never covering the center focal point.
- Label `"<emoji> by <nickname>"` next to the sprite (toggle via
  `ReactionOverlayConfig.showNickname`).
- Size = `lerp(baseSizePx, maxSizePx, boost / MAX_BOOST)`.
- Coalesced bursts show a `×N` badge.
- Size/behavior are **visuals config params** (set in the desk Visuals tab or per art).

---

## Implementation phases

### Phase 1 — Allowlist + player bar ✅ (2026-06-08)

- [x] Shared allowlist + glyph map in `web/packages/glow-visuals/src/reactions.ts`
      (`ReactionEmoji`, `EMOJI_GLYPHS`, `REACTION_ALLOWLIST_FREE` vs `_PAID`, rate/boost
      constants), exported from `index.ts`.
- [x] `reactions-toolbar.tsx` on the player surface (bottom-center floating, default
      expanded, collapsible) emits `player:reaction`. Placeholder removed from `player-menu`.

### Phase 2 — Server validation + fan-out ✅ (2026-06-08)

- [x] `player:reaction` handler in `room-manager.ts`: device-in-room + `audienceReactions`
      + plan allowlist + per-device sliding-window rate limit (Free 5/10s, Paid 15/10s) +
      boost escalation (Free cap 1 = no boost, Paid cap 3). Added `glow-visuals` to
      `realtime/package.json` deps.
- [x] Broadcasts `visuals:reaction` to `visuals:{code}`.

### Phase 3 — Surface overlay + queue ✅ (2026-06-08)

- [x] Visuals overlay maps names→glyphs, avoids the center 35–65%, coalesces identical
      (same emoji + nickname) into one boosted `×N` element, size 40→80px by boost, with
      timer-based expiration pruning.

### Phase 4 — Config + desk meter (optional, not built)

- [ ] Expose `ReactionOverlayConfig` in the desk Visuals tab.
- [ ] Optional `room:reaction_stats` meter on the desk.

---

## Built — drift vs spec (2026-06-08)

- **Player bar = bottom-center floating toolbar** (default expanded, collapsible chevron),
  not inside the HUD drawer. The 04 drawer placeholder was removed.
- **Limits:** Free 5 reactions/10s + **boost cap 1** (effectively no boost); Paid 15/10s +
  boost cap 3. Two allowlists: `REACTION_ALLOWLIST_FREE` (lighter) vs `_PAID` (full).
- **Coalescing key** = emoji + nickname (per-sender) with a `×N` badge; sizing lerps
  40→80px by boost.
- `audience_reactions` seeded true on all tiers (limits differentiate Free vs Paid).

---

## Files to touch

| Path | Change |
| --- | --- |
| `packages/glow-visuals/src/reactions.ts` | Allowlist, types, glyph map |
| `web/components/glow/reactions-bar.tsx` | New: player bar |
| `web/app/(immersive)/room/[code]/play/page.tsx` | Mount bar |
| `web/app/(immersive)/room/[code]/visuals/page.tsx` | Reaction overlay + queue |
| `realtime/src/room-manager.ts` | `player:reaction` validation + fan-out |
| `realtime/src/types.ts` | Reaction types + per-device rate state |

---

## Acceptance criteria

- A player taps a heart; within ~200ms (local) a heart floats up on the surface with
  `"❤️ by NICK"`.
- Rapid taps grow the emoji up to the max size; beyond the rate limit, extra taps are
  silently dropped.
- Only allowlisted, positive emojis can be sent (no thumbs-down).
- A burst from many players stays smooth (queue coalesces) and never hides the center.
- Free vs paid limits behave per `plans.md`.

---

## Open questions

1. Exact allowlist + glyphs (and whether the DJ can curate it per rig).
2. Rate limit values per plan; boost window + `MAX_BOOST`.
3. Should reactions ever appear on **player devices** too, or surface-only?
4. Anti-abuse: do we need per-IP/room throttling beyond per-device?
