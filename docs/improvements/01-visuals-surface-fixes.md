# 01 — Visuals Surface Fixes

## Summary

Three issues on the visuals projection surface
(`web/app/(immersive)/room/[code]/visuals/page.tsx`), found during the first full demo:

1. **Room-ended screen never shows.** When the DJ ends the rave, players see the
   "SESSION ENDED" screen but the visuals surface keeps running as if live.
2. **Palette / art changes are sometimes not applied** on the surface.
3. **Media independence:** GIF/text broadcast to **Play Devices** also shows on the
   visuals surface. These must be independent channels — the surface must NOT mirror
   player media (it will get its own text/QR controls in
   [02](./02-visuals-desk-controls.md)).

A fourth, related item — the surface not receiving the **current** visual state when it
connects late — is covered for players in [04](./04-play-devices-fixes.md) §E1; the
surface already replays `lastVisualsScene`, so confirm parity.

---

## Root cause (confirmed)

### 1. Room-ended not delivered to the surface

`closeRoom` only emits `room:closed` to the `room:{code}` topic:

```364:369:realtime/src/room-manager.ts
async function closeRoom(io: Server, room: RoomState, reason: string) {
  ...
  io.to(`room:${room.code}`).emit('room:closed', { reason });
```

But the surface joins **`visuals:{code}`**, not `room:{code}` (see the `visuals:subscribe`
handler: `socket.join(`visuals:${roomCode}`)`). So the surface never receives
`room:closed`. Players join `room:{code}` and therefore do get it.

### 2. Palette / art sometimes not applied

Stale closure in the scene handler. The connect `useEffect` has deps `[token]`, so
`artId` is captured at its initial value and the equality guard becomes unreliable:

```303:305:web/app/(immersive)/room/[code]/visuals/page.tsx
      if (payload.artId && payload.artId !== artId) {
        setArtId(payload.artId as VisualArtId);
      }
```

Palette is written only to `inputRef.current`; if the art controller caches the palette
at init, later palette events won't take effect.

### 3. Media not independent

The `orchestrator:media_*` handlers fan out the **same** payload to players **and** to the
surface:

```1120:1122:realtime/src/room-manager.ts
        io.to(sid).emit('visual:media', eventPayload);
      }
      io.to(`visuals:${room.code}`).emit('visuals:media', eventPayload);
```

(same pattern at 1156–1158, 1185–1187, and clear at 1203–1205). Play-device media should
not reach `visuals:{code}`.

---

## Fix / implementation phases

### Phase 1 — Room-ended on the surface

- [ ] In `closeRoom`, also emit to the surface: `io.to(`visuals:${room.code}`).emit('room:closed', { reason })`.
- [ ] In the visuals page, render a dedicated **SESSION ENDED** screen for the
      `room_closed` state matching the player's design (today it shows the generic
      "🚪 Room closed" card). Reuse the player's `SESSION ENDED` neon treatment.
- [ ] (Optional) On the surface, when socials exist, show DJ socials on the ended screen
      too — align with [04](./04-play-devices-fixes.md) §E6.

### Phase 2 — Reliable palette / art apply

- [ ] Use functional setState to avoid the stale closure:
      `setArtId(prev => payload.artId && payload.artId !== prev ? payload.artId : prev)`.
- [ ] Verify `web/lib/glow/visual-engine.ts` reads palette from `inputRef.current` every
      frame (no caching at controller init); if it caches, re-apply palette on
      `visuals:palette` / `visuals:scene`.
- [ ] Confirm `visuals:scene` and `visuals:palette` both refresh the engine input.

### Phase 3 — Media channel separation

- [ ] Remove the `io.to(`visuals:${room.code}`).emit('visuals:media' | 'visuals:media_clear')`
      fan-out from `orchestrator:media_*` handlers. Play-device media stays player-only.
- [ ] The surface stops listening to player media as its primary source; its media/text
      now comes from the new surface-specific events introduced in
      [02](./02-visuals-desk-controls.md) (`orchestrator:visuals_set_text`, etc.).
- [ ] Keep `lastVisualsScene` as the late-join replay source for the surface.

---

## Files to touch

| Path | Change |
| --- | --- |
| `realtime/src/room-manager.ts` | Emit `room:closed` to `visuals:`; drop player-media fan-out to `visuals:` |
| `web/app/(immersive)/room/[code]/visuals/page.tsx` | SESSION ENDED screen; functional setState for `artId`; stop mirroring player media |
| `web/lib/glow/visual-engine.ts` | Ensure palette is read live each frame |

---

## Acceptance criteria

- Ending the rave shows a styled **SESSION ENDED** screen on the projection surface
  (parity with players).
- Changing palette or switching art from the desk updates the surface every time, with no
  intermittent misses.
- Broadcasting a GIF/text to Play Devices does **not** appear on the visuals surface.
- A surface that connects late still receives the current art/palette/logo
  (`lastVisualsScene` replay).
