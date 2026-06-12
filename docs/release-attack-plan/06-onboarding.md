# Release Attack Plan — Part 06: Onboarding

**Status:** done  
**Prerequisites:** [05-posthog.md](./05-posthog.md) recommended (track funnel)  
**Blocks:** public release polish  
**Related:** [onboarding-first-party.md](../onboarding-first-party.md)

---

## Summary

Guide first-time hosts **in-app** from create room → share → first device → first preset.
Optional embed for AI video when ready.

---

## Goals

1. First-visit checklist on control desk (empty device list).
2. Helper copy on `/room/new` (matrix vs unified).
3. PostHog events: `onboarding_step_completed`, `first_device_connected`, `first_preset_run`.
4. Optional: link/help drawer to full doc or video URL.

**Not in this part:** Full video production (can add URL constant when MP4 ready).

---

## Implementation checklist

### A. Control desk checklist

- [x] Component `FirstPartyOnboarding` — 4 steps:
  1. Share QR / link
  2. Wait for first device
  3. Trigger a preset
  4. (Optional) Open Visuals tab
- [x] Show when `localStorage` flag `glow_onboarding_v1` not complete
- [x] Dismiss / complete persists flag
- [x] Highlight `RoomShareControls` on step 1

### B. Empty states

- [x] Device list empty: “Share the QR — waiting for first phone”
- [x] Auto-advance step 2 when `device_count >= 1`

### C. Create room

- [x] Collapsible “First party?” tip under matrix checkbox (copy from onboarding doc)
- [x] Link to `/help` or external Notion if exists — else tooltip only

### D. Landing (light)

- [x] Ensure home CTAs match onboarding language (“Glow Your Rave” / “Sync Your Screen”)
- [x] “How it works” panel with 3 bullets from onboarding doc

### E. Analytics

- [x] Fire PostHog events per step completion
- [x] `first_device_connected` once per team or per user (decide)

### F. Video (optional)

- [x] Constant `ONBOARDING_VIDEO_URL` — empty until Gemini export ready
- [x] If set, show in onboarding drawer

---

## Files to touch

| Path | Change |
| --- | --- |
| `web/components/glow/first-party-onboarding.tsx` | new checklist drawer |
| `web/lib/onboarding/constants.ts` | steps, storage keys, video URL |
| `web/lib/onboarding/storage.ts` | localStorage helpers |
| `web/lib/onboarding/analytics.ts` | PostHog event helpers |
| `web/app/(control)/room/[code]/control/page.tsx` | mount checklist |
| `web/app/(control)/room/new/page.tsx` | matrix tip |
| `web/components/glow/device-list.tsx` | empty state |
| `web/components/glow/room-share-controls.tsx` | `data-onboarding`, share callback |

---

## Acceptance criteria

1. New user creates room → sees checklist before dismissing.
2. After sharing and one join, step 2 checks complete.
3. After one preset, step 3 complete; flag saved.
4. PostHog shows funnel step events in staging.
5. Returning user does not see checklist (unless reset flag in dev).

---

## Out of scope

- Full `/help` route with MDX, localized video, player onboarding (join is simple).
