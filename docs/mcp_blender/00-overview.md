# MCP Blender — Overview

Narrative log of how we use the **Blender MCP** (`blender-mcp` server + Blender addon) to
create 3D assets for Glow's visuals surface, plus the conventions for getting those assets
into the app.

## Why

The visuals surface gains a **3D Visuals mode**: music-reactive 3D scenes rendered with
three.js, controlled from the desk (energy levels 0–5 + one-shot actions). The 3D assets
(models, materials, baked animations) are authored in Blender — driven by Claude through
the Blender MCP — and exported as glTF for the web.

## Setup (one-time)

1. `uv` installed (`brew install uv`).
2. MCP server configured: `claude_desktop_config.json` → `{ "blender": { "command": "uvx", "args": ["blender-mcp"] } }`.
3. Blender addon: download `addon.py` from <https://github.com/ahujasid/blender-mcp>,
   install via Edit → Preferences → Add-ons, enable "Interface: Blender MCP".
4. In Blender's 3D View sidebar (N) → BlenderMCP tab → **Connect to Claude**.
5. Skill `blender-assembly` (installed at `~/.claude/skills/blender-assembly.md`) is applied
   whenever geometry is created — it prevents the common cube-scale / rotation / gap bugs.

## Workflow per asset

1. **Plan** — write the asset spec (parts, animations, target polycount/size) in
   `assets/<asset-name>.md` before opening Blender.
2. **Model via MCP** — Claude drives Blender with `execute_blender_code`, following the
   blender-assembly skill (connection map, verify_bounds/verify_overlap, finalize, audit).
3. **Animate** — bake named actions (e.g. `idle`, `shockwave`, `burst`) so three.js can
   address them by name via `AnimationMixer`.
4. **Export** — glTF binary (`.glb`), Draco-compressed, +Y up, into
   `web/public/visuals3d/<asset-name>.glb` (Supabase storage if it outgrows a few MB).
5. **Log** — append what was done, decisions and gotchas to `assets/<asset-name>.md`.

## Assets

| Asset | Status | Doc |
| --- | --- | --- |
| energy-orb | planned (3D MVP) | [assets/energy-orb.md](./assets/energy-orb.md) |

See [01-asset-pipeline.md](./01-asset-pipeline.md) for the export checklist and how assets
plug into the web app.
