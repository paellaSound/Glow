# 08 — Device Flash / Torch Control

## Summary

Let the orchestrator control the **camera flash/torch (LED)** of player phones — a
physical strobe in the room, independent of the screen color. This makes effects like
real strobe bursts and synchronized flash waves possible across the crowd.

This is a **best-effort** capability: the Web platform only exposes the torch on some
browsers/devices (notably Android Chrome via `MediaStreamTrack` `torch` constraint;
**iOS Safari does not support web torch control**). The feature degrades gracefully —
devices that can't use the torch fall back to a bright white **screen flash**.

---

## Plan gating

| Key | Effect |
| --- | --- |
| `device_flash_control` | Orchestrator can drive the torch (Plus 25+) |

---

## Concepts

### Capability + permission

- Torch requires a **camera stream** (`getUserMedia({ video: { facingMode: 'environment' } })`)
  and a track that advertises `torch` in `getCapabilities()`.
- It needs an explicit **user gesture + camera permission** on the player. So the
  player must **opt in** ("Enable flash effects") — you cannot silently turn on a
  stranger's flashlight.
- Once enabled, toggle via `track.applyConstraints({ advanced: [{ torch: true|false }] }]`).

```ts
type TorchCapability = {
  supported: boolean;     // capabilities include 'torch'
  enabled: boolean;       // player opted in + permission granted
};
```

### Commands

```ts
export type TorchCommand =
  | { action: 'on' }
  | { action: 'off' }
  | { action: 'pulse'; durationMs: number }       // single blink
  | { action: 'pattern'; onMs: number; offMs: number; cycles: number }; // strobe
```

For tight synchronization, include a `targetTimestamp` (same scheduling model as
`visual:color`) so all capable devices fire together.

---

## Realtime topics & events

| Direction | Event | Payload |
| --- | --- | --- |
| desk → server | `orchestrator:set_torch` | `{ roomCode, target: DeviceTarget, command: TorchCommand, targetTimestamp }` |
| server → device | `device:torch` | `{ command, targetTimestamp }` |
| device → server (opt) | `player:torch_capability` | `{ supported, enabled }` (so the desk knows who can flash) |

`DeviceTarget` is shared with [06](./06-orchestrator-media.md). Server gates on
`device_flash_control` and resolves the target to capable devices.

Torch runs **in parallel** to screen color and is high in the device priority chain
(see [07](./07-preset-mixing-engine.md) §"Device render priority").

---

## UI / UX

### Player

- A clear opt-in: "Enable flash effects" (explains it needs the camera and will blink
  the LED). Until enabled, the device ignores torch commands and may do a screen flash
  fallback instead.
- Show an indicator when torch is active; allow disabling anytime.

### Desk (Devices/Visuals tab)

- Torch controls: On / Off / Pulse / Strobe pattern (rate), with the device target
  selector. A small count of "flash-capable" devices (from `player:torch_capability`).
- Make clear it only affects capable, opted-in devices.

---

## Implementation phases

### Phase 1 — Player torch capability ✅ (2026-06-08)

- [x] Opt-in flow in `web/lib/glow/torch.ts` (camera, `torch` capability detect, hold
      track). Opt-in lives in the RAVER HUD ("Enable flash effects").
- [x] Reports `player:torch_capability`; screen-flash (white full-screen) fallback for
      unsupported / not-opted-in devices.

### Phase 2 — Commands + scheduling ✅ (2026-06-08)

- [x] `device:torch` handling with `targetTimestamp` scheduling. Safeguards: pattern
      duration/cycle caps; camera stream auto-released after **5 min idle**.

### Phase 3 — Desk controls ✅ (2026-06-08)

- [x] `torch-controls.tsx` in the "Play Devices" tab + `orchestrator:set_torch`, gated by
      `device_flash_control` (UI + server). Shows "X flash-capable / Y targeted" count and
      reuses the shared target selector (All / Slice / Chips).

### Phase 4 — Effect integration ✅ (2026-06-08)

- [x] A live `strobe` preset can also emit a synced torch pattern (125 ms on/off) when the
      plan has `device_flash_control`.

---

## Files to touch

| Path | Change |
| --- | --- |
| `web/lib/glow/torch.ts` | New: torch capability + control hook |
| `web/app/(immersive)/room/[code]/play/page.tsx` | Opt-in + `device:torch` handling |
| `web/components/glow/torch-controls.tsx` | New: desk controls |
| `realtime/src/room-manager.ts` | `orchestrator:set_torch`, `player:torch_capability` |
| `web/lib/entitlements*.ts`, `realtime/src/types.ts` | `device_flash_control` |

---

## Acceptance criteria

- An Android Chrome player can opt in; the DJ fires a strobe pattern and the LED blinks
  in sync with other capable devices.
- iOS / unsupported devices never error; they either do nothing or a screen-flash
  fallback (per config).
- Torch is never enabled without explicit player opt-in + camera permission.
- Gated by `device_flash_control` on UI and server.

---

## Built — drift vs spec (2026-06-08)

- **Push-to-flash model:** desk controls are **Hold Pulse** / **Hold Strobe** (active only
  while held; release = off), not On/Off toggles — avoids "stuck on" flashes.
- **Player manual flash:** besides DJ control, the player has its own circular **Flash**
  button (hold = local flash; LED if opted-in, else white screen). Attendees can
  participate independently of the DJ.
- **Strobe integration shipped** (Phase 4): live `strobe` preset emits a 125 ms on/off
  torch pattern when entitled.
- **Battery:** camera stream auto-released after 5 min idle. Opt-in + permission always
  required before any LED use; old rooms keep their entitlement snapshot (need a new room
  after the Plus 25+ seed to see the controls).

## Open questions

1. Screen-flash fallback: default on or off for unsupported devices?
2. Battery/heat safeguards (max strobe duration / cooldown)?
3. Should torch be part of the `strobe` preset or a separate manual control only?
4. Keeping a camera stream open drains battery — auto-release after N minutes idle?
