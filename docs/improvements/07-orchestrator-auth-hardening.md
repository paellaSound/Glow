# 07 — Orchestrator Auth Hardening (rejoin)

## Summary

**Security issue (high priority).** Anyone who knows a room code can take over orchestrator
control of a live session. The `orchestrator:rejoin_room` handler grants orchestrator
control **without validating identity or ownership**. The new mobile **Control Device**
surface ([05](./05-control-device-page.md)) and its "Device Mode" QR amplify the exposure,
since the QR carries the room code and the page only gates client-side.

---

## Root cause (confirmed)

`orchestrator:rejoin_room` accepts only `{ roomCode }`, does no auth, and self-assigns the
orchestrator socket:

```632:649:realtime/src/room-manager.ts
  socket.on('orchestrator:rejoin_room', async (payload: { roomCode: string }, callback) => {
    const roomCode = payload.roomCode.toUpperCase();
    const room = rooms.get(roomCode);
    if (!room) { callback({ error: 'Room not found' }); return; }
    await refreshRoomEntitlementsFromTeam(room);
    room.orchestratorSocketId = socket.id;   // ← takes control with no auth
    room.status = 'active';
    ...
  });
```

Every gated handler trusts `room.orchestratorSocketId === socket.id`, so taking over the
socket = full control (lights, visuals, live call, close room). Compare with
`orchestrator:create_room`, which **does** require `accessToken` + `validateAccessToken` +
team context (`realtime/src/room-manager.ts` ~L466-500).

`close_room` already checks `room.orchestratorSocketId === socket.id`, but that's moot once
anyone can become the orchestrator via rejoin.

### Client side

Both desks fetch the Supabase session but **don't pass the token** to rejoin:

```202:208:web/app/(control)/room/[code]/control/page.tsx
      } = await supabase.auth.getSession();
      ...
      await emitWithCallback('orchestrator:rejoin_room', { roomCode: code.toUpperCase() });
```

Same in `web/app/(control)/room/[code]/control-device/page.tsx` (~L157-163). The gate is
effectively client-side only.

---

## Fix / implementation phases

### Phase 1 — Store the owner on the room

- [ ] Add `ownerUserId: string` to `RoomState` (`realtime/src/types.ts`); today it only has
      `teamId`.
- [ ] Populate `ownerUserId` (and keep `teamId`) in `orchestrator:create_room` from the
      validated user.

### Phase 2 — Authenticate `orchestrator:rejoin_room`

- [ ] Change the payload to `{ roomCode, accessToken }`.
- [ ] `validateAccessToken(accessToken)` → reject if invalid (`Unauthorized`).
- [ ] Verify the user **owns** the room: `user.id === room.ownerUserId` (and/or the user's
      team matches `room.teamId` via `getTeamContextForUser`). Reject otherwise
      (`Forbidden`).
- [ ] Only then set `room.orchestratorSocketId = socket.id`.

### Phase 3 — Pass the token from both desks

- [ ] `web/app/(control)/room/[code]/control/page.tsx`: send
      `accessToken: session.access_token` in the rejoin call; redirect to sign-in if no
      session.
- [ ] `web/app/(control)/room/[code]/control-device/page.tsx`: same. The "Device Mode" QR
      target requires the device to be **logged in as the owner**; otherwise the page must
      send to sign-in (with a return URL) and the server rejects the rejoin.

### Phase 4 — Audit other orchestrator entry points

- [ ] Confirm every `orchestrator:*` handler is unreachable without having passed the
      authenticated create/rejoin (they all check `orchestratorSocketId === socket.id`,
      which is now safe once rejoin is authenticated).
- [ ] Consider a short-lived **orchestrator token** (like the visuals token) if you want the
      Device Mode QR to hand off control without a full login on the device — optional, design
      first.

---

## Files to touch

| Path | Change |
| --- | --- |
| `realtime/src/types.ts` | `RoomState.ownerUserId` |
| `realtime/src/room-manager.ts` | Store owner on create; authenticate rejoin (token + ownership) |
| `web/app/(control)/room/[code]/control/page.tsx` | Pass `accessToken` to rejoin |
| `web/app/(control)/room/[code]/control-device/page.tsx` | Pass `accessToken`; sign-in redirect |

---

## Acceptance criteria

- A user who is **not** the room owner cannot become the orchestrator, even with the room
  code and a valid (other) account; the server rejects `rejoin_room` (`Forbidden`).
- An unauthenticated client (no session) is rejected and routed to sign-in.
- The legitimate owner can still rejoin from desktop and from the Control Device (Device
  Mode) after logging in.
- `close_room` and all `orchestrator:*` actions remain owner-only.
- Typecheck clean in `web` and `realtime`.

---

## Notes

- In-memory ownership is fine for the MVP (single realtime instance). If realtime restarts,
  the room is gone anyway (sessions reconciled in DB).
- This does not change the visuals/player surfaces, which keep their own token/anon flow.
