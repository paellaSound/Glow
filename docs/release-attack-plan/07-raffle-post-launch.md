# Release Attack Plan — Part 07: Raffle & Post-Launch

**Status:** pending  
**Prerequisites:** [04-freemium-depth.md](./04-freemium-depth.md) done  
**Optional for v1.0 public release** — can ship shortly after launch  
**Related:** [Last-sprint-for-release.md](../Last-sprint-for-release.md) §7.1, §7.3–§7.4

---

## Summary

Ship **raffle mode** (crowd moment + Glow branding on Free). Document and optionally
implement **song requests** and **live polls** as Venue+ post-launch features. Final doc
sync and v1.1 backlog.

---

## Part A — Raffle mode (implement)

### Spec doc

- [ ] Create `docs/improvements/09-raffle-mode.md`

### Behavior

- [ ] Desk control: N winners, start raffle
- [ ] Server: random pick from connected `devicePublicId`s
- [ ] Winner phones: `device:raffle_won` — logo (Glow vs host per `raffle_winner_branding`) + win animation/color
- [ ] Free: max 1 winner; Venue+: configurable N
- [ ] Pro (optional): `useLiveCall` → WebRTC offer to winner only

### Realtime (sketch)

```txt
orchestrator:raffle_start { roomCode, count, animationPreset?, useLiveCall? }
→ device:raffle_won { logoUrl, palette, animation, liveCallOffer? }
```

### Gating

- [ ] Entitlement `max_raffle_winners`
- [ ] PlanGate if count > allowed
- [ ] Server enforcement

### Files

- `realtime/src/room-manager.ts`
- `web/app/(control)/room/[code]/control/page.tsx` or new `raffle-controls.tsx`
- `web/app/(immersive)/room/[code]/play/page.tsx` — winner overlay

---

## Part B — Live polls (document + stub or MVP)

- [ ] Create `docs/features/11-live-polls.md`
- [ ] Venue+ production; Free test UI (if not done in part 04)
- [ ] Surface overlay bars on `/visuals`
- [ ] **Defer full impl** if timeboxed — doc only is OK for v1.1

---

## Part C — Song requests (document)

- [ ] Create `docs/features/10-song-requests.md`
- [ ] Venue+; player suggest + DJ queue + vote priority
- [ ] **Defer impl** to v1.1

---

## Part D — Doc & backlog cleanup

- [ ] Update [features/00-feature-index.md](../features/00-feature-index.md) rows 10–11
- [ ] Update [improvements/00-index.md](../improvements/00-index.md) row 09 raffle
- [ ] Sync [plans.md](../plans.md) full entitlement matrix with shipped code
- [ ] Close [Last-sprint-for-release.md](../Last-sprint-for-release.md) checklist items
- [ ] Mark all parts done in [00-index.md](./00-index.md)

---

## Part E — v1.1 nice-to-haves (backlog only)

- [ ] MP4 house ad replace HTML bumper
- [ ] AI onboarding video on landing
- [ ] Annual Stripe prices
- [ ] PostHog feature flags for gradual rollout
- [ ] Session replay orchestrator-only

---

## Acceptance criteria (raffle)

1. Free host runs raffle → exactly 1 random connected device shows Glow-branded win screen.
2. Venue host runs raffle with 3 winners → 3 devices win with host logo if configured.
3. Pro + live call variant connects winner (if implemented).
4. Specs 10–11 exist in repo even if not implemented.

---

## Release sign-off (after parts 01–06 + desired subset of 07)

- [ ] Staging soak test: 10-device Free party
- [ ] Stripe live mode configured
- [ ] PostHog funnels receiving data 24h
- [ ] [deployment.md](../deployment.md) production checklist complete
- [ ] Terms/Privacy mention analytics if required
