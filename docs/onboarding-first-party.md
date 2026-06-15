# Glow — First Party Onboarding

**Purpose:** guide a new host from sign-in to a running party — room created, devices
connected, first effect shared.  
**Audience:** first-time orchestrators (DJ, host, friend organizing a hangout).  
**Related:** [product-intent.md](./product-intent.md), [visuals-architecture.md](./visuals-architecture.md), [plans-marketing-strategy.md](./plans-marketing-strategy.md), [Last-sprint-for-release.md](./Last-sprint-for-release.md)

---

## What you are setting up

Glow connects many phones (and optionally a projector) into **one synchronized show**:

```txt
                    ┌─────────────────┐
                    │  YOU (host)     │
                    │  Control desk   │
                    │  laptop/device   │
                    └────────┬────────┘
                             │ commands
                             ▼
                    ┌─────────────────┐
                    │  Glow cloud     │
                    │  (realtime hub) │
                    └────────┬────────┘
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │ Device 1  │  │ Device 2  │  │ Device N  │
        │  color   │  │  color   │  │  color   │
        └──────────┘  └──────────┘  └──────────┘

        Optional second output:
                    ┌─────────────────┐
                    │ Projector / TV    │
                    │ (Visuals surface) │
                    └─────────────────┘
```

- **You** are the only person who needs an account.
- **Guests** join with a short room code — no signup.
- All devices receive the same commands **at the same time** through the Glow hub.
- The **big screen** (projector) and **phones** are separate outputs that share colors
  (palette) but can show different content — see [visuals-architecture.md](./visuals-architecture.md).

---

## Before you start

| Item | Recommendation |
| --- | --- |
| Host device | Laptop or tablet for the control desk; stable Wi‑Fi |
| Guest devices | Phones (or tablets). One device = one light in the room |
| Browser | Modern Chrome / Safari / Firefox; allow fullscreen on player phones |
| Account | Google sign-in (or configured OAuth) |
| Plan | Free works for a first try (device cap applies); see [plans-marketing-strategy.md](./plans-marketing-strategy.md) |

**Tip:** Test alone first with two phones (yours + a spare) before the party.

---

## How devices connect (conceptual)

1. **You create a room** → Glow generates a **room code** (e.g. `A7B9`).
2. **You share** the code, link, or QR → guests open it on their phones.
3. Each device **joins the room** through the Glow hub (realtime server).
4. You send **commands** (color, preset, effect) → hub broadcasts → all phones update **in sync**.
5. Each device renders **one flat color** (or media on that screen). In **matrix mode**, each device is assigned a **grid cell** (e.g. `A1`, `B3`) for spatial patterns.

**No direct device-to-device connection.** Everything goes through the room hub. That is why everyone stays in sync even on different networks (guests can use mobile data if Wi‑Fi is weak, though same LAN is best for latency).

### Matrix mode vs unified mode

Choose when creating the room:

| Mode | When creating room | Guest experience | Best for |
| --- | --- | --- | --- |
| **Unified strobe** | “Position Screens in a Grid Matrix?” → **off** | Join → nickname → fullscreen color, no cell picker | Simple party, everyone flashes together |
| **Grid matrix** | Same checkbox → **on**, set rows × cols | Join → nickname → **pick a cell** on the grid | Waves, gradients, spatial patterns |

Matrix size must fit your plan (cells ≤ device limit). See [Last-sprint-for-release.md](./Last-sprint-for-release.md) §3.

---

## Step-by-step: your first party

### Phase 1 — Become the host (2 min)

| Step | Action | Route |
| --- | --- | --- |
| 1.1 | Open Glow home | `/` |
| 1.2 | Sign in with Google | `/auth/signin` |
| 1.3 | Tap **Create room** | `/room/new` |

---

### Phase 2 — Configure the room (2 min)

| Step | Action | Notes |
| --- | --- | --- |
| 2.1 | **Matrix or unified?** | First party: leave matrix **off** for simplicity |
| 2.2 | If matrix **on**: set rows × cols within plan limits | e.g. 3×3 for nine positions |
| 2.3 | **Load Performance Rig** (optional) | Default rig is fine for first time; rigs store palette + visuals cues |
| 2.4 | Tap **Create** | Free plan may show a short ad first |
| 2.5 | You land on the **control desk** | `/room/[code]/control` |

**Save the room code** shown in the header — you will share it.

---

### Phase 3 — Share with guests (2 min)

From the control desk header:

| Step | Action |
| --- | --- |
| 3.1 | Tap **Share** → link copied to clipboard |
| 3.2 | Or **View QR** → show QR on your screen for guests to scan |
| 3.3 | Or **Open QR in new tab** / **Download QR** → print or AirPlay to a TV |
| 3.4 | Optional: enable **Require matrix position in join link** if you use grid mode |

**Ways guests can join:**

- Scan QR → opens join URL
- Open link you sent (WhatsApp, AirDrop, etc.)
- Manually: `/join` → enter room code → optional nickname → **Connect Device**

Guests **do not** need an account.

---

### Phase 4 — Connect your first devices (3 min)

| Step | Action | What you should see |
| --- | --- | --- |
| 4.1 | On a second device, open the share link or enter the code | Join flow |
| 4.2 | Enter a nickname (optional) → **Connect Device** | Fullscreen player |
| 4.3 | On the **control desk**, open the **Devices** tab | Device list shows the new connection |
| 4.4 | Repeat for more phones | Count increases in device list |
| 4.5 | Tap **Identify** on a device (if available) | That device flashes so you know which physical device it is |

**Matrix mode only:** each guest picks an empty cell before entering the player screen.

---

### Phase 5 — Run your first effect (2 min)

On the control desk **Devices** tab:

| Step | Action | Result |
| --- | --- | --- |
| 5.1 | Tap a **color** on the color pad | All connected phones show that color |
| 5.2 | Trigger a **preset** (e.g. Pulse, Flash) | Synchronized animation across phones |
| 5.3 | (Matrix mode) Tap a **cell** on the matrix panel | Only that position lights up |
| 5.4 | Try a **pattern sequence** if configured | Weighted effects split across the crowd |

You are now running a party. Everything else is optional depth.

---

### Phase 6 — Optional: big screen / projector (5 min)

For a TV or projector (second screen):

| Step | Action |
| --- | --- |
| 6.1 | On the control desk, open the **Visuals** tab |
| 6.2 | **Open** or **Share** the visuals surface (link + QR) |
| 6.3 | On the projector device, open that URL (second browser tab or second computer) |
| 6.4 | Pick a visual mode (Standard art, YouTube, 3D, etc.) |
| 6.5 | Change **palette** — projector and phones stay color-coordinated |

The projector shows **full-screen visuals**; phones stay **per-device lights**. Same party, two layers.

---

## Quick path checklist (printable)

```txt
□ Sign in
□ Create room (matrix off for first time)
□ Note room code: __________
□ Share QR or link with guests
□ Confirm 2+ devices in device list
□ Trigger a preset — everyone syncs
□ (Optional) Open Visuals tab → share projector link
```

---

## Roles at a glance

| Role | Who | Needs account? | Typical device |
| --- | --- | --- | --- |
| **Orchestrator** | You | Yes | Laptop / tablet |
| **Player** | Guest | No | Device |
| **Visuals surface** | Output only | No (token link) | Projector / smart TV browser |

**Device Mode:** scan the QR on the control desk to operate a simplified desk from your device — useful when you are away from the laptop.

---

## First-party tips

1. **Same Wi‑Fi** for host and guests when possible — lower latency.
2. **Brightness:** ask guests to turn screen brightness up and disable auto-lock.
3. **Start small:** 3–5 phones before scaling to full room cap.
4. **Identify devices** before assigning matrix positions in a dark room.
5. **Unified mode** first; switch to matrix when you want spatial effects.
6. **Free plan:** Glow branding on QR/logo is normal — upgrade for your own brand ([plans-marketing-strategy.md](./plans-marketing-strategy.md)).

---

## Troubleshooting

| Problem | Likely cause | Fix |
| --- | --- | --- |
| Control desk stuck on “Connecting…” | Realtime URL / network | Check Wi‑Fi; verify deployment env ([deployment.md](./deployment.md)) |
| Guest cannot join | Wrong code / room closed | Re-read code; create a new room if session ended |
| Phones out of sync | Clock / network lag | Same network; toggle fallback mode if needed |
| Device not in list | Join failed / ad skipped | Guest completes join flow; refresh desk |
| Projector black | Visuals URL not opened / token expired | Re-share from Visuals tab |
| Hit device limit | Plan cap | Upgrade via billing or in-app PlanGate modal |

---

## In-app onboarding (implementation notes)

When building UI onboarding (tooltips, checklist drawer, empty states), use this doc as
source copy. Suggested surfaces:

| Surface | Content |
| --- | --- |
| `/room/new` | Matrix vs unified explainer (Phase 2) |
| `/room/[code]/control` first visit | Share → connect → first preset (Phases 3–5) |
| Device list empty state | “Share the QR — waiting for first device” |
| Visuals tab first visit | Projector setup (Phase 6) |

Track completion events via [posthog-production-analytics.md](./posthog-production-analytics.md):
`onboarding_step_completed`, `first_device_connected`, `first_preset_run`.

---

# AI video brief — conceptual onboarding film

The video accompanies this doc. It must **not** depend on real app UI captures — AI video
tools cannot reliably reproduce Glow screens. Use **abstract, schematic, universal** visuals.

---

## Video goals

| Goal | How |
| --- | --- |
| Explain hub-and-spoke sync | Phones never talk to each other; one conductor, one cloud |
| Explain two outputs | Big screen vs hand screens |
| Explain guest flow | Code / QR → device lights up |
| Feel like a party | Energy, music, crowd — not a tutorial screencast |

**Target length:** 60–90 seconds  
**Format:** 16:9 (web + social), optional 9:16 cut from center crop  
**Tone:** upbeat, minimal narration, festival / neon aesthetic  
**Style keywords:** abstract motion graphics, isometric schematic, glowing nodes, dark background, magenta/cyan accents — **no readable UI text, no logos except generic light motifs**

---

## Storyboard (6 beats)

| # | Duration | Visual (schematic) | Message |
| --- | --- | --- | --- |
| 1 | 0–12 s | Dark room; one laptop icon pulses; thin lines radiate to a central **glowing orb** (hub) | “One host controls the show” |
| 2 | 12–25 s | Orb sends ripples outward; **device rectangles** around a table light up **same color** in sync | “Every device becomes a synchronized light” |
| 3 | 25–38 s | **QR-like square** (abstract, not scannable) floats; a hand holds device; line connects device to orb | “Guests scan or tap a link — no app install, no account” |
| 4 | 38–52 s | Split frame: **large rectangle** (projector) shows flowing abstract waves; **small phones** show solid colors; thin line links palette between them | “Projector and phones — two layers, one party” |
| 5 | 52–68 s | Grid of empty cells; phones slide into cells; **wave of color** travels across the grid | “Optional grid — each device is one pixel in the room” |
| 6 | 68–90 s | Wide shot: orb + many glowing phones + projector; fade to tagline space | “Start your first Glow party” |

---

## Master prompt (full video — single generation)

Use as one prompt if your tool supports 60–90 s, or split per scene below.

```text
Abstract motion-graphics explainer, 70 seconds, 16:9, dark nightclub environment.

STYLE: Minimal schematic diagram aesthetic — flat geometric shapes, soft neon glow (magenta and cyan on black), thin connection lines, no photorealistic people faces, no readable text, no software UI, no brand logos. Isometric or top-down table view. Clean, universal, Apple-style simplicity applied to a party metaphor.

STORY: (1) A single laptop icon on a table sends commands to a central pulsing sphere (cloud hub). (2) Six smartphone rectangles around the table flash the same color in perfect sync, connected to the hub by glowing lines. (3) An abstract floating square pattern (QR metaphor, not literal) leads one device to connect to the hub. (4) Split screen: a large wall screen shows fluid abstract shader waves; phones show solid colors; a color palette beam links wall and phones. (5) Top-down grid; phones snap into grid cells; a rainbow wave propagates across the grid. (6) Pull back — hub, phones, and wall screen all pulse together; space for short tagline overlay added in post.

CAMERA: Slow smooth dolly, no shaky cam. Gentle particle dust in air. Music-synced pulse on beats (visual rhythm only).

AVOID: Real app screenshots, legible words, human text on screens, detailed fingers typing, copyrighted logos, realistic app buttons, cluttered interfaces.
```

---

## Per-scene prompts (shot-by-shot generation)

Generate separately and edit together if the tool has shorter limits.

### Scene 1 — Host & hub

```text
Abstract schematic: dark room, single laptop shape glowing on a table, thin neon lines connect to a central pulsing orb (server hub), magenta and cyan on black, isometric view, no text, no UI, minimal geometric motion graphics, 12 seconds.
```

### Scene 2 — Synced phones

```text
Top-down view: six simplified smartphone rectangles arranged around a table, all connected by thin lines to central glowing orb, phones flash bright red simultaneously then blue simultaneously, synchronized pulse, abstract party schematic, neon on black, no readable screens, 13 seconds.
```

### Scene 3 — Guest joins

```text
Abstract join metaphor: floating luminous square grid pattern (QR-like but not scannable), simplified hand silhouette holding device, glowing line from device to central hub orb, dark festive background, minimal motion graphics, no text, 13 seconds.
```

### Scene 4 — Two outputs

```text
Split composition: left side large wall rectangle with flowing abstract liquid light waves; right side three phones showing flat solid colors; thin beam of light shares hue between wall and phones; schematic diagram style, dark room, cyan magenta glow, no UI, 14 seconds.
```

### Scene 5 — Matrix grid

```text
Top-down abstract grid of empty square cells on black floor, simplified device icons slide into cells one by one, then a wave of color travels diagonally across the grid like a stadium wave, minimal neon schematic, no text, 16 seconds.
```

### Scene 6 — Hero wide + tagline plate

```text
Wide cinematic schematic: central hub orb, ring of glowing phones, large projection screen with abstract visuals, all pulsing in sync, slow zoom out, dark party atmosphere, magenta cyan particles, empty center space for text overlay in post-production, 12 seconds.
```

---

## Post-production (add in editor, not AI)

| Element | Content |
| --- | --- |
| Tagline (EN) | “Turn every device into a light. Control the show.” |
| Tagline (ES) | “Convierte cada móvil en una luz. Controla el show.” |
| End card | “Create your room — glow.app” (or real URL) |
| Captions | Optional EN/ES from voiceover script below |
| Music | Royalty-free electronic / house instrumental |

---

## Voiceover script (optional — record separately)

Keep narration sparse; visuals carry the story. ~70 words EN.

**English:**

> You are the conductor.  
> Create a room, share a code — your friends join from their phones, no signup.  
> Every screen becomes a synchronized light, all driven from your desk.  
> Add a projector for a second layer — visuals on the wall, colors in their hands.  
> Optional grid mode turns the crowd into one giant display.  
> Start your first Glow party.

**Español:**

> Tú eres el director.  
> Crea una sala, comparte un código — tus amigos entran desde el móvil, sin registrarse.  
> Cada pantalla se convierte en una luz sincronizada, controlada desde tu mesa.  
> Añade un proyector como segunda capa — visuales en la pared, colores en sus manos.  
> El modo matriz convierte al público en una pantalla gigante.  
> Empieza tu primera fiesta con Glow.

---

## Prompt tuning tips

| Issue | Adjust prompt |
| --- | --- |
| AI adds fake UI | Reinforce: “no software interface, no buttons, no menus” |
| Text gibberish on screens | “all screens show solid color or abstract gradient only” |
| Too photorealistic | “flat vector schematic, motion graphics explainer” |
| Phones not syncing | “all phones change color at exact same moment, synchronized flash” |
| Wrong aspect ratio | Regenerate per scene at 16:9; crop vertical separately |

---

## References

- Product flows: [product-intent.md](./product-intent.md) § Core User Modes
- Dual screen model: [visuals-architecture.md](./visuals-architecture.md) §0
- Share controls: `web/components/glow/room-share-controls.tsx`
- Create room: `web/app/(control)/room/new/page.tsx`
- Join flow: `web/app/(join)/join/page.tsx`
