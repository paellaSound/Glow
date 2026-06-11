# 03 — Live-Call State Persistence Across Desk Tabs

## Summary

During a live WebRTC call, switching the control desk from the **Visuals** tab to the
**Devices** tab and back **loses the call state** on the desk: it shows "nobody connected"
even though the call is still active and the visuals surface keeps rendering the cameras.

The call itself does not drop — the surface is a separate page with its own socket and
peer connections. Only the **desk's view/state** of the call is lost.

---

## Root cause (confirmed)

The desk renders tabs conditionally, mounting/unmounting the whole tab subtree:

```496:497:web/app/(control)/room/[code]/control/page.tsx
          {activeTab === 'visuals' && visibleTabs.includes('visuals') ? (
            <VisualsTab
```

(and `activeTab === 'patterns' ? ... : null` for the other tab). The live-call publisher
state (publisher list, peer connections, statuses) lives **inside `VisualsTab`**. When the
DJ switches to Devices, `VisualsTab` unmounts and that state is destroyed. Returning to
Visuals mounts a fresh component with empty state.

---

## Fix / implementation phases

Pick **one** approach (Option A recommended):

### Option A — Lift live-call state up (recommended)

- [ ] Extract the desk-side live-call logic into a hook (e.g.
      `web/lib/glow/use-live-call-publisher-desk.ts` or a `RoomControlProvider` context)
      owned by `control/page.tsx`, so it persists across tab switches.
- [ ] `VisualsTab` consumes the live-call state/actions from the provider instead of
      owning them.
- [ ] Ensure peer connections, publisher statuses (`requested`/`live`/`declined`) and the
      selected layout survive tab changes.

### Option B — Keep the tab mounted, hide with CSS

- [ ] Render both tabs always-mounted and toggle visibility with `hidden` / CSS instead of
      conditional `? :` unmounting.
- [ ] Simpler but keeps both subtrees mounted (heavier; watch for duplicate sockets/timers).

> Prefer Option A: it cleanly separates call ownership from the tab UI and also helps
> [05](./05-control-device-page.md), which needs the same controls on another surface.

---

## Files to touch

| Path | Change |
| --- | --- |
| `web/app/(control)/room/[code]/control/page.tsx` | Own/persist live-call state (provider or hook) |
| `web/components/glow/visuals-tab.tsx` | Consume lifted state instead of owning it |
| `web/lib/glow/` | New desk live-call hook/provider (Option A) |

---

## Acceptance criteria

- With an active live call, switching Visuals → Devices → Visuals keeps showing all
  connected publishers and their statuses.
- The visuals surface mosaic is unaffected by desk tab switches.
- Stopping a publisher / "Stop all" still works after switching tabs.
- No duplicate signaling or leaked peer connections after repeated tab switches.
