# Glow — Planes y modelo de negocio (FUENTE DE VERDAD)

> **Última refactorización:** 2026-06-15.
> Este documento describe el modelo de planes **actual** y, sobre todo, **dónde tocar**
> para cambiarlo en el futuro. La fuente de verdad ejecutable es
> `web/lib/entitlements.ts` (`PLAN_SEED_DATA`); este doc explica el porqué.

---

## 1. Filosofía (decisión de producto)

Glow cobra **solo por dos ejes**, porque solo dos cosas cuestan dinero o aportan valor
diferencial:

| Eje | Qué es | Por qué se cobra |
| --- | --- | --- |
| **Escala** | nº de dispositivos/usuarios por sala | Es el **único coste real**: escalar el servidor de realtime cuesta dinero. |
| **Branding** | logo custom + quitar la marca de agua Glow | El host que quiere "darse a conocer" paga por ello. |

**Invariante clave:** **todas las demás features están desbloqueadas en todos los planes.**
No se castra ninguna funcionalidad por plan. Si en el futuro se quiere volver a gatear una
feature, ver §6 ("Cómo re-gatear una feature").

Reglas:
- `max_matrix_cells === max_devices` siempre (la copy nunca debe prometer más celdas que devices).
- `rows × cols ≤ max_matrix_cells` (validado en cliente y servidor).
- Códigos DB estables: `free`, `plus_25`, `plus_50`, `pro` (no se renombran aunque los
  números de devices ya no coincidan con el código — ver nota en §2).
- Nombres marketing: **Free / Party / Venue / Pro**.

---

## 2. Los cuatro planes

| Marketing | Code DB | Precio | Dispositivos | Branding | Marca de agua | Coverage ack |
| --- | --- | --- | --- | --- | --- | --- |
| **Free** | `free` | €0 | **15** | Glow | sí | no |
| **Party** | `plus_25` | €2.99 | **50** | Glow | sí | no |
| **Venue** | `plus_50` | €5 | **300** | **propio** | **no** | no |
| **Pro** | `pro` | €25 | **∞** (seed: 100000) | **propio** | **no** | **sí** |

> **Nota sobre los códigos:** el código DB `plus_25` ya **no** significa "25 devices"
> (ahora 50). Se mantienen los códigos por estabilidad con Stripe y con los `plan_id` ya
> existentes en la base de datos. Los números reales viven en el seed; el usuario solo ve
> los nombres marketing.

**Diferenciadores reales:**
- **Free → Party:** más devices (15→50) + se quitan los house ads.
- **Party → Venue:** muchos más devices (50→300) + **branding propio** (logo, QR social,
  sin marca de agua).
- **Venue → Pro:** devices ilimitados + aviso de cobertura antes de abrir sala.

---

## 3. Matriz de entitlements (actual — authoritative en el seed)

Fuente: `web/lib/entitlements.ts` → `PLAN_SEED_DATA`.
La constante `ALL_FEATURES_UNLOCKED` agrupa todo lo que es igual en los 4 planes.

### 3.1 Escala (el eje que se paga)
| Key | Free | Party | Venue | Pro |
| --- | --- | --- | --- | --- |
| `max_devices` | 15 | 50 | 300 | 100000 |
| `max_matrix_cells` | 15 | 50 | 300 | 100000 |
| `max_grid_rows` / `cols` | 5/5 | 10/10 | 20/20 | 100/100 |
| `max_live_call_devices` | 2 | 8 | 50 | 200 |
| `ads_enabled` | true | false | false | false |
| `requires_coverage_ack` | false | false | false | **true** |

### 3.2 Branding (el otro eje que se paga)
| Key | Free | Party | Venue | Pro |
| --- | --- | --- | --- | --- |
| `custom_rig_logo` | false | false | true | true |
| `custom_qr_branding` | false | false | true | true |
| `remove_watermark` | false | false | true | true |

### 3.3 Todo lo demás — `ALL_FEATURES_UNLOCKED` (igual en los 4 planes)
`available_presets` (set completo), `audio_reactive`, `matrix_mode`, `advanced_matrix`,
`custom_grid_size`, `manual_fallback_mode`, `gif_search_mode:'full'`, `visuals_surface`,
`available_visual_arts:['audio-shader']`, `effect_layering`, `audience_reactions`,
`custom_media_upload`, `gif_broadcast`, `sequenced_text`, `device_flash_control`,
`webrtc_live_call`, `live_call_test_mode_only:false`, `visuals_emit_slots_per_mode:999`,
`poll_production_enabled` → **todos `true`/ilimitado**.

### 3.4 Palancas latentes (uniformes hoy; reactivables como límites de coste)
`max_room_duration_minutes:720`, `priority_reconnect_window_seconds:180`, `max_rigs:50`,
`max_pattern_sequences:50`. Hoy no diferencian planes, pero pueden volver a tiered si la
duración/QoS de sesión se convierte en un coste relevante. Se cambian en el seed igual que
el resto.

---

## 4. Branding y marca de agua (estado)

- **Logo / QR custom:** ya implementados. Gateados por `customRigLogo` / `customQrBranding`
  en `web/lib/glow/branding.ts` (`resolveSurfaceLogo`, `canUseHostQrBranding`) y
  `realtime/src/branding.ts` (`resolveSurfaceLogo`, `getPublicRigSocials`). Solo cambia
  **qué planes** los tienen a `true` (Venue+).
- **Marca de agua (`remove_watermark`): PENDIENTE de render.** El entitlement ya existe en
  seed/defaults/types. Falta pintar el overlay de marca Glow cuando `!removeWatermark`.
  - **Dónde:** `web/app/(immersive)/room/[code]/visuals/page.tsx` (surface/proyector).
  - **Cómo:** overlay persistente reutilizando `GLOW_LOGO_PATH` / `GLOW_BRAND_NAME` de
    `web/lib/glow/branding.ts`, visible solo cuando `entitlements.removeWatermark === false`.
  - Buscar el ancla `// TODO(watermark)` cuando se implemente.

---

## 5. Confirmación de cobertura (plan ∞)

El plan Pro tiene dispositivos ilimitados, pero el cuello de botella real es la **cobertura
de red del recinto**. Por eso, antes de abrir sala, el host debe confirmar que ha comprobado
la conectividad.

- **Entitlement:** `requires_coverage_ack` (solo `pro` = true).
- **UI:** `web/app/(control)/room/new/page.tsx` — panel de aviso ámbar + checkbox
  "Conozco los riesgos y he comprobado la conectividad / cobertura". El botón de lanzar
  queda bloqueado hasta marcarlo (`handleCreateClick`).
- **Servidor (advisory):** el payload `orchestrator:create_room` incluye `coverageAck`. Hoy
  es informativo; si se quiere enforcement duro, validar en `realtime/src/room-manager.ts`.

---

## 6. Cómo cambiar el modelo de negocio (workflow)

### 6.1 Cambiar precios / devices / branding de un plan
1. Editar `PLAN_SEED_DATA` en **`web/lib/entitlements.ts`** (escala, branding, precio).
2. Si cambia el plan `free`, alinear **`web/lib/entitlements-defaults.ts`** (fallback).
3. Actualizar caps/copy de marketing en **`web/lib/plans/plan-meta.ts`** (`PLAN_META`).
4. Actualizar la copy de billing en **`web/lib/plans/billing-cards.ts`** si aplica.
5. `pnpm db:seed` (local + staging + prod). El seed hace upsert: actualiza valores de planes
   ya existentes (`plan-seed.ts`).
6. Si cambia el **precio**: crear un nuevo Stripe Price y actualizar `stripe_price_id` del
   plan (el seed **no** sobreescribe un price ya existente — `syncStripeProducts()`).

### 6.2 Añadir un entitlement nuevo
1. Añadir la key snake_case a `PLAN_SEED_DATA` (todas las entradas) y a
   `DEFAULT_ENTITLEMENTS`.
2. Añadir el mapeo en `KEY_MAP` (`web/lib/entitlements.ts`).
3. Añadir el campo al tipo `PlanEntitlements` en los **3** sitios:
   `web/lib/entitlements.ts`, `web/lib/glow/types.ts`, `realtime/src/types.ts`.
4. `pnpm db:seed`.
5. Leerlo donde haga falta (servidor `room-manager.ts` y/o UI vía `roomState.entitlements`).

### 6.3 Cómo RE-GATEAR una feature (volver a hacerla de pago)
El sistema es data-driven: **no hace falta tocar código de enforcement.**
1. En `PLAN_SEED_DATA`, pon el flag de esa feature a `false` (o un número menor) en los
   planes donde quieras bloquearla. Sácala de `ALL_FEATURES_UNLOCKED` si solo la quieres en
   algunos planes.
2. `pnpm db:seed`.
3. Listo: el servidor (`realtime/src/room-manager.ts`) y los `<PlanGate>` de la UI vuelven a
   gatear automáticamente, porque ambos leen del entitlement. Si quieres además fijar el plan
   mínimo que la muestra en los upsells, ajusta `FEATURE_MIN_PLAN` en `plan-meta.ts`.

> La maquinaria de gating (server checks + `<PlanGate>` + `FEATURE_MIN_PLAN`) sigue intacta a
> propósito; en el modelo actual está **inerte** porque todos los flags están a `true`.

---

## 7. Mapa de archivos

| Archivo | Rol |
| --- | --- |
| `web/lib/entitlements.ts` | **Seed authoritative** (`PLAN_SEED_DATA`), `KEY_MAP`, tipo, getters |
| `web/lib/entitlements-defaults.ts` | `DEFAULT_ENTITLEMENTS` (fallback = plan free) |
| `web/lib/glow/types.ts`, `realtime/src/types.ts` | Tipo `PlanEntitlements` (mirror) |
| `web/lib/plans/plan-meta.ts` | `PLAN_META` (caps/precios/marketing), `FEATURE_MIN_PLAN` (inerte), helpers |
| `web/lib/plans/billing-cards.ts` | Copy de la página de billing (escala + branding + "todo incluido") |
| `web/app/(control)/room/new/page.tsx` | Picker de matrix + checkbox de cobertura (plan ∞) |
| `web/lib/glow/branding.ts`, `realtime/src/branding.ts` | Logo / QR según branding entitlements |
| `web/lib/db/plan-seed.ts` | Upsert de planes + entitlements en DB |
| `web/lib/db/seed.ts` | `pnpm db:seed` + sync de productos Stripe |
| `realtime/src/room-manager.ts` | Enforcement server-side (escala vivo; features inertes) |

---

## 8. Notas

- El room hace snapshot de los entitlements al crearse (`entitlements_snapshot` en
  `room_sessions`); cambiar un plan a mitad de sala no afecta a la sala activa (hay
  `refreshRoomEntitlements` para refrescar tras upgrade).
- `docs/plans-marketing-strategy.md` y `docs/Last-sprint-for-release.md` describen el modelo
  **anterior** (feature-gating por tier). Este documento los supersede para el modelo de
  planes; consúltalos solo para contexto histórico de copy/posicionamiento.
