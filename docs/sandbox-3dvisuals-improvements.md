# Sandbox & 3D Visuals — Replanteo + Spec de implementación (v0)

Replanteo del pipeline 3D (sandbox + reproducción) **y spec ejecutable por fases**.
Sustituye conceptualmente a [visuals-3d-sandbox.md](./visuals-3d-sandbox.md) y
[visuals-3d-player.md](./visuals-3d-player.md) (siguen válidos como "estado
actual"). Nada toca el render de producción (`energy-orb`): todo vive bajo
`/dev/visuals3d`.

> **Cómo leer este documento.** Las secciones §1–§6 son el *qué* y el *porqué*
> (modelo mental). Las secciones §7–§9 son el *cómo* exacto: tipos, firmas,
> archivos y criterios de aceptación. **La implementación se hará fase a fase
> (§9); cada fase es verificable y negociable de forma aislada.** Está escrito
> para que un agente de implementación lo siga sin tomar decisiones de diseño:
> si algo no está definido aquí, **pregunta antes de inventar**.

> **Decisiones de arranque (cerradas):**
> 1. El panel de control en vivo vive en **`/dev`** (evoluciona el player), no en
>    el desk de producción todavía.
> 2. Sandbox reorganizado con **layout estilo Blender**.
> 3. Persistencia: **IndexedDB + zip** (sin backend); Supabase es Nivel 2.

---

## 1. Por qué replantear

El modelo actual funciona pero se complicó en dos planos:

1. **Vocabulario disperso.** `idleClip`, `actions[]` (clips sueltos),
   `actionTriggers` (banda→clip), `audioBindings` (banda→parámetro)… son piezas
   potentes sin un concepto mental unificado de "qué disparo y qué pasa".
2. **El panel no habla el idioma del diseñador.** Falta la metáfora 3D estándar
   (viewport + outliner + properties + timeline) que un artista de Blender/C4D
   reconoce al instante.

La filosofía no cambia: **el diseñador autora parámetros, el motor los interpreta
en tiempo real**. Cambia el **modelo de dominio** (más limpio) y la
**presentación** (estándar de industria).

---

## 2. Modelo mental nuevo (3 conceptos)

Una **escena** = **curva de energía de 6 niveles (0–5)** + **acciones**
disparables + **reactividad de audio continua**.

### 2.1 Nivel de energía (0–5) — "la sección de la noche"
Lo fija el operador (manual) o el modo auto (energía media). Define el **estado
base**:

| Propiedad | Qué es | vs hoy |
| --- | --- | --- |
| **GLB** | Modelo del nivel | igual |
| **Fondo (HSL)** | Color de fondo + tinte ambiental; interpola entre niveles | igual |
| **Luz clave** | Color (HSL) + intensidad + dirección de la luz sobre el modelo | **nuevo** |
| **Clip pool** | **Lista** de animaciones idle que rotan en el nivel | **nuevo** (era 1 `idleClip`) |
| **Reproducción del pool** | `random`/`sequential` + tiempo mínimo por clip | **nuevo** |
| **Cámara** | Encuadre (pos/target/FOV); interpola entre niveles | igual |
| **cameraSource** | `engine` / `glb` | igual |

El nivel reproduce sus clips saltando (random); el operador puede **🔒 bloquear**
el clip actual o **⏭ saltar** al siguiente.

### 2.2 Acción — "un botón que dispara un efecto compuesto" (pieza clave)
Una acción tiene **nombre** ("drop", "funny dance") y agrupa **uno o varios
efectos** que ocurren juntos:

```
Action = { id, name, effects: Effect[], transition }
Effect =
  | animation  (clip, siempre one-shot sobre el idle)
  | camera     (encuadre destino + duración)
  | background (HSL)
  | light      (HSL + intensidad)
```

Se dispara desde un **botón** (manual) o un **trigger de audio** (banda cruza
umbral). **Unifica** los `actions[]` y `actionTriggers` de hoy: ambos disparan
una Acción. Cubre los efectos de v0 que pediste: animación del GLB, cámara/FOV,
fondo y luz.

### 2.3 Reactividad de audio continua — "el latido"
Lo de hoy, sin cambios: `bass/mid/treble/energy → parámetro` (scale, glow, bgHue,
rotation, animSpeed, camFov, camDolly, camShake) con `amount` + `smoothing`.
Modulación **continua y suave** (el fondo que respira), distinta de las acciones
(eventos discretos).

**Las tres capas se suman cada frame:**
```
estado base del nivel  +  reactividad de audio (continua)  +  acciones (eventos, con override temporal)
```

---

## 3. Inmediatez y sincronización (el "drop")

Al pulsar un botón, la acción se dispara **al instante** (`transition.mode='cut'`,
`durationMs=0`): el clip arranca el siguiente frame; cámara/fondo/luz saltan
directos. Latencia objetivo < 1 frame (panel y render comparten proceso en v0).
La versión **suave** (`crossfade` + `durationMs`) es Fase 4, reutiliza el
crossfade del motor; no bloquea v0.

**Regla de reset (importante, define la semántica de overrides):** los efectos de
`camera`/`background`/`light` instalan un **override temporal** que **se limpia
automáticamente cuando cambia el nivel de energía** (el nivel reimpone su base).
Así el operador siempre puede "volver a cero" cambiando de nivel. Los efectos
`animation` son one-shots o reemplazos de idle que terminan solos (§7.4).

---

## 4. Dos superficies, dos audiencias

| | **Sandbox** (autoría) | **Panel de control** (vivo) |
| --- | --- | --- |
| Quién | Diseñador (Blender/C4D) | DJ / operador |
| Objetivo | Componer, mapear acciones, verificar | Disparar en vivo con la música |
| Ruta | `/dev/visuals3d` | `/dev/visuals3d/play` |
| Look | Layout estilo Blender (§5) | Botonera grande, oscura (§6) |

El diseñador **nombra** las acciones en el sandbox; esos botones aparecen
automáticamente en el panel de control.

---

## 5. Rediseño del sandbox — layout estilo Blender (objetivo de Fase 2)

```
┌───────────────────────────────────────────────────────────────┐
│  WORKSPACES (tabs):  Layout · Niveles · Acciones · Audio · Export│  ← top bar
├──────────────────────────────────────────┬────────────────────┤
│                                           │  OUTLINER (árbol)   │
│            VIEWPORT 3D (canvas)            │   ▸ Nivel 0 ●       │
│   overlays: nivel activo · clip sonando · │     clips/cám/luz   │
│   micro · medidor 4 bandas compacto       │   ▸ Nivel 1 …       │
│                                           ├────────────────────┤
│                                           │  PROPERTIES         │
│                                           │  (contextual del    │
│                                           │   item del outliner)│
├──────────────────────────────────────────┴────────────────────┤
│  TIMELINE / CLIPS:  pool del nivel + clips (▶, 🔒, ⏭)          │  ← bottom
└───────────────────────────────────────────────────────────────┘
```

- **Workspaces (tabs):** reordenan qué Properties se ven, sin perder el viewport.
  Mínimo: **Layout** (cámara), **Niveles** (look & clips), **Acciones** (mapeo de
  botones), **Audio** (reactividad + triggers), **Export** (librería/zip).
- **Viewport:** el canvas casi a pantalla completa con overlays mínimos.
- **Outliner:** árbol de la escena (niveles → clips/cámara/luz/materiales).
  Seleccionar aquí llena Properties.
- **Properties:** panel contextual con pestañas de iconos: 🎚 Nivel · 🎥 Cámara ·
  💡 Luz · 🎨 Material/Paleta · 🔊 Audio · 🖼 Render.
- **Timeline / Clips:** dope sheet simplificado: marca clips del pool, ▶ probar,
  🔒 bloquear, ⏭ siguiente.

**Intuitividad:** tooltip en cada control (qué hace + unidad), tips `?` por
sección, nomenclatura de artista ("Encuadre", "Bucle/pool"), estado vacío guiado
("arrastra un .glb aquí"), spec sheet del GLB accesible desde Export.

---

## 6. Panel de control en vivo (objetivo de Fase 3)

```
┌───────────────────────────────────────────────────────────┐
│                     VIEWPORT (fullscreen)                  │
│  energía:  [0][1][2][3][4][5]      modo: manual / auto     │
│  acciones: [ DROP ] [ FUNNY DANCE ] [ SPIN CAM ] …         │
│  pool:  🔒 bloquear   ⏭ siguiente          🎤 micro        │
└───────────────────────────────────────────────────────────┘
```

Botones de energía 0–5 siempre presentes (override manual en modo auto). Botones
de acción = una por cada `config.actions`. Disparo inmediato. UI oscura/alto
contraste. Cámara siempre `driven`.

---

## 7. Spec de datos y motor (`Scene3DConfig` v2)

> Tipos en `web/packages/glow-visuals-3d/src/sandbox.ts`, exportados desde
> `index.ts`. **Marcas:** 🆕 nuevo · ✏️ cambia · (resto igual).

### 7.1 Tipos nuevos / cambiados

```ts
// 🆕 Luz clave por nivel. direction = vector unitario hacia el que apunta.
type LightConfig = {
  hsl: HSL;                               // color de la luz (0–1 cada canal)
  intensity: number;                      // 0–5 (THREE.DirectionalLight.intensity)
  direction: [number, number, number];   // p. ej. [4, 8, 4] normalizado en el motor
};

// 🆕 Control de salto del pool de clips.
type PoolPlayback = {
  mode: 'random' | 'sequential';
  minHoldMs: number;                      // SUELO de tiempo; el salto real espera al
                                          // siguiente fin de ciclo del clip (nunca corta
                                          // a media animación). Ver §7.6.
};

// 🆕 Un efecto atómico dentro de una acción.
type Effect =
  | { kind: 'animation'; clip: string }   // siempre one-shot sobre el idle
  | { kind: 'camera';    to: CameraConfig; durationMs: number }
  | { kind: 'background'; hsl: HSL }
  | { kind: 'light';      hsl: HSL; intensity: number };

// 🆕 Acción nombrada = bundle de efectos disparable.
type Action = {
  id: string;                             // estable, p. ej. crypto.randomUUID()
  name: string;                           // "drop animation 1", "funny dance"
  effects: Effect[];
  transition: { mode: 'cut' | 'crossfade'; durationMs: number };  // v0: { 'cut', 0 }
};

// ✏️ EnergyLevelConfig: idleClip/actions ELIMINADOS (sin migración, v1 nunca se
//    usó en producción) → reemplazados por clipPool + poolPlayback + light.
type EnergyLevelConfig = {
  glb: string | null;
  hsl: HSL;
  light: LightConfig;                     // 🆕
  clipPool: string[];                     // 🆕 animaciones idle que rotan (antes: idleClip único)
  poolPlayback: PoolPlayback;             // 🆕
  camera: CameraConfig;
  cameraSource: 'engine' | 'glb';
};

// ✏️ ActionTrigger: clip → actionId.
type ActionTrigger = {
  source: AudioSource;
  threshold: number;
  actionId: string;                       // ✏️ antes: clip
  cooldownMs: number;
  enabled: boolean;
};

// ✏️ Scene3DConfig: + actions. (Sin migración: el schema v2 es el único; no hay
//    v1 que mantener. `schemaVersion` queda como simple marcador de futuro.)
type Scene3DConfig = {
  schemaVersion: 2;                       // 🆕 marcador (no hay migración v1→v2)
  paletteTargets: string[];
  energyLevels: EnergyLevelConfig[];      // 6 entradas
  actions: Action[];                      // 🆕
  audioBindings: AudioBinding[];
  actionTriggers: ActionTrigger[];        // ✏️ usa actionId
  transition: TransitionMode;
  energyMode: EnergyMode;
  autoConfig: AutoConfig;
  exposure: number;
  hdrName: string | null;
  useHdrBackground: boolean;
};
```

### 7.2 Defaults (constantes nuevas en `sandbox.ts`)

```ts
const DEFAULT_LIGHT: LightConfig = { hsl: { h: 0, s: 0, l: 1 }, intensity: 2.2, direction: [4, 8, 4] };
const DEFAULT_POOL_PLAYBACK: PoolPlayback = { mode: 'random', minHoldMs: 6000 };
```
`DEFAULT_LIGHT` reproduce la `key` actual (blanco, intensidad 2.2, pos [4,8,4]).

### 7.3 Sin migración — v2 es el único schema

v1 **nunca estuvo en producción**, así que no hay nada que mantener. No se
implementa migración ni `migrate.ts`. Las **escenas dev locales** que pudieras
tener guardadas en IndexedDB con el schema viejo se descartan: al introducir v2,
**borra la base local** (o sube `VERSION`/cambia el nombre del store en
`scene-store.ts`) y vuelve a crear las escenas de prueba. El sandbox/player
asumen que todo lo que cargan ya es v2.

### 7.4 Semántica de efectos (la define el motor, Fase 1)

- **animation**: `LoopOnce` (one-shot) encima del idle; al terminar, el idle/pool
  recupera peso. Es el `playAction` actual (`sandbox.ts:497`). **Siempre one-shot**
  (no hay modo "reemplazar idle").
- **camera**: instala `camOverride = { from: cámara actual, to, start, durationMs }`.
  En modo `driven`, mientras esté activo, la cámara hace lerp `from→to` en
  `durationMs` (cut=salto) y **mantiene** `to`. Se limpia al cambiar de nivel.
- **background**: `bgOverride: HSL | null`; reemplaza el HSL interpolado del nivel
  mientras esté activo. Se limpia al cambiar de nivel.
- **light**: `lightOverride: {hsl,intensity} | null`; ídem, sobre la luz clave.

> Las acciones se disparan sobre el **nivel activo** (`activeLevel`), igual que
> `playAction` hoy.

### 7.5 Nuevos métodos del controller (`SandboxController`)

```ts
setActions: (actions: Action[]) => void;          // 🆕
playActionById: (id: string) => void;             // 🆕 disparo inmediato (botón + trigger)
setLevelLight: (level: number, light: LightConfig) => void;  // 🆕 (preview en sandbox)
lockCurrentClip: () => void;                       // 🆕 fija el clip del pool actual
skipClip: () => void;                              // 🆕 salta al siguiente del pool
// playAction(level, clip) se mantiene como primitivo interno.
// readConfig(partial) ✏️ pasa a incluir actions + schemaVersion: 2.
```

### 7.6 Estado de motor a añadir (en `mountSandboxScene`)

- En `LevelModel`: `poolIndex: number`, `poolLastSwitchMs: number`,
  `poolLocked: boolean`. Reemplaza la lógica de `setModelIdle` por una de pool.
  **Salto alineado al ciclo (no corta a media animación):**
  - El clip idle del pool va en `LoopRepeat`. Suscribir el `mixer` al evento
    **`'loop'`** (lo emite three.js al completar cada ciclo).
  - En cada `'loop'`: si `!poolLocked` y `now - poolLastSwitchMs >= minHoldMs`,
    elegir el siguiente clip (`random`/`sequential`) y crossfade a él (reutiliza
    el fade de `setModelIdle`, `sandbox.ts:340`); actualizar `poolLastSwitchMs`.
  - Resultado: `minHoldMs` es un suelo; el cambio ocurre en el primer fin de
    ciclo posterior (la duración del clip se respeta vía el evento, no hace falta
    leer `clip.duration` a mano; está disponible en `THREE.AnimationClip.duration`
    por si se quiere mostrar en el UI).
  - **⏭ `skipClip`**: salta inmediato al siguiente (crossfade 0.4 s), sin esperar
    al ciclo ni al suelo. **🔒 `lockCurrentClip`**: alterna `poolLocked` (congela
    el clip actual; deja de saltar).
  - Pools de 0 clips → sin idle; de 1 clip → ese clip en bucle, nunca salta.
- Globales: `actions: Action[]`, `camOverride`, `bgOverride`, `lightOverride`
  (todos null por defecto), limpiados en `syncActiveModel` cuando cambia
  `activeLevel` (`sandbox.ts:519`).
- Luz: en `render()`, junto al bloque HSL (`sandbox.ts:683`), interpolar
  `level.light` entre `lo`/`hi` y aplicar a `key` (`key.color`, `key.intensity`,
  `key.position`), salvo que `lightOverride` esté activo.

---

## 8. Glosario viejo → nuevo (para no confundir al implementar)

| Antes (v1) | Ahora (v2) |
| --- | --- |
| `level.idleClip` (1 clip) | `level.clipPool` (lista) + `poolPlayback` |
| `level.actions[]` (clips marcados) | `Action[]` globales con efectos; el botón referencia `action.id` |
| `actionTrigger.clip` | `actionTrigger.actionId` |
| `playAction(level, clip)` desde UI | `playActionById(id)` (UI) → el motor resuelve efectos |
| tinte ambiental como única "luz" | `level.light` (luz clave real) + tinte ambiental (sigue) |

---

## 9. Plan de acción por fases (cada una verificable y negociable)

> Tras cada fase: `pnpm --filter glow-visuals-3d build` (si tocó el paquete) y
> reiniciar el dev server si se añadieron **exports nuevos** (Turbopack cachea el
> `dist`). Verificar en `/dev/visuals3d` y `/dev/visuals3d/play`.

### Fase 0 — Modelo de datos v2 (sin cambio visible, sin migración)
**Objetivo:** introducir el schema v2 en tipos y fontanería de persistencia, sin
tocar el comportamiento del motor ni de la UI. **No hay migración** (§7.3).
**Archivos:** `sandbox.ts` (tipos §7.1 + defaults §7.2 + `readConfig`),
`index.ts` (exports), `page.tsx` (`emptyLevels`, `readConfig`/save/zip),
`player-client.tsx` (lee `actions`), `scene-store.ts` (subir `VERSION` o cambiar
el nombre del store para descartar escenas dev viejas).
**Pasos:**
1. Añadir tipos §7.1 y defaults §7.2; exportar `LightConfig`, `PoolPlayback`,
   `Effect`, `Action` desde `index.ts`.
2. `emptyLevels()` en `page.tsx` rellena `light: DEFAULT_LIGHT`, `clipPool: []`,
   `poolPlayback: DEFAULT_POOL_PLAYBACK` (y quita `idleClip`/`actions`).
3. `readConfig` incluye `actions` y `schemaVersion: 2`; `handleSave`/
   `handleExportZip` añaden `actions` (vacío de momento) al config.
4. `scene-store.ts`: bump de `VERSION` (o nuevo store) para que IndexedDB no
   sirva escenas con el shape viejo.
**Aceptación:**
- El sandbox arranca, crea una escena nueva, la guarda y la recarga sin errores
  (round-trip del config v2).
- `tsc`/lint sin errores; build del paquete OK.
- No quedan referencias a `idleClip` ni a `level.actions` en el código.

### Fase 1 — Motor: luz, clip pool y acciones compuestas
**Objetivo:** el motor consume `light`, `clipPool`/`poolPlayback` y `actions`.
**Archivos:** `sandbox.ts` (engine + controller), `index.ts`.
**Pasos:**
1. **Luz clave por nivel** (§7.6): interpolar `level.light`→`key`. `setLevelLight`
   para preview inmediato.
2. **Clip pool** (§7.6): rotación `random`/`sequential` con `minHoldMs`, crossfade
   entre clips; `lockCurrentClip` / `skipClip`. (El motor deja de leer `idleClip`;
   usa `clipPool`.)
3. **Acciones**: `setActions`, `playActionById(id)` aplicando cada `Effect` con la
   semántica §7.4 (modo `cut`). Overrides `cam/bg/light` que se limpian al cambiar
   de nivel.
4. `actionTriggers` (`render()`, `sandbox.ts:613`) disparan `playActionById(actionId)`
   en vez de `playAction(level, clip)`.
**Aceptación (con una escena de prueba con ≥2 clips):**
- `controller.playActionById('drop')` desde la consola dispara animación + cámara
  + fondo + luz **a la vez** e inmediato.
- Cambiar de nivel resetea los overrides al estado base del nivel.
- El pool rota solo al **fin de ciclo** tras superar `minHoldMs` (no corta a
  media animación); 🔒 lo fija; ⏭ avanza ya con crossfade.
- La luz clave cambia entre niveles según `level.light`.

### Fase 2 — Sandbox: layout estilo Blender
**Objetivo:** reorganizar `page.tsx` (hoy ~1300 líneas en un archivo) al layout
§5, con paridad de funciones + edición de los campos nuevos + tooltips.
**Archivos (🆕 carpeta `web/app/dev/visuals3d/sandbox/`):**
- `useSandboxState.ts` — hook que centraliza el estado hoy disperso en `page.tsx`
  (levels, palette, bindings, triggers, **actions**, modos, exposure, mic…) y los
  `useEffect` que empujan al controller.
- `Workspaces.tsx` (top bar), `Viewport.tsx` (canvas + overlays + drag-drop),
  `Outliner.tsx`, `Properties.tsx` (+ `panels/LevelPanel`, `CameraPanel`,
  `LightPanel`, `MaterialPanel`, `AudioPanel`, `RenderPanel`), `Timeline.tsx`,
  `ActionsPanel.tsx` (crear/nombrar/editar `Action` y sus `Effect`).
- `page.tsx` queda como ensamblador del layout. Reutilizar `Slider`, `Label`,
  meters (`AudioBands`, etc.) extrayéndolos a `sandbox/widgets.tsx`.
**Pasos:** (a) extraer estado al hook sin cambiar UI; (b) montar las 4 zonas; (c)
mover cada sección actual a su panel; (d) añadir Outliner + Properties contextual;
(e) Timeline de clips con pool/▶/🔒/⏭; (f) tab **Acciones**; (g) tooltips/tips/
nomenclatura. Sub-pasos (a)–(g) son commits verificables.
**Aceptación:**
- Todo lo que se podía hacer antes se puede hacer ahora (carga GLB/HDR, HSL,
  cámara engine/glb, paleta, bindings, triggers, save/load/zip).
- Se puede editar `light`, `clipPool`/`poolPlayback` y crear `Action`s.
- Cada workspace cambia el Properties sin perder el viewport; hay tooltip en cada
  control. Mini-prueba de usabilidad con un diseñador.

### Fase 3 — Panel de control en vivo
**Objetivo:** evolucionar `player-client.tsx` a la botonera §6.
**Archivos:** `player-client.tsx`.
**Pasos:** botones energía 0–5 (grandes) + `manual/auto`; botones de acción desde
`config.actions` (`onClick → playActionById(action.id)`); 🔒/⏭ (`lockCurrentClip`/
`skipClip`); micro; UI oscura/alto contraste.
**Aceptación:**
- Se opera una escena entera solo con botones, sincronizando a oído; el "drop"
  dispara sin lag perceptible (< 1 frame local).
- 🔒/⏭ controlan el pool en vivo; el micro activa reactividad + triggers.

### Fase 4 — Pulido y extensiones (no bloquea v0)
- Transiciones suaves de acción (`crossfade` + `durationMs`).
- Animaciones de cámara (keyframes propios o cámara horneada del GLB como
  `Effect`).
- Atajos de teclado en el panel (números = energía, letras = acciones).
- Preparación del salto a producción (Supabase Storage + desk real) — Nivel 2.

---

## 10. Decisiones cerradas (para no re-litigar)

- **Sin migración:** v1 nunca estuvo en producción; v2 es el único schema (§7.3).
- **Animación de las acciones:** **siempre one-shot** sobre el idle (sin modo
  "reemplazar idle"). El `Effect` de animación no lleva campo de capa.
- **Reset de overrides:** los overrides de cámara/fondo/luz se **mantienen** hasta
  que cambia el nivel de energía, que restaura la base (§3). (Confirmado.)
- **Cámara en v0:** lerp a un encuadre destino y mantener; keyframes en Fase 4.
- **Luces en v0:** una luz clave por nivel; fill/rim más adelante.
- **Persistencia:** IndexedDB + zip; Supabase es Nivel 2.
- **Salto del pool (`minHoldMs`):** el nivel rota su lista de animaciones saltando
  al azar. `minHoldMs` es un **suelo** (default **6 s**) y el salto automático
  espera al **siguiente fin de ciclo** del clip → **nunca corta a media
  animación** (se apoya en el evento `'loop'` del mixer; §7.6). 🔒 congela el clip
  actual; ⏭ salta ya (con crossfade), sin esperar al ciclo.

---

Estado actual: [visuals-3d-sandbox.md](./visuals-3d-sandbox.md) ·
[visuals-3d-player.md](./visuals-3d-player.md) ·
[visuals-architecture.md](./visuals-architecture.md).
