# Visuals 3D — Sandbox (panel de edición)

Documentación del **panel de autoría** de escenas 3D. Aquí un diseñador (sin saber
three.js) compone una escena, la verifica contra el motor real y la exporta. La
reproducción/consumo se documenta en [visuals-3d-player.md](./visuals-3d-player.md).

- **Ruta:** `/dev/visuals3d` (dev-only, no enlazada desde la app).
- **No toca producción:** todo vive bajo `/dev`; el render de producción actual
  (`energy-orb`) queda intacto. Ver [visuals-architecture.md](./visuals-architecture.md).

---

## 1. Modelo mental

Una **escena** = una **curva de energía de 6 niveles** (0–5). Cada nivel es casi
autónomo. La filosofía es siempre la misma: **el diseñador autoría parámetros, el
motor los interpreta en tiempo real**.

Cada nivel tiene:

| Propiedad | Qué es |
| --- | --- |
| **GLB** | Su propio modelo (el mismo personaje con cambios horneados: pelo, pose, entorno…) |
| **HSL** | Tonalidad del nivel → color de fondo + tinte ambiental global |
| **idle** | Animación que loopea en ese nivel |
| **actions** | N animaciones disparables (botón ▶ / triggers de audio) |
| **camera** | Encuadre del nivel (posición/target/FOV) — el runtime **interpola** entre niveles |
| **cameraSource** | `engine` (nuestro encuadre) o `glb` (la cámara horneada en el GLB) |

Globales a la escena: paleta, audio bindings, modo de energía (manual/auto),
triggers por umbral, transición entre niveles, exposición y HDR.

Distinción clave: **nivel de energía (0–5)** lo marca el operador o el modo auto
(la "sección de la noche"); el **audio** (bass/mid/treble/energy) es el latido
instantáneo. La fórmula es `base(nivel) + audio(reactividad)`.

---

## 2. Mapa de archivos

| Pieza | Archivo |
| --- | --- |
| Motor (render config-driven) | `web/packages/glow-visuals-3d/src/sandbox.ts` (`mountSandboxScene`) |
| Página del sandbox | `web/app/dev/visuals3d/page.tsx` |
| Persistencia local | `web/app/dev/visuals3d/scene-store.ts` (IndexedDB) |
| ZIP (writer + reader) | `web/app/dev/visuals3d/zip.ts` |
| Player (consumo) | `web/app/dev/visuals3d/play/page.tsx` + `player-client.tsx` |
| Análisis de micro | `web/lib/glow/audio-analyzer.ts` (`useAudioAnalyzer`) |

El paquete `glow-visuals-3d` se compila con `pnpm --filter glow-visuals-3d build`
tras cualquier cambio (Turbopack cachea el `dist`; al añadir **exports nuevos**
hay que reiniciar el dev server).

---

## 3. Flujo de trabajo

1. **Carga un GLB** en el nivel seleccionado: arrastra un `.glb` a la ventana, o
   pulsa **"use test GLB (goku)"** para pruebas.
2. **Selecciona niveles** con las pestañas `0–5`. Al pulsar una, editas **y**
   previsualizas ese nivel (la energía hace easing hasta ahí). Solo se ve el
   modelo del nivel activo.
3. Ajusta por nivel: **HSL**, **idle**, **actions**, **cámara/FOV**.
4. Configura lo global: **paleta**, **audio reactivity**, **modo de energía**,
   **triggers**, **transición**, **exposición**, **HDR**.
5. **Guarda** en la librería local y/o **Export .zip** para el handoff.

---

## 4. Secciones del panel

### Energy levels + modo de energía
- Pestañas `0–5` (en claro las que ya tienen GLB).
- **drive: manual / auto**
  - **manual**: tú pones el nivel.
  - **auto**: la **energía media** de la canción elige el nivel. Parámetros:
    - **avg → lvl N**: lectura en vivo de la energía media (auto-normalizada) y el nivel resultante.
    - **dwell**: tiempo mínimo que se queda en un nivel antes de poder cambiar.
    - **silence gate**: por debajo de este umbral no transiciona ("detecta que está sonando").
    - histéresis interna para no oscilar entre niveles contiguos.

### Level · model
- Nombre del GLB del nivel + botón de test + drag-drop.

### Level · look & clips
- **HSL bg**: color del nivel (fondo + tinte ambiental global). Interpola entre niveles.
- **camera**:
  - **engine / GLB**: usa nuestro encuadre o el de la cámara horneada en el GLB
    (el botón GLB se deshabilita si el GLB no trae cámara → `GLB ✕`).
  - **capture view → L{n}**: guarda la vista actual de OrbitControls en el nivel.
  - **FOV** + presets (fisheye / wide / normal / 50mm / 85mm).
  - Los audio bindings pueden mover FOV / dolly / shake (ver abajo).
- **idle**: clip que loopea.
- **actions**: marca qué clips son disparables; ▶ para probarlos.
- **palette-tinted materials**: marca qué materiales reciben la paleta del local.

### Palette
- 4 colores. `palette[i]` tiñe el material marcado i-ésimo.

### Scene (global)
- **transition: crossfade / cut** entre los modelos de cada nivel.
- **camera: free / driven**
  - **free**: OrbitControls para encuadrar (autoría/inspección).
  - **driven**: el motor conduce la cámara (encuadre interpolado + audio). Es la
    previsualización de lo que verá el proyector.
- **exposure**, **HDR** (+ "use HDR as background"), **🎤 use laptop mic**.

### Audio reactivity
- Medidor de **4 bandas** en vivo (bass / mid / treble / energy).
- Conexiones modulares `source → target`:
  - **source**: bass / mid / treble / energy.
  - **target**: scale, glow (emissive), background hue, rotation, anim speed,
    camera FOV, camera dolly, camera shake.
  - **amount**: cuánto de fuerte.
  - **filter**: suavizado temporal (amortigua picos; evita saltos bruscos).
  - barra **out**: salida real del binding (para ver qué hacen amount/filter).
- Cómo se calcula el audio: FFT del `AnalyserNode` (`getByteFrequencyData`),
  bandas por rangos de bins y energía = media de bins, normalizado 0–1, con
  `smoothingTimeConstant = 0.8`. Ver `web/lib/glow/audio-analyzer.ts`.

### Action triggers
- `banda → clip` con **threshold** y **cooldown**. Dispara por **flanco de
  subida** (al cruzar el umbral), con cooldown/debounce y re-armado por
  histéresis. Se reproduce sobre el modelo del **nivel activo**. Punto que
  parpadea al disparar.

### Library (local, IndexedDB) + ZIP
- **Save / load / delete**: persiste la escena (config + GLBs + HDR) en
  IndexedDB (no localStorage: binarios y >5 MB).
- **Export .zip**: empaqueta `scene.json` + `glb/level-N.glb` + `environment.hdr`
  + README — el handoff para la app. Layout y schema en
  [visuals-3d-player.md](./visuals-3d-player.md#schema).
- **Import .zip**: reabre un zip exportado para seguir editando (round-trip).

---

## 5. Spec sheet para el diseñador (contrato del GLB)

| Tema | Regla |
| --- | --- |
| Formato | `.glb` con **texturas embebidas** (en Blender: *Include → Embed textures*). Draco soportado. |
| Ejes / unidades | Y arriba, metros, modelo **centrado en el origen** (el sandbox lo recentra a los pies). |
| Animaciones | Una clip de loop (idle) + las acciones que quiera, **con nombres claros** (se mapean en el panel). |
| Materiales | Nombrar de forma consistente entre niveles (p. ej. `goku_hairs`) si van a recibir la paleta. |
| Cámara (opcional) | Si quiere su encuadre, exportar con *Include → Cameras*; el toggle **GLB** se activa solo. glTF guarda pos/orientación/FOV (no "target": se deriva del eje de vista). |
| HDR (opcional) | Un `.hdr`/`.exr` para iluminación de entorno; no hornear luces de estudio muy duras. |
| Por nivel | Puede entregar el **mismo personaje con cambios** (pelo, pose, entorno) como un GLB por nivel. |

---

## 6. Pendiente (Nivel 2)

El sandbox y el player ya funcionan con un `Scene3DConfig` config-driven, pero el
**render de producción** todavía no lo consume (usa el `energy-orb` hardcodeado).
El siguiente paso es: persistir los assets en **Supabase Storage** (como
`rig-logos`) y que producción cargue una escena por su config. Lo que el diseñador
monta aquí se verá idéntico en el proyector.

Ver el consumo y el schema completo en
[**visuals-3d-player.md**](./visuals-3d-player.md).
