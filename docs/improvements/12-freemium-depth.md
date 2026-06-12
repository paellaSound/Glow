# Freemium depth (Part 04)

Depth limits instead of hard hides: preview everything in desk, emit with per-mode slots.

## Entitlements

| Key | Free | Party | Venue | Pro |
| --- | --- | --- | --- | --- |
| `gif_search_mode` | `featured_page1` | `featured_page1` | `full` | `full` |
| `visuals_emit_slots_per_mode` | 1 | 2 | 999 | 999 |
| `live_call_test_mode_only` | true | true | false | false |
| `poll_production_enabled` | false | true | true | true |

## Visuals desk

- Mode picker changes **desk preview only** (`workingState.mode`).
- **Push to surface** emits `orchestrator:visuals_set_mode` with server slot enforcement.
- YouTube / 3D / standard controls only reach the projector when `surfaceMode` matches.
- `VisualsPreview` shows a preview overlay for non-standard modes.

## Server

- `orchestrator:visuals_set_mode` — callback + `visualsEmittedCounts` per room.
- `orchestrator:live_call_start` — blocked when `liveCallTestModeOnly`.
- `player:poll_vote` — gated on `pollProductionEnabled` (stub until Part 07).

## GIF

- Klipy proxy forces page 1 and returns 403 for page 2+ on `featured_page1`.
- `GifSearch` disables Next and shows `PlanGateBanner` for `gifSearchFull`.

## Live call

- Free/Party: layout preview desk, Go live opens Pro upsell.
- Pro: production mosaic unchanged.

## Helpers

- `web/lib/plans/freemium-depth.ts`
- `realtime/src/freemium-depth.ts`
