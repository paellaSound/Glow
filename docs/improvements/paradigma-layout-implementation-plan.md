# Plan de implementación — Unificar edición en `/control` y retirar `/rigs` + `/pattern-sequences`

> **Para quién es este documento:** una IA de implementación (más barata) que debe ejecutar el refactor **sin inventar nada**. Cada tarea trae ruta de archivo, anclas de código (nombres de función + nº de línea aproximado), el cambio exacto y su criterio de aceptación.
>
> **Documento de visión (leer antes):** [`paradigma-layout.md`](./paradigma-layout.md). Este plan es su versión ejecutable.
>
> **Idioma:** documento en español; **todo el copy de UI va en inglés** (igual que el resto del producto).
>
> **Regla de oro:** ningún guardado puede perder datos de otra capa. Layout, show content (displayName/QR/logo), socials y pattern sequences viven en sitios distintos del mismo `console_config`/tablas; se editan desde `/control` pero **no se pisan entre sí**.
>
> **Sin retrocompatibilidad (decisión del producto):** se **borran** los datos de rigs/cues/socials/pattern-sequences de la BD (Fase 0) para que **todos los usuarios empiecen limpio** con el modelo nuevo. Por tanto: **no** hay scripts de backfill, **no** hay que preservar `console_config` legacy, y se puede normalizar el vocabulario nuevo (`visibleTabs: ['patterns','visuals']`, una sola forma de `qrConfig`, etc.) sin rutas de compatibilidad. Lo único que NO se borra: `profiles`, `teams`, `plans`, suscripciones/billing.

---

## 0. Decisiones tomadas (el usuario puede revertir)

Estas tres decisiones de producto estaban abiertas. Se eligen los valores recomendados; si el usuario indica otra cosa, ajustar la fase correspondiente.

| # | Decisión | Valor elegido | Fase afectada |
|---|----------|---------------|---------------|
| D1 | Creación/gestión de rigs tras quitar `/rigs` | **Modal compacto "Manage shows"** (create/rename/delete/set-default) + auto-creación lazy de un rig "Default" para que `/control` siempre tenga dónde guardar. Conserva el entitlement `maxRigs`. | Fase B + Fase G |
| D2 | Editor de Cue List (solo existía en `/rigs`, ya oculto en control) | **Eliminar el editor** por ahora. Se conservan la tabla `rig_cues` y el avance de cue en vivo. Sin reconstruir UI. | Fase H (limpieza) |
| D3 | Dónde se editan los social links en `/control` | **Nueva sección "Social Links" en el desk de Visuals** (mismo patrón `EditSectionChrome` + `CollapsibleDeskCard`), gated por `customQrBranding`. | Fase D |

> Alternativa mínima a D1 (si se quiere menos scope): omitir la Fase G (modal). Con solo la Fase B (auto-create del rig Default) `/control` ya tiene destino de guardado; los usuarios multi-rig conservan sus rigs existentes pero no podrían crear nuevos hasta añadir el modal. **No recomendado**, pero válido como interino.

---

## 1. Hechos del código que el implementador DEBE conocer

### 1.1 Las tres capas (no mezclar)

| Capa | Dónde se guarda | Editor objetivo |
|------|------------------|-----------------|
| **Layout** (desk del operador) | `rigs.console_config.layouts[]` + `activeLayoutId`; el layout activo se espeja a `console_config.hiddenButtons / playSectionOrder / playerChrome` | `/control` → Edit layout (ya funciona) |
| **Show content** | `console_config.displayName`, `displayNameConfig`, `qrConfig`, `logoConfig`; columnas `rigs.palette`, `default_visual_art_id`, `logo_*`; tabla `rig_socials` | `/control` → Visuals (parcial hoy; **lo completamos**) |
| **Pattern library** | tabla `pattern_sequences` (sin FK a rigs; scope owner/team) | `/control` → Patterns tab (parcial hoy; **lo completamos**) |

`displayName`, `displayNameConfig`, `qrConfig`, `logoConfig` y `rig_socials` son **show content**, **NO** van dentro de `layouts[]`. Cambiar de layout no los altera.

### 1.2 Estado de persistencia HOY (lo que ya guarda `/control` vs. lo que NO)

Verificado en [`web/components/glow/visuals-tab.tsx`](../../web/components/glow/visuals-tab.tsx) y [`web/app/(control)/room/[code]/control/page.tsx`](../../web/app/(control)/room/[code]/control/page.tsx):

| Dato | ¿Se guarda desde control hoy? | Mecanismo |
|------|-------------------------------|-----------|
| Layouts (hiddenButtons, playSectionOrder, playerChrome, visualsHidden, visualsOrder) | ✅ Sí | `commitConfig()` (control page, ~L277) — hace spread `...loadedRig.console_config` antes de sobrescribir → **merge seguro** |
| `logoConfig.rect` (posición/tamaño del logo arrastrado) | ✅ Sí | `persistLogoRect()` (visuals-tab, ~L765) — spread `...existing` → seguro |
| `palette`, `default_visual_art_id`, `logo_enabled` | ✅ Sí | `handleOverwriteRig()` (visuals-tab, ~L799) — NO toca `console_config` |
| Logo asset (imagen) | ✅ Sí | `POST /api/rigs/[id]/logo` |
| **`displayName` + `displayNameConfig.position`** | ❌ **NO** (solo emite en vivo) | `handleDisplayNameChange/Position` (visuals-tab, ~L343) emiten `orchestrator:visuals_set_display` y NO persisten |
| **`qrConfig`** (enabled/position/size/interval/duration) | ❌ **NO** (solo emite en vivo) | `handleQrUpdate` (visuals-tab, ~L361) emite `orchestrator:visuals_set_qr` y NO persiste |
| **`logoConfig.position/effect/opacity`** | ❌ **NO** | controles solo existían en `/rigs` |
| **`rig_socials`** | ❌ **NO** (no hay editor en control) | solo `/rigs` (Socials tab) → `PUT /api/rigs/[id]/socials` |
| `visibleTabs` | ❌ NO | solo `/rigs` (Console tab) |

➡️ **Conclusión:** para retirar `/rigs` sin perder funciones, primero hay que **portar la persistencia** de displayName/qrConfig/logoConfig/socials a `/control` (Fases C y D).

### 1.3 El bug de carga de rig (control carga el rig equivocado)

`loadRig()` en [`control/page.tsx`](../../web/app/(control)/room/[code]/control/page.tsx) (~L637) hace:

```ts
const rig = rigs.find((r) => r.is_default) ?? rigs[0]; // ❌ ignora el rig elegido en /room/new
```

`room_sessions.rig_id` (el rig elegido al crear sala) **se ignora**. `roomState` (payload del socket, `RoomStatePayload` en `web/lib/glow/types.ts`) **no** incluye `rigId`, así que hay que exponerlo por un endpoint web. → **Fase B**.

### 1.4 El write destructivo de `/rigs` (motivo de retirarlo, no solo de "no usarlo")

`handleSave()` en [`web/app/(account)/rigs/page.tsx`](../../web/app/(account)/rigs/page.tsx) (~L863) construye `consoleConfig` **desde cero** (solo `visibleTabs`, `displayName`, `displayNameConfig`, `qrConfig`, `logoConfig`, `playerChrome`) y **omite** `layouts`, `activeLayoutId`, `hiddenButtons`, `playSectionOrder`, `visualsHidden`, `visualsOrder`. Un guardado desde `/rigs` **borra los layouts** creados en control. Por eso `/rigs` debe **eliminarse**, no solo dejarse de enlazar.

### 1.5 Patrón de "merge seguro" que hay que reutilizar siempre

Cliente (ya en uso en `persistLogoRect`): leer el `console_config` actual, hacer spread, sobrescribir solo lo tuyo:

```ts
const existing = (loadedRig?.console_config ?? {}) as Record<string, unknown>;
fetch(`/api/rigs/${rigId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ consoleConfig: { ...existing, miClave: nuevoValor } }) });
```

Servidor (lo añadimos en Fase A): el `PATCH /api/rigs/[id]` hará **deep-merge** de `consoleConfig` contra el valor en BD, de modo que aunque un cliente mande un patch parcial, **nunca** se caen claves hermanas (layouts, etc.). Esto blinda todos los call-sites.

### 1.6 Archivos clave (referencia rápida)

| Área | Path |
|------|------|
| Control (orquestación) | `web/app/(control)/room/[code]/control/page.tsx` |
| Visuals desk | `web/components/glow/visuals-tab.tsx` |
| Pattern editor | `web/components/glow/pattern-sequence-editor.tsx` |
| Layout types | `web/lib/glow/console-layouts.ts` |
| Socials (tipos + helpers + `SOCIAL_KINDS`) | `web/lib/glow/social-kinds.ts` |
| Socials render (junto al QR) | `web/components/glow/rig-social-links.tsx` ← usado por `room-qr-panel.tsx` |
| Share QR (Patterns tab) | `web/components/glow/room-share-controls.tsx` → `room-qr-panel.tsx` |
| API rig | `web/app/api/rigs/[id]/route.ts`, `web/app/api/rigs/route.ts` |
| API socials | `web/app/api/rigs/[id]/socials/route.ts` (PUT, reemplaza todo) |
| API share-info (lee socials para el QR) | `web/app/api/rooms/[code]/share-info/route.ts` |
| Schema | `web/lib/db/schema.ts` |
| `/room/new` (selector de rig + link a quitar) | `web/app/(control)/room/new/page.tsx` |
| Páginas a borrar | `web/app/(account)/rigs/page.tsx`, `web/app/(account)/pattern-sequences/page.tsx` |
| next config (redirects) | `web/next.config.ts` |

---

## 2. Orden de ejecución (resumen)

0. **Fase 0** — Reset de datos: borrar rigs/cues/socials/pattern_sequences (sin retrocompatibilidad).
1. **Fase A** — Blindar `PATCH /api/rigs/[id]` con deep-merge de `console_config`. *(fundacional, no rompe nada)*
2. **Fase B** — Cargar en control el rig de la sesión + garantizar que toda sala tiene `rig_id`.
3. **Fase C** — Persistir show content desde Visuals: displayName, qrConfig, logoConfig.
4. **Fase D** — Editor de Social Links en Visuals + que aparezcan junto al QR.
5. **Fase E** — Pattern sequences: delete/rename dentro del Patterns tab; quitar link a `/pattern-sequences`.
6. **Fase F** *(opcional, recomendado diferir)* — editar `visibleTabs` desde control.
7. **Fase G** — Modal "Manage shows" (crear/renombrar/borrar/default).
8. **Fase H** — Eliminar rutas, links, añadir redirects, limpiar cue UI muerta, actualizar docs, `tsc`.

> Las Fases A→D son el núcleo. **No** ejecutar la Fase H (borrar `/rigs`) hasta que C y D estén verdes, o se pierde la edición de show content/socials.
>
> La **Fase 0** puede ejecutarse en cualquier momento antes del deploy (es independiente del código), pero conviene hacerla al final, **justo antes de desplegar** el código nuevo, para no dejar a usuarios en producción con rigs borrados y código viejo.

---

## Fase 0 — Reset de datos (sin retrocompatibilidad)

**Objetivo:** dejar la BD sin rigs/cues/socials/pattern-sequences para que todos arranquen con el modelo nuevo. Cada usuario quedará con **cero rigs**; el primer `/room/new` auto-crea su rig "Default" (Fase B1).

### 0.1 SQL de borrado (scoped — NO toca auth/teams/billing)

Ejecutar en el **SQL editor de Supabase** (o `psql`) contra la BD de producción:

```sql
BEGIN;
-- rig_cues y rig_socials se borran en cascada (ON DELETE CASCADE desde rigs).
-- room_sessions.rig_id queda NULL automáticamente (ON DELETE SET NULL).
DELETE FROM rigs;
DELETE FROM pattern_sequences;
COMMIT;
```

> **Opcional** — limpiar también sesiones live efímeras y sus media (no obligatorio; si hay salas abiertas perderán branding al recargar):
> ```sql
> -- TRUNCATE TABLE room_media_assets, room_sessions RESTART IDENTITY CASCADE;
> ```

**No usar `TRUNCATE rigs CASCADE`**: arrastraría `room_sessions` (y `ad_impressions`, `room_media_assets`) por las FK, borrando histórico de sesiones/ads innecesariamente. `DELETE FROM rigs` respeta el `SET NULL` y solo cascadea cues/socials.

### 0.2 Qué se simplifica al no haber retrocompatibilidad

- **No** hay script de backfill de layouts (se elimina cualquier referencia a "backfill" del paradigma §6.4).
- En `getConsoleConfig` (control/page.tsx ~L63) se puede **eliminar** el mapeo legacy `tab === 'devices' ? 'patterns'` y leer directamente `'patterns'|'visuals'` (los rigs nuevos ya guardan el vocabulario nuevo). *(Cleanup menor, no bloqueante.)*
- `parseConsoleLayouts` (console-layouts.ts) **se mantiene**: su rama "sintetizar Default" NO es legacy — es el camino de un rig recién creado con `console_config: {}`. Imprescindible.
- `qrConfig` se persiste en una sola forma canónica (la de Visuals, ver Fase C3); no hay que soportar la forma antigua de `/rigs`.

### ✅ Aceptación Fase 0
- `SELECT count(*) FROM rigs;` y `FROM pattern_sequences;` → 0.
- `profiles`, `teams`, `plans`, suscripciones intactas.
- Un usuario existente entra a `/room/new` → se auto-crea su rig "Default" (Fase B1) sin error.

---

## Fase A — Blindar el guardado de `console_config` (deep-merge en servidor)

**Objetivo:** que cualquier `PATCH /api/rigs/[id]` con `consoleConfig` parcial **preserve** las claves no enviadas (`layouts`, `activeLayoutId`, `displayName`, `qrConfig`, `logoConfig`, …).

### A1. Editar `web/app/api/rigs/[id]/route.ts` (función `PATCH`, ~L44–131)

Hoy (~L88) hace `consoleConfig: consoleConfig !== undefined ? consoleConfig : undefined` → **sobrescritura total**. Sustituir por un merge contra `rigExists.consoleConfig` (ya se carga `rigExists` para verificar ownership, ~L58).

Añadir este helper arriba del archivo (fuera del handler):

```ts
const DEEP_MERGE_KEYS = ['logoConfig', 'qrConfig', 'displayNameConfig'] as const;

function mergeConsoleConfig(
  existing: Record<string, unknown> | null | undefined,
  incoming: Record<string, unknown>
): Record<string, unknown> {
  const base = (existing ?? {}) as Record<string, unknown>;
  const out: Record<string, unknown> = { ...base, ...incoming };
  // Sub-objetos conocidos: merge de un nivel para no perder p.ej. logoConfig.rect
  for (const key of DEEP_MERGE_KEYS) {
    const a = base[key];
    const b = incoming[key];
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
      out[key] = { ...(a as object), ...(b as object) };
    }
  }
  return out;
}
```

Dentro de `PATCH`, sustituir la línea de `patch.consoleConfig`:

```ts
// ANTES (en el objeto `patch`):
//   consoleConfig: consoleConfig !== undefined ? consoleConfig : undefined,
// QUITAR esa clave del literal `patch` y AÑADIR después de construir `patch`:
if (consoleConfig !== undefined) {
  patch.consoleConfig = mergeConsoleConfig(
    rigExists.consoleConfig as Record<string, unknown>,
    consoleConfig as Record<string, unknown>
  );
}
```

**Notas:**
- `layouts` es un array: `{...existing, ...incoming}` solo lo reemplaza si `incoming.layouts` viene definido. `commitConfig` (control) **siempre** manda el array completo de `layouts`, así que sigue correcto. Los demás call-sites no mandan `layouts` → se preserva.
- No tocar `POST` (creación): ahí `consoleConfig` parte de `{}` y es correcto.

### A2. (Opcional, recomendado) endpoints de creación por defecto

`POST /api/rigs` (~L65) acepta `name`, `isDefault`, etc. Ya sirve para la Fase B1/G. No requiere cambios salvo confirmar que con body mínimo `{ name, isDefault }` crea un rig válido (lo hace: defaults de palette/art en ~L94).

### ✅ Aceptación Fase A
- `PATCH /api/rigs/[id]` con `{ consoleConfig: { displayName: 'X' } }` sobre un rig con `layouts` → la respuesta conserva `layouts`, `activeLayoutId`, `qrConfig`, `logoConfig`.
- `PATCH` con `{ consoleConfig: { logoConfig: { position: 'top-left' } } }` conserva `logoConfig.rect` previo.
- `commitConfig` (guardar layout en control) sigue funcionando (manda layouts completos).

---

## Fase B — Control carga el rig de la sesión + toda sala tiene `rig_id`

### B1. Garantizar `rig_id` al crear sala — `web/app/(control)/room/new/page.tsx`

En `createRoom()` (~L130), antes de `emitWithCallback('orchestrator:create_room', …)`, resolver un `rigId` no nulo:

```ts
// Resolver SIEMPRE un rigId (la sesión debe quedar ligada a un rig para poder guardar config)
let rigId = selectedRigId;
if (!rigId) {
  if (rigsList && rigsList.length > 0) {
    rigId = (rigsList.find((r) => r.isDefault) ?? rigsList[0]).id;
  } else {
    // Sin rigs: auto-crear uno "Default" (lazy provisioning)
    const res = await fetch('/api/rigs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Default', isDefault: true }),
    });
    if (res.ok) rigId = (await res.json()).id as string;
  }
}
```

Y pasar ese `rigId` (no `selectedRigId`) en el payload de `create_room` y en `paletteSnapshot` (recalcular `selectedRig` a partir del `rigId` resuelto). El realtime ya guarda `rig_id` en `room_sessions` (ver `realtime/src/db.ts → createRoomSession`).

### B2. Nuevo endpoint `GET /api/rooms/[code]/rig`

Crear `web/app/api/rooms/[code]/rig/route.ts`. Devuelve el rig de la **sesión activa propiedad del operador** (con `cues` y `socials`), con fallback al rig `is_default`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { db } from '@/lib/db/drizzle';
import { rigs, roomSessions } from '@/lib/db/schema';
import { and, eq, isNull } from 'drizzle-orm';

const rigWith = {
  cues: { orderBy: (c: any, { asc }: any) => [asc(c.sortOrder)] },
  socials: { orderBy: (s: any, { asc }: any) => [asc(s.sortOrder)] },
} as const;

export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const supabase = await createClient();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { code } = await params;
  const roomCode = code.toUpperCase();

  const session = await db.query.roomSessions.findFirst({
    where: and(
      eq(roomSessions.roomCode, roomCode),
      eq(roomSessions.orchestratorUserId, user.id),
      isNull(roomSessions.endedAt),
    ),
    orderBy: (s, { desc }) => [desc(s.startedAt)],
  });

  const rig = session?.rigId
    ? await db.query.rigs.findFirst({ where: and(eq(rigs.id, session.rigId), eq(rigs.ownerUserId, user.id)), with: rigWith })
    : await db.query.rigs.findFirst({ where: and(eq(rigs.ownerUserId, user.id), eq(rigs.isDefault, true)), with: rigWith });

  return NextResponse.json(rig ?? null);
}
```

### B3. `loadRig()` en control usa el nuevo endpoint — `control/page.tsx` (~L637)

Reemplazar el cuerpo de `loadRig()`:

```ts
async function loadRig() {
  rigLoaded.current = true;
  try {
    const res = await fetch(`/api/rooms/${code.toUpperCase()}/rig`);
    if (!res.ok) return;
    const raw = await res.json();
    if (!raw) return;                  // sin rig (caso borde): control opera sin destino de guardado
    const rig = normalizeRigResponse(raw);
    setLoadedRig(rig);
    // … resto idéntico al actual (rigPalette, setInitialSequenceDraft, setWorkingState…)
  } catch {
    // ignore
  }
}
```

Mantener el resto del efecto igual (sigue disparándose con `roomState`). Ya no se hace `fetch('/api/rigs')` ni `find(is_default)`.

### ✅ Aceptación Fase B
- Crear sala eligiendo un rig no-default en `/room/new` → al entrar a `/control`, `loadedRig.id` es ese rig (no el default).
- Usuario sin rigs crea sala → se auto-crea un rig "Default", la sesión queda ligada, control lo carga.
- `loadedRig.socials` y `loadedRig.cues` llegan poblados (requiere Fase D1 para el tipo).

---

## Fase C — Persistir show content desde Visuals (displayName, qrConfig, logoConfig)

Todo en [`web/components/glow/visuals-tab.tsx`](../../web/components/glow/visuals-tab.tsx).

### C1. Helper `persistShowConfig` (modelado en `persistLogoRect`, ~L765)

Añadir dentro de `VisualsTab`, junto a `persistLogoRect`:

```ts
async function persistShowConfig(partial: Record<string, unknown>) {
  if (!workingState.loadedRigId) return;
  const existing = (loadedRig?.console_config ?? {}) as Record<string, unknown>;
  try {
    const res = await fetch(`/api/rigs/${workingState.loadedRigId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consoleConfig: { ...existing, ...partial } }),
    });
    if (res.ok) onLoadedRigChange?.(normalizeRigResponse(await res.json()));
  } catch {
    // no bloquear la UX en vivo si falla la persistencia
  }
}
```

> Gracias al deep-merge de Fase A, basta con mandar el sub-objeto (p.ej. `{ logoConfig: { position } }`); el servidor conserva `logoConfig.rect`. El spread cliente es defensa extra.

### C2. Persistir `displayName` + posición

En `handleDisplayNameChange` (~L343): mantener el emit en vivo y persistir **en blur**, no en cada tecla. Opción simple: añadir `onBlur` al input del display name (showName section, input ~L1677) que llame:

```ts
persistShowConfig({ displayName: workingState.displayName ?? '', displayNameConfig: { position: displayNamePosition } });
```

En `handleDisplayNamePosition` (~L352): tras el emit, persistir inmediatamente (es un `<select>`):

```ts
persistShowConfig({ displayNameConfig: { position } });
```

### C3. Persistir `qrConfig`

En `handleQrUpdate` (~L361), tras `setActiveQrConfig(config)`, añadir:

```ts
persistShowConfig({ qrConfig: config });
```

`config` ya tiene la forma `{ enabled, position, size, intervalSeconds, durationSeconds }` (superset de lo que leen `/play` y `share-info`, que solo usan `enabled/intervalSeconds/durationSeconds`). Si preocupa el volumen de PATCH al togglear, envolver en un debounce de ~500 ms; **opcional**.

### C4. Añadir controles de `logoConfig.position/effect/opacity` en la sección "Show Name & Logo"

Estos selects vivían solo en `/rigs`. Añadirlos en la `showName` section (~L1610) bajo el logo. Valores y opciones (copiar de `/rigs`):
- `position`: `center | top-left | top-right | bottom-left | bottom-right`
- `effect`: `none | pulse | spin | float | neon`
- `opacity`: número 0–1 (slider; default 0.8)

Estado local inicializado desde `loadedRig.console_config.logoConfig` (igual que ya se hace para `displayNamePosition` ~L308 y qr ~L316). En cada cambio:

```ts
persistShowConfig({ logoConfig: { position, effect, opacity } });
```

(El `rect` se preserva por el deep-merge de Fase A.) Estos controles solo tienen sentido con `entitlements.customRigLogo` y logo subido; gatearlos como el resto del bloque logo.

### ✅ Aceptación Fase C
- Cambiar display name / posición / QR / logo en Visuals, **recargar `/control`** → los valores persisten (vienen de `loadedRig.console_config`).
- Guardar un layout (Edit → Done) tras editar show content → ni layout ni show content se pisan (gracias a Fase A).
- Abrir Share → View QR en Patterns tab → el QR refleja la config (interval/duration) guardada.

---

## Fase D — Editor de Social Links en `/control` (aparecen junto al QR)

**Contexto de render (ya existe, no tocar):** los socials se pintan en `RigSocialLinks` dentro de `RoomQrPanel`, que se muestra en el modal "View QR" de `RoomShareControls` (Patterns tab). `RoomShareControls` hace `fetch('/api/rooms/[code]/share-info')` cada vez que se abre el modal, y `share-info` lee `rig_socials` en vivo desde BD (gated por `customQrBranding`). ➡️ **Editar socials en control y reabrir el QR ya los muestra**, sin reiniciar la sala. Solo falta el **editor**.

### D1. Que `loadedRig` transporte `socials`

En `visuals-tab.tsx`:
- Añadir a `RigWithCues` (~L67): `socials: RigSocialRow[];` donde `RigSocialRow = { kind: string; label?: string | null; url: string; enabled: boolean; sortOrder: number }` (reusar el tipo `RigSocial` de `web/lib/glow/social-kinds.ts`).
- En `normalizeRigResponse` (~L84), mapear:

```ts
socials: Array.isArray(raw.socials)
  ? raw.socials.map((s: any) => ({
      kind: s.kind,
      label: s.label ?? null,
      url: s.url,
      enabled: s.enabled ?? true,
      sortOrder: s.sortOrder ?? s.sort_order ?? 0,
    }))
  : [],
```

`/api/rigs`, `/api/rigs/[id]` y el nuevo `/api/rooms/[code]/rig` ya devuelven `socials` (relación `with: { socials }`), así que el dato llega.

### D2. Componente `SocialLinksEditor`

Crear `web/components/glow/social-links-editor.tsx`. **Reutilizar** `SOCIAL_KINDS`, `RigSocial`, `detectSocialKindFromUrl`, `getSocialLabel` de `web/lib/glow/social-kinds.ts` (NO duplicar el `SOCIAL_KINDS` que había inline en `/rigs`).

Props: `{ socials: RigSocial[]; onChange: (next: RigSocial[]) => void; disabled?: boolean }`.

Lógica de add/remove/update/reorder (portar de `/rigs` ~L829–846):

```ts
function addSocial() {
  onChange([...socials, { kind: 'instagram', label: '', url: '', enabled: true, sortOrder: socials.length }]);
}
function removeSocial(idx: number) {
  onChange(socials.filter((_, i) => i !== idx).map((s, i) => ({ ...s, sortOrder: i })));
}
function updateSocial(idx: number, patch: Partial<RigSocial>) {
  onChange(socials.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
}
```

UI por fila: `<select>` de kind (de `SOCIAL_KINDS`), input URL, input label (solo visible/útil si kind==='other'), checkbox enabled, botón borrar. Botón "Add social link" al final. Copy en inglés.

### D3. Persistencia de socials

Los socials NO van en `console_config`: usan `PUT /api/rigs/[id]/socials` (reemplaza todo el set; gated por `customQrBranding` → 403 si no entitled y `socials.length > 0`). En el contenedor de la sección (VisualsTab), al pulsar "Save social links" (o en cada cambio con debounce):

```ts
async function saveSocials(next: RigSocial[]) {
  if (!workingState.loadedRigId) return;
  const res = await fetch(`/api/rigs/${workingState.loadedRigId}/socials`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ socials: next }),
  });
  if (!res.ok) { /* toast error con json.error */ return; }
  // refrescar loadedRig para que loadedRig.socials quede sincronizado
  const rigRes = await fetch(`/api/rigs/${workingState.loadedRigId}`);
  if (rigRes.ok) onLoadedRigChange?.(normalizeRigResponse(await rigRes.json()));
}
```

> Recomendado: botón explícito **"Save social links"** (no auto-save por tecla) porque el PUT reemplaza todo el set. Mantener un estado local editable y persistir al pulsar.

### D4. Registrar la sección "Social Links" en el desk de Visuals

En `control/page.tsx`, `VISUALS_SECTIONS` (~L91): añadir entrada (decidir orden; sugerido cerca de `showName`):

```ts
{ id: 'socials', label: 'Social Links' },
```

`VISUALS_SECTION_IDS` se deriva solo. El hide/reorder ya funciona por la maquinaria existente.

En `VisualsTab`, renderizar la sección con el patrón estándar (como `showName`/`qr`):

```tsx
{!isSectionHidden('socials') ? (
  <EditSectionChrome mode={mode} {...sectionChromeProps('socials')}>
    <CollapsibleDeskCard title="Social Links" /* … */>
      {entitlements?.customQrBranding ? (
        <SocialLinksEditor socials={localSocials} onChange={setLocalSocials} disabled={!connected} />
        /* + botón Save que llama saveSocials(localSocials) */
      ) : (
        <PlanGateUpsell feature="customQrBranding" roomEntitlements={roomState?.entitlements} />
      )}
    </CollapsibleDeskCard>
  </EditSectionChrome>
) : null}
```

`localSocials` inicializa de `loadedRig?.socials ?? []` (sincronizar con `useEffect` cuando cambie `loadedRig?.id`). `PlanGateUpsell` ya se usa en este archivo (~L846).

### ✅ Aceptación Fase D
- En Visuals (Venue+), añadir/editar/borrar/reordenar socials → "Save social links" persiste.
- Abrir Patterns tab → Share → View QR → los socials nuevos aparecen bajo el QR (`RigSocialLinks`).
- Plan Free/sin `customQrBranding`: se ve el upsell; el PUT con socials no vacío responde 403 (ya implementado).
- Recargar `/control` → socials persisten (vienen de `loadedRig.socials`).

---

## Fase E — Pattern sequences: CRUD completo en el Patterns tab

**Estado hoy:** el editor en control (`variant="control"`) ya hace load/overwrite/save-as-new/send-live. **Falta** delete y rename in-desk; hoy remite a `/pattern-sequences` (link en `pattern-sequence-editor.tsx` ~L521).

### E1. Quitar el link a `/pattern-sequences`

En `web/components/glow/pattern-sequence-editor.tsx` (~L519–525), eliminar el `<p>…<Link href="/pattern-sequences">sequence library</Link>…</p>`.

### E2. Añadir delete (+ rename) dentro del `variant="control"`

- **Delete:** junto al `<select>` de "Saved sequence" del control variant (~L531+), añadir un botón borrar que llame `DELETE /api/pattern-sequences/[id]` (el endpoint existe; modelo en `pattern-sequences/page.tsx → deleteSequence`). Tras borrar: limpiar selección, recargar la lista (el editor ya hace `useSWR('/api/pattern-sequences')` ~L92 → usar su `mutate`).
- **Rename:** la lógica "name changed → crea nueva" ya existe (~L509). Para rename real (sin duplicar), ofrecer "Rename": `PATCH`/`PUT` del nombre vía `/api/pattern-sequences/[id]` si el endpoint lo soporta; si no, mantener el flujo actual (cambiar nombre + overwrite crea nueva) y permitir borrar la antigua. **Verificar** `web/app/api/pattern-sequences/[id]/route.ts` antes de implementar rename; si solo hay GET/PUT/DELETE, usar PUT para actualizar nombre.

### E3. Confirmar que no quedan referencias

`grep -rn "/pattern-sequences" web/app web/components` no debe devolver links de navegación (solo rutas `/api/...`).

### ✅ Aceptación Fase E
- Crear, cargar, sobrescribir, **renombrar**, **borrar** y enviar en vivo secuencias **sin salir de `/control`**.
- No hay link a `/pattern-sequences` en el editor.

---

## Fase F *(opcional — recomendado DIFERIR)* — editar `visibleTabs` desde control

`visibleTabs` (qué tabs se ven: Patterns/Visuals) solo se editaba en `/rigs` (Console tab). Al quitar `/rigs`, queda con su valor guardado o el default `['patterns','visuals']` (ambos visibles). **No es bloqueante.**

Si se quiere portar: añadir en `LayoutManager` (o un pequeño popover de settings del desk) dos checkboxes que hagan `persistShowConfig`/PATCH de `consoleConfig.visibleTabs` usando el vocabulario nuevo `['patterns','visuals']`. El lector en control (`getConsoleConfig`, control/page.tsx ~L63) ya mapea el legacy `'devices' → 'patterns'`, así que es compatible. **Default recomendado: no implementar ahora**; dejar ambos tabs siempre visibles.

---

## Fase G — Modal "Manage shows" (ciclo de vida de rigs)

**Objetivo:** sustituir la creación/gestión que daba `/rigs`, con superficie mínima. Conserva el entitlement `maxRigs`.

### G1. Componente `ManageShowsModal`

Crear `web/components/glow/manage-shows-modal.tsx`. Operaciones (todas con endpoints existentes):
- **Listar:** `GET /api/rigs` (devuelve rigs con cues/socials).
- **Crear:** `POST /api/rigs` con `{ name, isDefault? }` (respeta `maxRigs` → 403 con mensaje; mostrar upsell/toast).
- **Renombrar:** `PATCH /api/rigs/[id]` con `{ name }`.
- **Set default:** `PATCH /api/rigs/[id]` con `{ isDefault: true }` (el API ya desmarca los demás, route.ts ~L112).
- **Borrar:** `DELETE /api/rigs/[id]` (cascade de cues/socials).

UI: lista de rigs con nombre editable, badge "Default", botón set-default, botón borrar (con confirm), y "New show" (input nombre). Copy en inglés. No reproducir las tabs de `/rigs`; esto es solo gestión de identidad del show. La edición de palette/art/logo/QR/socials se hace en `/control` (Fases C/D).

### G2. Puntos de entrada

- `/room/new` (`web/app/(control)/room/new/page.tsx`): donde estaba el link "Rigs Manager" (~L365–371), poner un botón **"Manage shows"** que abre el modal. Tras crear/borrar, revalidar `useSWR('/api/rigs')` para refrescar el `<select>`.
- *(Opcional)* Item "Manage shows" en `web/components/glow/user-account-menu.tsx` (hoy NO tiene "My Rigs"; añadir entrada que abra el modal o navegue a `/room/new`).

### ✅ Aceptación Fase G
- Crear/renombrar/borrar/set-default un show desde el modal, sin `/rigs`.
- `maxRigs` se respeta (intento de exceder → mensaje claro).
- El `<select>` de `/room/new` refleja los cambios.

---

## Fase H — Retirar rutas, redirects, limpieza y docs

> **Pre-requisito:** Fases A–E verdes (y G si se eligió D1=modal). No borrar antes.

### H1. Eliminar páginas
- Borrar `web/app/(account)/rigs/page.tsx`.
- Borrar `web/app/(account)/pattern-sequences/page.tsx`.
- Mantener `web/app/(account)/layout.tsx` y `billing` (no tocar).

### H2. Limpiar links entrantes (ya inventariados — solo hay 2)
- `web/app/(control)/room/new/page.tsx` ~L365–371: sustituido por botón "Manage shows" (Fase G2) o eliminado.
- `web/components/glow/pattern-sequence-editor.tsx` ~L521: eliminado en Fase E1.
- Reconfirmar: `grep -rn "['\"\`]/rigs\|['\"\`]/pattern-sequences" web/app web/components web/lib | grep -v /api/` → **sin resultados**.

### H3. Redirects en `web/next.config.ts`

Añadir (o crear) `async redirects()`:

```ts
async redirects() {
  return [
    { source: '/rigs', destination: '/room/new', permanent: false },
    { source: '/pattern-sequences', destination: '/room/new', permanent: false },
  ];
}
```

(Si `next.config.ts` ya exporta un objeto, integrar la función dentro.)

### H4. Limpiar Cue List muerta (D2 = eliminar editor)
- En `control/page.tsx`, `VISUALS_SECTIONS` (~L99): ya está comentada `// { id: 'cues', label: 'Cue List' }` → dejar fuera (o borrar el comentario).
- No borrar la tabla `rig_cues` ni el avance de cue en realtime (`room-manager.ts` ~L2316). Solo se elimina el **editor** (que vivía en `/rigs`, ya borrado en H1).

### H5. Actualizar docs (según `paradigma-layout.md` §12)
- `docs/features/02-rigs.md`: rig = show profile; layout ≠ rig; editores movidos a `/control`; `/rigs` retirada.
- `docs/features/03-control-panel-tabs.md`: socials/displayName/QR/logo se editan en Visuals; pattern CRUD en Patterns tab; no hay Rigs/Pattern-Sequences Manager.
- Marcar en `paradigma-layout.md` §9 las casillas completadas.

### H6. Typecheck + lint
- `pnpm --filter web exec tsc --noEmit` (o el script equivalente del repo) → 0 errores.
- Arreglar imports muertos que dejaron las páginas borradas (p.ej. `PatternSequenceEditor variant="default"` ya no se usa desde account, pero el componente sigue vivo para control).

### ✅ Aceptación Fase H
- `/rigs` y `/pattern-sequences` → redirigen; no hay 404 de links internos.
- `tsc` limpio.
- Docs actualizadas.

---

## 3. Checklist de aceptación global (del paradigma)

- [ ] El operador configura el desk completo (Devices + Visuals) sin visitar `/rigs`.
- [ ] El operador hace CRUD de pattern sequences sin visitar `/pattern-sequences`.
- [ ] El operador edita show content (palette, QR, display name, **logo placement**, **socials**) desde `/control` y **persiste** (recargar lo confirma).
- [ ] **Social links** editados en control aparecen junto al QR de compartir (Patterns → Share → View QR).
- [ ] Guardar layout nunca pierde show content; guardar show content nunca pierde layouts (Fase A).
- [ ] La sala live usa el rig elegido en `/room/new` (no solo `is_default`); toda sala tiene `rig_id`.
- [ ] Crear/renombrar/borrar/default de shows desde el modal (Fase G).
- [ ] No quedan enlaces rotos; `/rigs` y `/pattern-sequences` redirigen.
- [ ] `tsc --noEmit` verde.

## 4. QA de regresión (manual, mínimo)

1. **Free plan, sin rigs:** crear sala → se auto-crea "Default" → editar palette/art en Visuals → Overwrite Rig → recargar → persiste.
2. **Venue plan:** subir logo, arrastrarlo (rect), set position/effect/opacity, display name, QR periódico, socials → recargar control → **todo** persiste; el QR de compartir muestra nombre + socials.
3. **Layouts:** crear 2 layouts, cambiar entre ellos, editar show content entremedio → ni layouts ni show content se corrompen.
4. **Multi-rig:** crear 2º show en el modal, elegirlo en `/room/new`, abrir control → carga el rig correcto.
5. **Patterns:** crear/cargar/overwrite/rename/delete/send-live una secuencia sin salir de control.
6. **Rutas viejas:** visitar `/rigs` y `/pattern-sequences` → redirect, sin errores en consola.

## 5. Riesgos y notas

- **Carrera de PATCH a `console_config`:** mitigada por el deep-merge de servidor (Fase A). Aun así, evitar disparar `persistShowConfig` y `commitConfig` simultáneamente desde la misma interacción.
- **`qrConfig` una sola forma:** al borrar la BD (Fase 0) no hay datos antiguos; persistir únicamente la forma de Visuals `{enabled, position, size, intervalSeconds, durationSeconds}`. `/play` y `share-info` solo leen `enabled/intervalSeconds/durationSeconds`.
- **Socials gating:** `share-info` solo expone socials/rigName si `customQrBranding`. El editor debe gatearse igual (upsell), y el PUT ya devuelve 403 en su defecto.
- **Realtime sin cambios:** este plan NO toca el protocolo del socket ni `realtime/`. El rig de la sesión se resuelve por endpoint web (Fase B2), no por `roomState`. (Alternativa futura: añadir `rigId` a `RoomStatePayload`; no necesaria ahora.)
- **Se vacían filas, no se borran tablas:** Fase 0 hace `DELETE` de las filas de `rigs`/`rig_cues`/`rig_socials`/`pattern_sequences`, pero el **schema** (tablas, columnas, FKs) permanece. No hay migración DDL.
- **Coordinar Fase 0 con el deploy:** ejecutar el borrado **justo antes/junto** al despliegue del código nuevo. Si se borra mucho antes, los usuarios con el código viejo (`/rigs`) verían su lista vacía.
