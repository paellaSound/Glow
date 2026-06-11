# 04 — Play Devices Fixes

## Summary

Six issues on the player surface (`web/app/(immersive)/room/[code]/play/page.tsx`) and its
helpers, found during the demo:

1. **E1** — Player renders nothing until the DJ makes the first change.
2. **E2** — Media overlay (text/GIF) does not appear in the desk Play-Devices preview,
   although effects do.
3. **E3** — Live-call camera request asks for the **microphone** unnecessarily.
4. **E4** — Phone **flash (LED)** doesn't fire; only the white screen-flash works.
5. **E5** — **Fullscreen** button doesn't work on mobile.
6. **E6** — DJ **social links** are not shown to the player (not in the share URL, not at
   start, not at the end).

---

## Root causes (confirmed) & fixes

### E1 — Idle until first change

`player:join_room` does not replay the current visual state to the joining device:

```669:683:realtime/src/room-manager.ts
      socket.join(`room:${room.code}`);
      socket.join(`player:${publicId}`);
      callback({ accepted: true, ... });
      emitRoomState(io, room);
```

No `visual:preset` / `visual:effect_distribution` / `visual:color` is sent, so the canvas
stays idle until the DJ next emits something.

**Fix:**
- [x] Store the current active visual state in `RoomState` (last preset/distribution/
      color), updated whenever the DJ changes it. (Already resolved in prior visual state updates)
- [x] On `player:join_room` (and `player:rejoin_room`), emit the current state to the new
      `socket.id` — mirroring how `lastVisualsScene` is replayed to the surface. (Already resolved in prior visual state updates)

### E2 — Media overlay missing in preview

`web/components/glow/pattern-sequence-preview.tsx` renders effects only; it has no
`activeMedia` layer.

**Fix:**
- [x] Add the media layer (text / GIF / image) to the preview, respecting the current rule:
      preview shows the item flagged **preview**; if none, show nothing.

### E3 — Unnecessary mic request for live call

The live-call publisher requests audio:

```163:165:web/lib/glow/webrtc.ts
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
    audio: withAudio,
```

The microphone is only needed for **audio-reactive visuals**, which use a separate path
(`web/lib/glow/audio-analyzer.ts`, requested on the DJ/source device — not the player's
camera). The camera mosaic does not need the mic.

**Fix:**
- [x] Force `audio: false` for the live-call publisher (default `withAudio` to false from
      the desk `orchestrator:live_call_start`, and/or hardcode video-only here).

### E4 — LED flash only on the white screen

The torch hook already attempts the real LED and falls back to screen flash:

```240:253:web/lib/glow/torch.ts
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      ...
      const supported = caps.torch === true;
```

The web `torch` constraint works on **Android Chrome** only; **iOS Safari does not support
it** (platform limitation) → iOS will always be screen-flash. This is expected, not a
fixable bug on iOS.

**Fix:**
- [x] Verify the Android path: `caps.torch === true` is detected and the environment-camera
      stream doesn't conflict with the live-call camera.
- [x] Communicate to the user why only screen-flash is available on iOS (small note).
- [x] No change expected to make the LED work on iOS web.

### E5 — Fullscreen broken on mobile

`FullscreenButton` uses the Fullscreen API on a `div`; iOS Safari doesn't support
fullscreen on arbitrary elements (only `<video>` via `webkitEnterFullscreen`).

**Fix:**
- [x] Detect support (`document.fullscreenEnabled`) and **hide** the button where
      unsupported (iOS), or fall back to the immersive/WakeLock approach. For MVP, hide it
      when unsupported.

### E6 — DJ socials to the player (start + end)

The rig has `rig_socials`, but the player never receives them (the share URL such as
`/room/YAKS/play?matrix=0` carries none, and nothing shows at the end).

**Fix:**
- [x] Do **not** put socials in the URL. Deliver the room's enabled rig socials to the
      player via room state — in the `player:join_room` callback or `room:state` — by
      reading the session rig's enabled socials on the server.
- [x] Show socials in the entry/nickname gate (start) and on the **SESSION ENDED** screen
      (end) so attendees can follow the DJ.

---

## Files to touch

| Path | Change |
| --- | --- |
| `realtime/src/room-manager.ts` | Store + replay current visual state on join; include rig socials in room state |
| `web/app/(immersive)/room/[code]/play/page.tsx` | Render initial state; socials at start/end; fullscreen support gate |
| `web/components/glow/pattern-sequence-preview.tsx` | Add media overlay layer |
| `web/lib/glow/webrtc.ts` | Video-only publisher (no mic) |
| `web/components/glow/fullscreen-button.tsx` | Hide when unsupported |
| `web/lib/glow/torch.ts` | Verify Android LED path; iOS note |

---

## Acceptance criteria

- A player joining mid-set immediately shows the current effect/color (no waiting for the
  next DJ change).
- The Play-Devices preview shows the previewed text/GIF overlay, not just effects.
- Adding a device to a live call requests **camera only** (no mic prompt).
- Android Chrome players get the real LED flash; iOS gracefully shows screen-flash with a
  short explanation.
- The fullscreen button is hidden (or works) on mobile — no dead button.
- The DJ's enabled social links appear to the player at the start and on the SESSION ENDED
  screen, delivered via room state (not the URL).
