# Asset Pipeline — Blender MCP → glTF → three.js

## Export checklist (Blender side)

- All transforms applied (`rotation = 0,0,0`, `scale = 1,1,1` — `audit_all()` from the
  blender-assembly skill must pass).
- Origins set to geometry; scene scale = meters; +Y up on export (glTF default).
- Animations as **named Actions**, stashed in the NLA so the exporter picks them all up.
  Naming convention: `idle` (loop), action triggers in kebab-case (`shockwave`, `burst`).
- Materials: Principled BSDF only (maps cleanly to glTF PBR). Emissive via Emission
  strength — the web renderer multiplies emissive intensity per energy level.
- Export: glTF Binary (`.glb`), Draco compression on, no cameras/lights included
  (the web scene owns camera + lighting).
- Budget: ≤ 50k tris, ≤ 4 MB per asset for the MVP.

## Web side

- Files live in `web/public/visuals3d/<asset>.glb`.
- Rendered by the `glow-visuals-3d` package (three.js + GLTFLoader/DRACOLoader),
  lazy-imported by the surface page so three.js stays out of the main bundle.
- Contract: `mountEnergyOrb(canvas, getInput) => { setEnergy(0–5), triggerAction(id), resize, destroy }`.
  - `getInput()` provides `{ timeMs, palette, audio? }` — same audio features the 2D arts
    receive via the `visuals:audio_features` socket event.
  - Energy level drives scale / rotation speed / emissive intensity / camera height and a
    background lerp (floor → space).
  - `triggerAction(id)` plays the named glTF animation once and crossfades back to `idle`.
- Desk → server → surface events: `orchestrator:visuals_3d_set_energy {level}` and
  `orchestrator:visuals_3d_trigger_action {action}` → `visuals:3d`.
