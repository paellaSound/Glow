# Visuals 3D — Player (reproductor)

Documentación de la **vista de reproducción** de escenas 3D: carga una escena
autorada en el [sandbox](./visuals-3d-sandbox.md) y la renderiza con el mismo
motor que usaría el proyector, sin UI de edición. Es la prueba de que una escena
corre **solo desde su config + archivos**, desacoplada del editor.

- **Ruta:** `/dev/visuals3d/play` o `/dev/visuals3d/play?scene=<id>`.
- **Archivos:** `web/app/dev/visuals3d/play/page.tsx` (Server Component que
  desenvuelve `searchParams`) + `player-client.tsx` (cliente).

---

## 1. Qué hace

1. Lista las escenas guardadas en la librería local (IndexedDB) o carga la de
   `?scene=<id>`.
2. Reconstruye la escena: aplica el `Scene3DConfig` al motor (`mountSandboxScene`)
   y carga los GLB por nivel + el HDR desde los blobs.
3. Renderiza **fullscreen** con controles mínimos:
   - **energy 0–5**: fija el nivel (en modo manual).
   - **actions**: botones de las acciones del nivel actual.
   - **🎤**: micro on/off para la reactividad de audio.

La cámara siempre va en modo **driven** (el motor la conduce: encuadre por nivel
interpolado + reactividad de audio). En producción esto equivale a "bloquear" la
órbita: nadie mueve la cámara a mano.

Si la escena tiene `energyMode: 'auto'`, el nivel lo conduce la **energía media**
del audio (con dwell + gate de silencio); los botones de energía actúan como
override manual puntual.

---

## 2. Schema — `Scene3DConfig` <a id="schema"></a>

Lo que produce el sandbox y consume el player (y, en el futuro, la app). Tipos en
`web/packages/glow-visuals-3d/src/sandbox.ts`.

```ts
type Scene3DConfig = {
  paletteTargets: string[];          // materiales teñidos por la paleta del local
  energyLevels: EnergyLevelConfig[]; // 6 entradas, índice = nivel 0–5
  audioBindings: AudioBinding[];     // reactividad de audio modular
  transition: 'crossfade' | 'cut';   // cómo cambia entre modelos de nivel
  energyMode: 'manual' | 'auto';     // quién pone el nivel
  autoConfig: { dwellMs: number; silenceFloor: number };
  actionTriggers: ActionTrigger[];   // disparo de clips por umbral
  exposure: number;                  // tone-mapping exposure
  hdrName: string | null;
  useHdrBackground: boolean;
};

type EnergyLevelConfig = {
  glb: string | null;                // ref del GLB del nivel (null = hereda el más cercano)
  hsl: { h: number; s: number; l: number };  // fondo + tinte ambiental (0–1)
  idleClip: string | null;           // clip en bucle
  actions: string[];                 // clips disparables
  camera: { position: [number,number,number]; target: [number,number,number]; fov: number };
  cameraSource: 'engine' | 'glb';    // encuadre nuestro o el horneado en el GLB
};

type AudioBinding = {
  source: 'bass' | 'mid' | 'treble' | 'energy';
  target: 'scale' | 'emissive' | 'bgHue' | 'rotationY' | 'animationSpeed'
        | 'camFov' | 'camDolly' | 'camShake';
  amount: number;     // ganancia
  smoothing: number;  // filtro temporal 0–0.95
  enabled: boolean;
};

type ActionTrigger = {
  source: 'bass' | 'mid' | 'treble' | 'energy';
  threshold: number;   // 0–1, flanco de subida
  clip: string;        // clip a disparar en el nivel activo
  cooldownMs: number;  // tiempo mínimo entre disparos
  enabled: boolean;
};
```

---

## 3. Paquete del bundle (`Export .zip`)

El botón **Export .zip** del sandbox genera un paquete autocontenido:

```
scene.json          schema (Scene3DConfig) + palette; los glb apuntan a glb/level-N.glb; hdr -> environment.hdr
glb/level-0.glb     GLB de cada nivel (un nivel con glb=null hereda el más cercano)
glb/level-3.glb
environment.hdr     HDR opcional
README.txt          cómo cargarlo
```

`scene.json` es el `Scene3DConfig` con dos extras de empaquetado: `palette`
(array de hex, el color del local para la previsualización) y las rutas de los
GLB/HDR reescritas a las del zip (`hdr` en vez de `hdrName`).

Para consumirlo: leer `scene.json`, cargar cada `glb/level-N.glb` + `environment.hdr`,
y pasar la config al motor (`mountSandboxScene`) — exactamente lo que hace este
player desde IndexedDB.

---

## 4. Cómo se conecta el motor (resumen)

```ts
import { mountSandboxScene } from 'glow-visuals-3d';

const controller = mountSandboxScene(canvas, () => inputRef.current);
controller.setEnergyLevels(config.energyLevels);
controller.setTransitionMode(config.transition);
controller.setPaletteTargets(config.paletteTargets);
controller.setAudioBindings(config.audioBindings);
controller.setActionTriggers(config.actionTriggers);
controller.setAutoConfig(config.autoConfig);
controller.setEnergyMode(config.energyMode);
controller.setExposure(config.exposure);
// + loadGlbForLevel(level, url, name) por cada nivel, loadHdr(...) si hay HDR
controller.setCameraMode('driven');   // el player siempre conduce la cámara
```

`inputRef.current` lleva `{ timeMs, palette, audio? }`. El `audio` (bass/mid/
treble/energy) viene del micro vía `useAudioAnalyzer`; sin micro, el motor usa una
oscilación sintética para que la escena respire.

---

## 5. Hacia producción (Nivel 2)

Este player es el **molde** del consumo real. Para llevarlo a la app:

1. Persistir GLB/HDR en **Supabase Storage** (mismo patrón que `rig-logos`) en vez
   de IndexedDB.
2. Que el render 3D de producción lea un `Scene3DConfig` (este schema) en lugar
   del `energy-orb` hardcodeado.

La lógica de render ya está probada aquí; el Nivel 2 es sobre todo "fontanería"
de carga, no diseño nuevo.

---

Autoría y todas las opciones del editor en
[**visuals-3d-sandbox.md**](./visuals-3d-sandbox.md).
