# Asset: energy-orb (3D MVP)

PoC asset for the 3D Visuals mode. Validates the full pipeline
(Blender MCP → glTF → three.js → audio-reactive → energy states) before attempting
rigged characters (Goku is phase 2, reusing everything built here).

## Spec

- **Parts**: core sphere (emissive), translucent outer shell, 1–2 orbiting rings.
- **Animations** (named actions):
  - `idle` — slow rotation + subtle shell pulse, seamless loop.
  - `shockwave` — ring expands outward and fades, ~1.2 s, one-shot.
  - `burst` — core flash + shell scale pop, ~0.8 s, one-shot.
- **Energy levels 0–5** are NOT baked in Blender — the web renderer drives
  scale / rotation speed / emissive intensity / camera height / background lerp
  (floor → space) from the level. Blender only provides geometry + the three actions.
- Budget: ≤ 20k tris, ≤ 2 MB. Export to `web/public/visuals3d/energy-orb.glb`.

## Session log

_(append one entry per Blender MCP session)_

- 2026-06-12 — Spec written. Modeling pending: requires Blender open with the
  BlenderMCP addon connected (the MCP server was configured this session but needs a
  Claude Code restart to load).
- 2026-06-12 — While the Blender asset is pending, the orb ships as **procedural
  three.js geometry** inside `web/packages/glow-visuals-3d/src/energy-orb.ts`
  (core sphere + shell + 2 torus rings + floor grid + starfield). The controller
  contract (`setEnergy`, `triggerAction`) is final — swapping in the .glb later only
  changes the geometry/animation source, not the API. `shockwave` and `burst` are
  implemented as procedural one-shots for now.
