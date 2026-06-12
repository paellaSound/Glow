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
- 2026-06-12 — **Asset modeled and exported.** Built in Blender 5.1.2 via the
  official Blender Lab MCP addon socket (note: the configured `uvx blender-mcp`
  bridge speaks a different protocol and never connects — talked to the addon's
  null-delimited JSON socket on `localhost:9876` directly instead). Followed the
  blender-assembly skill: connection map (concentric assembly, all parts centered
  at origin), per-part `verify_bounds()`, `finalize()` and a clean `audit_all()`
  (all rot=0 / scale=1). Parts: Core (UV sphere r=0.6), Shell (r=0.85, alpha
  BLEND), Ring1/Ring2 (tori R=1.15/1.35, tilts applied to mesh data), ShockRing
  (torus R=1.0, held at scale≈0 by `idle`). Materials: Principled BSDF only,
  emission via Emission Strength (`KHR_materials_emissive_strength`). Actions
  stashed in NLA tracks named `idle` (4 s loop), `shockwave` (1.2 s), `burst`
  (0.8 s) and exported with `animation_mode='NLA_TRACKS'`;
  `export_optimize_animation_size=False` plus a non-constant end key keep the
  ShockRing hold channel from being optimized away. Exported GLB+Draco to
  `web/public/visuals3d/energy-orb.glb` — 59 KB, 10,560 tris (budgets: ≤2 MB,
  ≤20k ✓). Source saved at `docs/mcp_blender/assets/energy-orb.blend`. Web side:
  `energy-orb.ts` now loads the glb (GLTFLoader + DRACOLoader, decoders copied to
  `web/public/draco/`) and drives the actions with an AnimationMixer — controller
  contract unchanged.
