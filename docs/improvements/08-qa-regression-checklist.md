# 08 — QA / Regression Checklist (post-demo)

Run this end-to-end after the post-demo wave (improvements 01–07) before the next live
use. It re-tests every fix and surfaces the remaining deferred items. Tick as you go.

Setup: web + realtime running, a **Pro** account for live-call/TURN tests, 2–6 phones, and
one projector/second screen for the visuals surface. For cross-network, configure TURN
(Metered) on the web env.

---

## A. Visuals surface (01, 02)

- [ ] **Late join:** with palette/art already changed, open the surface in a new tab → it
      starts with the **current** art + palette + logo (snapshot in the subscribe ACK).
- [ ] **Palette/art live:** change palette and switch art from the desk → surface updates
      every time (no intermittent misses).
- [ ] **Media independence:** broadcast text/GIF to **Play Devices** → it does **not** appear
      on the surface.
- [ ] **Custom text:** send/clear custom text to the surface from the Visuals tab → shows
      only on the surface.
- [ ] **QR control:** toggle show/hide, periodic ("every N s, show for M s") and permanent.
- [ ] **Show name + logo:** rig display name (e.g. `DJ Rig1`) + logo render on the surface.
- [ ] **Embedded preview** in the desk Visuals tab matches the surface.
- [ ] **Session ended:** end the rave → surface shows the styled SESSION ENDED screen.

## B. Pattern sequences (06)

- [ ] Change a palette color / add / remove / enable / disable an effect → players update
      **live** (no need to toggle media or save). Continuous inputs feel debounced.
- [ ] Media toggle still applies instantly.
- [ ] Editor preview matches a player device; Split vs Single-Device modes both correct.

## C. Live call (03, 04-E3, 09)

- [ ] Go live (1 cam) → consent prompt asks **camera only** (no mic).
- [ ] Multi-cam (2–6) + layouts PiP / Half / 2×2 / 3×3; Apply layout recomposes.
- [ ] **Tab persistence:** switch Visuals → Devices → Visuals → publishers/status persist.
- [ ] **Reload persistence:** reload the desk → live state recovers (resync).
- [ ] Stop one / Stop all / decline / disconnect handled cleanly.
- [ ] **Cross-network (TURN):** `/api/webrtc/ice-servers` → `hasTurn: true`; publisher on
      mobile data appears on the surface (surface on WiFi).

## D. Player (04)

- [ ] **Initial render:** join mid-set → device shows the current effect/color immediately.
- [ ] **Socials:** DJ socials show on the entry gate and on SESSION ENDED (delivered via
      room state, not the URL).
- [ ] **Torch:** Android Chrome fires the real LED; iOS shows screen-flash + the note; no
      error; no camera conflict when also in a live call.
- [ ] **Fullscreen:** button hidden where unsupported (iOS); works on desktop.

## E. Clock sync

- [ ] Strobe / preset transitions fire **in sync** across multiple devices (no visible drift).

## F. Control Device (05) + security (07)

- [ ] "Phone Mode" QR on the desktop desk opens `/room/[code]/control-device`.
- [ ] As the **owner** (logged in), operate lights/effects/text/GIF/torch/visuals/live call
      from the phone; changes reflect on players + surface.
- [ ] Operate-only: no rig/sequence create/edit/delete reachable.
- [ ] **Security:** a non-owner (different valid account) cannot become orchestrator with the
      room code → `Forbidden`. No session → redirected to sign-in.

## G. Deploy / infra

- [ ] Railway realtime deploys clean from repo root (no `ERR_PNPM_OUTDATED_LOCKFILE` /
      `workspace:*` / `pnpm: not found`); `/status` returns ok.
- [ ] `VISUALS_TOKEN_SECRET` identical on Vercel + Railway; Share mints + surface subscribes.

## H. Typecheck

```bash
cd web && npx tsc --noEmit
cd realtime && npx tsc --noEmit
```

---

## Still deferred (verify / decide, not blockers)

- [ ] **Image broadcast desk UI** (feature 06): preview supports images, but confirm the desk
      can actually broadcast an image (the UI was a TODO).
- [ ] **`console_config` visibility** (feature 03): confirm the desk hides tabs/buttons per
      the rig config (`getConsoleConfig` / `hiddenButtons`).
- [ ] **Reaction config/meter** (feature 05 Phase 4) — optional.
- [ ] **Device priority chain** (feature 07 Phase 5) — media (06) + torch (08) hooks.
- [ ] **Tech debt:** duplicate `glow-presets` package (`packages/` vs `web/packages/`) — drop
      the orphan.
