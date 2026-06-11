# 04 — Player Identity & Controls

## Summary

Today the player surface (`/room/[code]/play`) joins immediately and only shows a
device label like `A1`. Players are hard to guide because the device public id is
opaque. v2:

1. **Require a nickname before entering** the room (mandatory, not optional). The
   nickname becomes the human identifier shown to the DJ and attached to reactions
   ([05](./05-audience-reactions.md)).
2. Add **player controls** on the surface: **Exit**, **Share** (copy room link / show
   QR), and a **Reactions bar** ([05](./05-audience-reactions.md)).

This keeps the screen a "light surface" but gives the player a minimal, unobtrusive
HUD.

---

## Plan gating

None for nickname/exit/share. Reactions follow [05](./05-audience-reactions.md).

---

## Concepts

- Nickname is collected **before** the realtime join, not as an optional query param.
- Reuse the existing join flow: today `/join` passes `?nickname=` and the player page
  auto-joins. Change so the **player page itself** enforces a nickname when none is
  present (deep links / QR land directly on `/room/[code]/play`).
- Persist nickname in `localStorage` (per browser) so reconnects/refreshes reuse it
  (alongside the existing `player-session` device id storage).

```ts
// extend web/lib/glow/player-session.ts
storeNickname(roomCode: string, nickname: string): void;
getStoredNickname(roomCode: string): string | null;
```

Server already accepts `nickname` on `player:join_room` / `player:rejoin_room`
(`realtime/src/room-manager.ts`) and surfaces it in `room:state`. No realtime change
needed for the nickname itself — only the client gate.

---

## UI / UX

### Nickname gate (player page)

- On mount, if no nickname (query param or stored), show a **nickname screen** before
  joining: single input + "Enter". Validate: 1–24 chars, trimmed, no empty.
- After submit: store nickname, then run the existing join/rejoin logic.
- The matrix position picker (if `matrix=1`) comes **after** the nickname gate.

### Player HUD (on the light surface)

Keep it minimal and out of the way (the screen is a light, not a webpage):

- Top bar (existing): status + latency, fullscreen.
- Add a small **menu** (e.g. a ⋯ button) opening a sheet with:
  - **Exit** — leave the room: disconnect socket, clear stored device id/nickname,
    route to `/` (or `/join`). Emits a clean `disconnect`.
  - **Share** — copy join link / open QR (reuse `room-share-controls.tsx` logic and
    the `/room/[code]/qr` page).
  - Show current nickname + label.
- **Reactions bar** — a row of allowed emojis ([05](./05-audience-reactions.md)).

The HUD must auto-hide / be dismissible so it never competes with the light output.

---

## Implementation phases

### Phase 1 — Mandatory nickname ✅ (2026-06-08)

- [x] `NicknameGate` screen on the player page; join gated on it (trimmed 1–24 validation).
- [x] Persist + reuse nickname via `player-session` (`storeNickname`/`getStoredNickname`).
- [x] `/join` prefills the stored nickname when a room code is entered; the player page is
      the source of truth for the gate (handles direct/QR links). Matrix picker runs after.

### Phase 2 — Player menu (exit + share) ✅ (2026-06-08)

- [x] HUD shipped as a **collapsible top-right glassmorphic toolbar** (`player-menu.tsx`),
      not a bottom ⋯ button. Collapsed = single toggle; expanded = Share (copy link),
      View QR (overlay modal), Fullscreen, and a "⋯ More" drawer with nickname/label +
      Exit + reactions placeholder.
- [x] Exit disconnects the socket, clears nickname + device id, routes to `/join` (after
      confirm).

### Phase 3 — Reactions bar (→ feature 05)

- [ ] Emoji bar wired to [05](./05-audience-reactions.md). A clean placeholder was left in
      the player menu drawer.

---

## Built — drift vs spec (2026-06-08)

- **HUD placement:** a collapsible **top-right toolbar** (glassmorphic) instead of a
  bottom ⋯ menu — collapses to a single button to stay out of the light's way. Share / QR /
  Fullscreen are inline; Exit + info live in a "More" drawer.
- **Immersive dark theme:** added the dark theme class on `web/app/(immersive)/layout.tsx`
  so the player surface / nickname gate / panels render correctly regardless of the user's
  global light/dark mode. `NicknameGate` uses `bg-background` (not `bg-black`); the player
  wrapper only overrides `backgroundColor` when not in `pickMode`.
- No realtime change was needed for the nickname (server already accepted it).
- New file: `web/components/glow/player-menu.tsx`.

---

## Files to touch

| Path | Change |
| --- | --- |
| `web/app/(immersive)/room/[code]/play/page.tsx` | Nickname gate + HUD menu |
| `web/lib/glow/player-session.ts` | Store/get nickname |
| `web/components/glow/player-menu.tsx` | New: exit/share sheet |
| `web/components/glow/room-share-controls.tsx` | Reuse share/QR |
| `web/app/(join)/join/page.tsx` | Nickname now required upstream (optional copy tweak) |

---

## Acceptance criteria

- Opening `/room/CODE/play` directly (e.g. via QR) requires a nickname before the
  screen becomes a light surface.
- Nickname survives refresh/reconnect (stored locally) and shows in the DJ's device
  list.
- The player can Exit (clean leave) and Share (copy link / QR) from the surface.
- No regression to reconnect logic.

---

## Open questions

1. Min/max nickname length and profanity filtering on nicknames?
2. Should `/join` be merged into the player page entirely (one entry point)?
3. Allow changing nickname mid-session?
4. Should Exit confirm ("Leave the rave?") to avoid accidental taps?
