# Plan — Aplicar el rediseño de Play Devices a la pestaña **Visuals**

Plan para ejecutar **tarea por tarea**. Cada tarea es autocontenida: objetivo, ficheros, pasos y criterio de aceptación. Tras cada tarea: `cd web && pnpm exec tsc --noEmit` debe pasar limpio. La pantalla `/control` necesita sesión + sala activa, así que la verificación es por tsc + prueba manual del usuario.

UI siempre en inglés.

> **Estado: T1 y T2 YA ESTÁN HECHAS** (las extracciones que tocaban código de Play Devices). Empezar en **T3**. Componentes compartidos ya disponibles:
> - `import { EditSectionChrome } from '@/components/glow/edit-section-chrome'` — props `{ mode: ConsoleMode; order?: number; onHide: () => void; onMoveUp?: () => void; onMoveDown?: () => void; children }`.
> - `import { ResizableTwoColumn } from '@/components/glow/resizable-two-column'` — props `{ left: ReactNode; right: ReactNode; storageKey: string; defaultLeftWidth?=320; minLeftWidth?=240; minRightWidth?=360 }`. Apila en móvil; divisor arrastrable en `lg+`; persiste en `localStorage[storageKey]`; doble-clic resetea.
> - `play-devices-desk.tsx` ya usa ambos (referencia de uso). No re-extraer.

---

## Contexto y objetivo

La pestaña **Play Devices** ya se rediseñó (modo Edit/Operate, cabecera compartida, gestor de layouts, secciones ocultar/reordenar, columnas redimensionables, grises claros corregidos). Hay que llevar **lo mismo** a la pestaña **Visuals**.

### Estado actual de Visuals (lo que vas a tocar)
- `web/components/glow/visuals-tab.tsx` (~2270 líneas): **una sola columna** de `NeonCard` colapsables, controladas por el estado local `collapsedSections`. El preview es una tarjeta más.
- La página `web/app/(control)/room/[code]/control/page.tsx` monta `<VisualsTab/>` **sin pasar `mode`** (por defecto `'edit'`). `VisualsTab` ya acepta `mode?: 'edit' | 'operate'` en sus props pero no lo usa para nada.
- Guarda contenido vía sección "RIG" → `handleOverwriteRig()` (PATCH del rig con `palette`/`defaultVisualArtId`/`logoEnabled`). Esto NO es el layout; es contenido del rig.

### Secciones de Visuals (orden actual y su id de `collapsedSections`)
Estándar (siempre presentes — estas serán **ocultables/reordenables**):
1. `visualsMode` — "VISUALS MODE"
2. `preview` — "LIVE PREVIEW" (componente `VisualsPreview`) → será la **columna izquierda**
3. `output` — "OUTPUT SURFACE"
4. `liveCall` — "LIVE CALL MOSAIC" (solo si `roomState`)
5. `cues` — "CUE LIST"
6. `art` — "VISUAL ART"
7. `palette` — "LIVE PALETTE"
8. `showName` — "SHOW NAME & LOGO"
9. `text` — "LIVE CUSTOM TEXT OVERLAY"
10. `qr` — "LIVE QR OVERLAY"
11. `rig` — "RIG" (overwrite de contenido del rig)

Contextuales por modo (NO ocultar/reordenar — se renderizan según `workingState.mode`):
- "YOUTUBE" (solo `mode === 'youtube'`)
- "3D VISUALS — ENERGY ORB" (solo `mode === '3d'`)

### Implementaciones de referencia (copiar estos patrones de Play Devices)
- `EditSectionChrome` (barra de edición con Hide + flechas ↑/↓ + `order`): definido hoy **dentro** de `page.tsx`.
- Estado/persistencia de secciones de Play Devices en `page.tsx`: `workingHidden`/`baselineHidden`, `workingOrder`/`baselineOrder`, `isHidden`, `hiddenPlaySections`, `hasSectionContent`, `effectiveOrder`, `visibleSectionIds`, `moveSection`, `sectionChromeProps`, `normalizePlayOrder`, `PLAY_SECTIONS`.
- Gestor de layouts: `web/lib/glow/console-layouts.ts` (`ConsoleLayout`, `parseConsoleLayouts`, `createLayoutId`) + `web/components/glow/layout-manager.tsx`. En `page.tsx`: `commitConfig`, `saveConsoleConfig`, `saveAsNewLayout`, `renameActiveLayout`, `deleteActiveLayout`, `switchLayout`, `workingLayoutValues`.
- Columnas redimensionables: la lógica está hoy **dentro** de `web/components/glow/play-devices-desk.tsx` (`containerRef`, `isWide`, `previewWidth`, `clampWidth`, handlers de puntero, grid `[previewWidth]px 16px minmax(0,1fr)`, divisor con `localStorage`).
- Grises claros: usar el token `bg-muted` (en vez de `bg-black/20|30`) — adapta claro/oscuro.

### Decisiones ya tomadas (no re-decidir)
- Un "layout" de Visuals captura SOLO **qué secciones se ven y su orden** (`visualsHidden`, `visualsOrder`). El **contenido** de Visuals (art/palette/logo/qr/displayName) sigue siendo del rig (sección "RIG" / `console_config.qrConfig` etc.) — fuera del alcance del layout.
- `visualsHidden`/`visualsOrder` NO se espejan a top-level de `console_config` (la superficie de visuals no los lee; solo los usa el desk del operador).
- YouTube y 3D quedan contextuales (no entran en el registro ocultable/reordenable).
- El divisor redimensionable de Visuals usa su propia clave de localStorage: `glow_visuals_preview_w`.

---

## T1 — Extraer `EditSectionChrome` a componente compartido ✅ HECHO

**Objetivo:** poder reusar la barra de edición en Visuals sin duplicarla.

**Ficheros:** nuevo `web/components/glow/edit-section-chrome.tsx`; editar `web/app/(control)/room/[code]/control/page.tsx`.

**Pasos:**
1. Crear `edit-section-chrome.tsx` con `'use client'` y mover ahí el componente `EditSectionChrome` que hoy está en `page.tsx` (mismas props: `mode`, `order?`, `onHide`, `onMoveUp?`, `onMoveDown?`, `children`; usa `ArrowUp`/`ArrowDown`/`EyeOff` de `lucide-react`, `cn`, y `type ConsoleMode` de `@/lib/glow/console-mode`). Exportarlo.
2. En `page.tsx`: borrar la definición local y `import { EditSectionChrome } from '@/components/glow/edit-section-chrome'`.

**Aceptación:** tsc limpio; el modo edición de Play Devices se ve igual que antes.

---

## T2 — Extraer la columna redimensionable a `ResizableTwoColumn` ✅ HECHO

**Objetivo:** reusar el divisor en Visuals.

**Ficheros:** nuevo `web/components/glow/resizable-two-column.tsx`; editar `web/components/glow/play-devices-desk.tsx`.

**Pasos:**
1. Crear `resizable-two-column.tsx` (`'use client'`) que encapsule TODA la lógica de redimensionado que hoy vive en `play-devices-desk.tsx`. Props:
   ```ts
   type ResizableTwoColumnProps = {
     left: React.ReactNode;
     right: React.ReactNode;
     storageKey: string;       // p.ej. 'glow_desk_preview_w'
     defaultLeftWidth?: number; // 320
     minLeftWidth?: number;     // 240
     minRightWidth?: number;    // 360
   };
   ```
   Mueve: `containerRef`, `draggingRef`, `isWide` (matchMedia 1024), `previewWidth` (init desde `localStorage[storageKey]`), `clampWidth`, `handlePointerDown/Move/Up`, el doble-clic de reset, el contenedor `flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)] lg:gap-6 lg:items-start` con `style` grid `${previewWidth}px 16px minmax(0,1fr)` cuando `isWide`, y el divisor `<div role="separator" .../>`. Renderiza `{left}`, el divisor (si `isWide`), `{right}`.
2. Refactorizar `play-devices-desk.tsx` para usar `<ResizableTwoColumn storageKey="glow_desk_preview_w" left={<NeonCard…preview…/>} right={<div className="flex min-w-0 flex-col gap-6">{children}</div>} />`. Quitar de ahí la lógica de resize ya movida.

**Aceptación:** tsc limpio; Play Devices sigue redimensionando igual (arrastrar + doble-clic reset + persistencia).

---

## T3 — Extender el modelo de layout con secciones de Visuals

**Objetivo:** que un layout recuerde qué secciones de Visuals se ven y en qué orden.

**Ficheros:** `web/lib/glow/console-layouts.ts`, `web/app/(control)/room/[code]/control/page.tsx`.

**Pasos:**
1. En `console-layouts.ts`: añadir a `ConsoleLayout` los campos `visualsHidden: string[]` y `visualsOrder: string[]`. Parsearlos en `normalizeLayout` (con `toStringArray`) y en el fallback legacy (de `cfg.visualsHidden`/`cfg.visualsOrder`, o `[]`).
2. En `page.tsx`:
   - Generalizar el orden: extraer un helper `normalizeOrder(ids: string[], saved: string[] | undefined)` (igual que `normalizePlayOrder` pero parametrizado por el array de ids canónicos) y reescribir `normalizePlayOrder` para que llame a `normalizeOrder(PLAY_SECTION_IDS, saved)`.
   - Añadir estados `workingVisualsHidden`/`baselineVisualsHidden` y `workingVisualsOrder`/`baselineVisualsOrder` (init `[]` y `normalizeOrder(VISUALS_SECTION_IDS, undefined)` respectivamente — `VISUALS_SECTION_IDS` se define en T4).
   - En el `useEffect` de sync con el layout activo: poblar working/baseline de visuals desde `active.visualsHidden` y `active.visualsOrder`.
   - `configDirty`: añadir `|| !arraysEqual(workingVisualsHidden, baselineVisualsHidden) || !sequenceEqual(workingVisualsOrder, baselineVisualsOrder)`.
   - `workingLayoutValues()`: añadir `visualsHidden: workingVisualsHidden, visualsOrder: workingVisualsOrder`.
   - `commitConfig`: incluir `visualsHidden`/`visualsOrder` del layout activo en el body (dentro de `layouts`), pero **NO** en el espejo top-level. Y en éxito setear `baselineVisualsHidden/Order` desde el activo; con `loadWorking` también setear los working.
   - `discardEditMode`: resetear working de visuals a baseline.

**Aceptación:** tsc; guardar/cargar/cambiar layout persiste y restaura `visualsHidden`/`visualsOrder`.

---

## T4 — Registro de secciones de Visuals + handlers en la página

**Objetivo:** lógica de ocultar/mostrar/reordenar de Visuals, propiedad de la página (igual que las de Play Devices).

**Ficheros:** `web/app/(control)/room/[code]/control/page.tsx`.

**Pasos:**
1. Definir a nivel de módulo:
   ```ts
   const VISUALS_SECTIONS = [
     { id: 'visualsMode', label: 'Visuals Mode' },
     { id: 'output', label: 'Output Surface' },
     { id: 'liveCall', label: 'Live Call Mosaic', when: 'room' as const },
     { id: 'cues', label: 'Cue List' },
     { id: 'art', label: 'Visual Art' },
     { id: 'palette', label: 'Live Palette' },
     { id: 'showName', label: 'Show Name & Logo' },
     { id: 'text', label: 'Live Text Overlay' },
     { id: 'qr', label: 'Live QR Overlay' },
     { id: 'rig', label: 'Rig' },
   ] as const;
   const VISUALS_SECTION_IDS: string[] = VISUALS_SECTIONS.map((s) => s.id);
   ```
   Nota: `preview` NO está aquí — va fijo en la columna izquierda (T5). YouTube/3D tampoco (contextuales).
2. Añadir (espejando las de play): `isVisualsHidden(id)`, `hiddenVisualsSections` (filtrando `when:'room'` si `!roomState`), `hasVisualsSectionContent(id)` (`liveCall` → `Boolean(roomState)`, resto `true`), `effectiveVisualsOrder` = `normalizeOrder(VISUALS_SECTION_IDS, workingVisualsOrder)`, `visibleVisualsSectionIds`, `moveVisualsSection(id, dir)`, `hideVisualsSection(id)`, `showVisualsSection(id)`, y `visualsSectionChromeProps(id)` (devuelve `{ order, onHide, onMoveUp, onMoveDown }` igual que `sectionChromeProps`).

**Aceptación:** tsc; existen los handlers.

---

## T5 — Convertir `VisualsTab` en desk de dos columnas con secciones ocultables/reordenables

**Objetivo:** preview a la izquierda (redimensionable), controles a la derecha con chrome de edición + bandeja "Add section", respetando modo y orden.

**Ficheros:** `web/components/glow/visuals-tab.tsx`, y su uso en `page.tsx`.

**Pasos:**
1. **Props nuevas en `VisualsTab`** (además de `mode`, que la página ya debe pasar):
   ```ts
   isSectionHidden: (id: string) => boolean;
   sectionChromeProps: (id: string) => { order?: number; onHide: () => void; onMoveUp?: () => void; onMoveDown?: () => void };
   hiddenSections: { id: string; label: string }[];
   onShowSection: (id: string) => void;
   ```
2. En `page.tsx`, en `<VisualsTab/>` pasar `mode={mode}`, `isSectionHidden={isVisualsHidden}`, `sectionChromeProps={visualsSectionChromeProps}`, `hiddenSections={hiddenVisualsSections.map(s => ({id:s.id,label:s.label}))}`, `onShowSection={showVisualsSection}`.
3. En `visuals-tab.tsx`:
   - Importar `EditSectionChrome` (T1) y `ResizableTwoColumn` (T2).
   - Sustituir el `return (<div className="flex flex-col gap-6">…)` por `ResizableTwoColumn`:
     - `left` = la tarjeta **LIVE PREVIEW** (la actual `preview`), con `lg:sticky lg:top-6`.
     - `right` = `<div className="flex min-w-0 flex-col gap-6">…secciones…</div>`.
   - **Cada sección estándar** (visualsMode, output, liveCall, cues, art, palette, showName, text, qr, rig): envolver su `<NeonCard>` en `<EditSectionChrome {...sectionChromeProps(id)}>…</EditSectionChrome>` y gate con `{!isSectionHidden(id) ? (…) : null}`. La `EditSectionChrome` aplica `order` (CSS) y, en `mode==='edit'`, la barra Hide + ↑/↓. (Mantener el colapsado interno actual si quieres; o quitarlo — opcional.)
   - **Bandeja "Add section"** al principio de la columna derecha cuando `mode==='edit' && hiddenSections.length>0` (copiar el bloque "Operator panels"/"Add section" de `page.tsx`, con `style={{ order: -2 }}` y botones que llaman `onShowSection(id)`).
   - YouTube y 3D: dejarlos como están (renderizado contextual por `workingState.mode`), SIN `EditSectionChrome`. Para que el CSS `order` no los descoloque, envuélvelos en `<div style={{ order: <n> }}>` con un order fijo coherente (p.ej. tras `visualsMode`).
   - El contenedor de la columna derecha debe ser `flex flex-col` para que el CSS `order` funcione (igual que en Play Devices).

**Aceptación:** En edit, Visuals muestra preview a la izquierda con divisor, y a la derecha cada sección con Hide + ↑/↓ + bandeja Add; en operate, limpio (sin chrome); el orden/visibilidad se guarda con el gestor de layouts y persiste al recargar; cambiar de layout recarga la disposición de Visuals.

---

## T6 — Modo operar por defecto y limpio en Visuals

**Objetivo:** que Visuals respete el mismo modo que Play Devices (operar = limpio).

**Pasos:** Ya cubierto al pasar `mode` (T5) y porque `EditSectionChrome` en operate solo envuelve sin barra. Verifica que en operate NO aparezca la bandeja Add ni las flechas/Hide, y que el preview y los controles se vean limpios. (El `mode` es el mismo estado global de la página; no añadir un toggle propio de Visuals.)

**Aceptación:** alternar Edit/Operate desde la cabecera afecta a ambas pestañas de forma coherente.

---

## T7 — Corregir los grises del tema claro en Visuals

**Objetivo:** consistencia con Play Devices (token `bg-muted`).

**Ficheros:** `visuals-tab.tsx` y subcomponentes: `cue-list.tsx`, `palette-editor.tsx`, `effect-stack-editor.tsx`, `live-call-controls.tsx`, `visuals-preview.tsx`.

**Pasos:** Reemplazar fondos planos `bg-black/20` → `bg-muted/40` y `bg-black/30` → `bg-muted/50` en paneles/cajas de UI (no en superficies que deban ser negras de verdad, p.ej. el lienzo del preview o miniaturas de vídeo). Mantener acentos neón (`bg-neon-*`, `bg-violet-500/10`, etc.). Revisar caso por caso con `grep -n "bg-black/2\|bg-black/3" <archivo>`.

**Aceptación:** en tema claro los paneles de Visuals se ven como los de Play Devices; tsc limpio.

---

## T8 — (Futuro, opcional) Fidelidad real del preview de Visuals

No incluir todavía. Cuando se aborde la fidelidad del player (motor en sandbox o espectador por socket que no cuenta), alinear el `VisualsPreview` para que muestre la superficie real (`/room/[code]/visuals` vía token) en un iframe o sandbox. Hoy `VisualsPreview` es una aproximación; déjalo igual.

---

## Verificación global (al terminar)
1. `cd web && pnpm exec tsc --noEmit` limpio.
2. `grep -rn "EditSectionChrome\b"` → definido solo en `edit-section-chrome.tsx` y consumido por `page.tsx` + `visuals-tab.tsx`.
3. Manual (sala activa): en pestaña **Visuals**, entrar en *Edit layout* → preview izquierda + divisor, secciones con Hide/↑/↓, bandeja Add; ocultar/reordenar/ocultar; *Save & done* → recargar → persiste; *Save as new* crea layout que recuerda también la disposición de Visuals; alternar Operate → limpio. Confirmar que Play Devices sigue intacto y que `/play` no se ve afectado (los campos de visuals no se espejan a top-level).
