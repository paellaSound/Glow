# Glow — Guía de despliegue en internet

Esta guía describe los pasos para publicar el MVP de Glow en producción después de validarlo en local.

## Arquitectura en producción

Glow no es una sola app: son **tres piezas** que deben estar conectadas.

```txt
┌─────────────────┐     WebSocket      ┌──────────────────┐
│  Web (Next.js)  │ ◄──────────────► │ Realtime (Node)  │
│    Vercel       │                    │ Railway / Fly…   │
└────────┬────────┘                    └────────┬─────────┘
         │                                    │
         │  HTTPS + Auth                      │  Postgres + Auth JWT
         ▼                                    ▼
┌─────────────────────────────────────────────────────────┐
│                    Supabase                            │
│  Auth (OAuth / email)  ·  Postgres  ·  Pooler         │
└─────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────┐
│     Stripe      │  ← webhooks → /api/stripe/webhook
└─────────────────┘
```

| Componente | Dónde desplegar | Por qué |
| --- | --- | --- |
| `web/` | **Vercel** | Next.js, SSR, API routes, Stripe webhook |
| `realtime/` | **Railway**, Fly.io, Render o VPS | Socket.io con estado en memoria; **no** encaja en Vercel Functions |
| Base de datos + Auth | **Supabase** (ya lo usas) | Postgres, OAuth, JWT |
| Pagos | **Stripe** | Checkout + webhooks |

> **Importante:** las salas activas viven en memoria del servicio `realtime`. Un solo proceso = un solo servidor de salas. Para escalar después hará falta Redis/adapter; en MVP basta con **una instancia** de realtime.

---

## Checklist previo

Antes de desplegar, confirma en local:

- [ ] Login (email o Google) funciona
- [ ] Crear sala + unirse desde otro dispositivo funciona
- [ ] Matrix y colores sincronizan
- [ ] `pnpm db:seed` ha creado planes (`free`, `plus_25`, etc.)
- [ ] Tienes acceso al dashboard de Supabase y Stripe

---

## Paso 1 — Supabase (producción)

### 1.1 Base de datos

1. Usa tu proyecto Supabase existente o crea uno de producción.
2. Aplica las migraciones de Glow:

```bash
cd web
cp .env.example .env.local
# Rellena POSTGRES_URL con el pooler de Supabase (puerto 6543 recomendado)
pnpm db:migrate
pnpm db:seed
```

3. Comprueba en **Table Editor** que existen tablas `plans`, `profiles`, `teams`, `room_sessions`, etc.

**Connection string recomendada** (transaction pooler, evita límites de sesión):

```txt
postgresql://postgres.[PROJECT_REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres
```

El código también puede reescribir `:5432` → `:6543` automáticamente si usas el pooler de Supabase.

### 1.2 Auth — URLs de redirección

En **Supabase Dashboard → Authentication → URL Configuration**:

| Campo | Valor (ejemplo) |
| --- | --- |
| Site URL | `https://tu-dominio.com` |
| Redirect URLs | `https://tu-dominio.com/auth/callback` |

Añade también la URL de preview de Vercel si quieres probar en preview:

```txt
https://tu-proyecto.vercel.app/auth/callback
```

### 1.3 Google OAuth (cuando lo configures)

1. **Authentication → Providers → Google** → activar.
2. Crea credenciales en [Google Cloud Console](https://console.cloud.google.com/).
3. Authorized redirect URI en Google:

```txt
https://[PROJECT_REF].supabase.co/auth/v1/callback
```

4. Pega Client ID y Secret en Supabase.

### 1.4 Email/password (opcional en prod)

Si sigues usando login por email en dev:

- Desactiva “Confirm email” solo si aceptas el riesgo en producción, **o**
- Configura SMTP en Supabase para confirmaciones reales.

### 1.5 Claves API

Guarda estas claves (las usarás en Vercel y Railway):

| Clave | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Web (pública) |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Web (pública) |
| `SUPABASE_SERVICE_ROLE_KEY` | Solo servidor (seed, admin); **nunca** en el cliente |
| `POSTGRES_URL` | Web + realtime (secreto) |

---

## Paso 2 — Stripe

### 2.1 Modo test primero

1. Usa claves **test** de Stripe hasta validar el flujo completo.
2. El seed (`pnpm db:seed`) crea productos/precios en Stripe test y los enlaza a `plans`.

### 2.2 Webhook de producción

1. **Stripe Dashboard → Developers → Webhooks → Add endpoint**
2. URL:

```txt
https://tu-dominio.com/api/stripe/webhook
```

3. Eventos mínimos:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`

4. Copia el **Signing secret** → `STRIPE_WEBHOOK_SECRET` en Vercel.

### 2.3 Claves en Vercel

| Variable | Valor |
| --- | --- |
| `STRIPE_SECRET_KEY` | `sk_test_...` o `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` del endpoint de producción |

---

## Paso 3 — Desplegar `web` en Vercel

### 3.1 Conectar el repositorio

1. [vercel.com](https://vercel.com) → **Add New Project**
2. Importa el repo de Glow.
3. **Root Directory:** `web`
4. Framework: Next.js (auto-detectado)
5. Package manager: **pnpm**

### 3.2 Variables de entorno (Vercel)

Configúralas en **Project → Settings → Environment Variables** (Production):

```env
BASE_URL=https://tu-dominio.com

POSTGRES_URL=postgresql://postgres.[REF]:[PASSWORD]@....pooler.supabase.com:6543/postgres

NEXT_PUBLIC_SUPABASE_URL=https://[REF].supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...

NEXT_PUBLIC_REALTIME_URL=https://realtime.tu-dominio.com

STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Opcional: seed remoto / scripts
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

**Crítico:** `NEXT_PUBLIC_REALTIME_URL` debe ser la URL **pública HTTPS** del servicio realtime (paso 4), no `localhost:4000`.

### 3.3 Deploy

1. Push a `main` o manual deploy.
2. Comprueba build: `pnpm build` debe pasar (ya validado en local).
3. Abre la URL de Vercel y prueba `/` y `/sign-in`.

### 3.4 Dominio custom (opcional)

1. Vercel → **Domains** → añade `tu-dominio.com`
2. Actualiza DNS según indique Vercel.
3. Actualiza `BASE_URL` y las redirect URLs de Supabase.

---

## Paso 4 — Desplegar `realtime` (Railway recomendado)

Vercel **no** puede hospedar este servicio: necesita un proceso Node **siempre activo** con WebSockets.

### 4.1 Deploy desde GitHub (recomendado) o CLI

Lo más fiable es conectar el repo a Railway y desplegar con cada push a `main`. La
[Railway CLI](https://docs.railway.com/cli) sirve para vincular y desplegar desde terminal,
siempre **desde la raíz del repo**.

#### Instalar y autenticar

```bash
# macOS (alternativa: npm i -g @railway/cli)
brew install railway

railway login
railway whoami
```

#### Crear o vincular el proyecto

> **Crítico (monorepo):** el deploy se hace **desde la raíz del repo**, nunca desde
> `realtime/`. El servicio `realtime` depende de `glow-presets` y `glow-visuals`
> (`workspace:*`), que viven en `web/packages/*`, y del `pnpm-lock.yaml` raíz. Si Railway
> parte de `realtime/`, las deps `workspace:*` no se resuelven y el build falla. Ver
> [§4.6 Troubleshooting](#46-troubleshooting-railway--monorepo).

Recomendado: **deploy desde GitHub** (push a `main`). Railway lee `realtime/railway.toml`
y `nixpacks.toml` (raíz) y construye el monorepo completo.

Con CLI, vincula el servicio (no subas solo `realtime/`):

```bash
# Vincula este repo con el servicio ya creado en el dashboard
railway link
```

#### Variables de entorno

Las variables son por servicio (no dependen del directorio). Con el servicio vinculado:

```bash
railway variables --set NODE_ENV=production \
  --set POSTGRES_URL="postgresql://postgres.[REF]:[PASSWORD]@....pooler.supabase.com:6543/postgres" \
  --set SUPABASE_URL="https://[REF].supabase.co" \
  --set SUPABASE_SERVICE_ROLE_KEY="eyJ..." \
  --set CORS_ORIGIN="https://tu-dominio.com" \
  --set VISUALS_TOKEN_SECRET="el-mismo-secreto-que-en-vercel"

# Comprobar
railway variables
```

#### Desplegar

Empuja a `main` (GitHub) y Railway despliega automáticamente. Si usas CLI, sube **desde la
raíz del repo** (no desde `realtime/`):

```bash
# Desde la RAÍZ del repo
railway up
```

Railway detecta el monorepo pnpm (gracias a `nixpacks.toml` + `package.json` raíz con
`packageManager: pnpm`) y ejecuta install/build/start según `realtime/railway.toml`. El
puerto lo inyecta la plataforma vía `PORT` (ya lo lee el código).

Comandos útiles tras el deploy:

```bash
railway status          # estado del proyecto/servicio
railway logs            # logs en vivo
railway logs --build    # logs del build
railway restart         # reiniciar el servicio
railway open            # abrir el dashboard en el navegador
```

Referencia: [CLI — Deployment](https://docs.railway.com/cli/deploying), [Variables](https://docs.railway.com/cli/variable), [Logs](https://docs.railway.com/cli/logs).

#### Dominio público (CLI)

```bash
cd realtime
railway domain
```

Obtendrás una URL tipo `https://glow-realtime-production.up.railway.app`. Cópiala a Vercel como `NEXT_PUBLIC_REALTIME_URL` y redespliega la web.

#### Probar local con las variables de Railway

Para validar antes de subir:

```bash
cd realtime
railway run pnpm dev
```

`railway run` inyecta las variables del servicio remoto en el comando local ([docs](https://docs.railway.com/cli/run)).

### 4.2 Railway Dashboard (alternativa)

Si prefieres la UI en lugar de la CLI:

1. [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
2. Selecciona el repo.
3. **Root Directory:** `/` (raíz del repo — **no** `realtime/`; el servicio necesita `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml` y `web/packages/*`).
4. **Config as Code:** `realtime/railway.toml` (ruta absoluta desde la raíz del repo). `nixpacks.toml` en la raíz fuerza `pnpm install` (sin esto Railway usa `npm` y falla con `workspace:*`).
5. Comandos (también definidos en `realtime/railway.toml`):

| Fase | Comando |
| --- | --- |
| Install | `pnpm install --frozen-lockfile` |
| Build | `pnpm --filter glow-realtime build` |
| Start | `pnpm --filter glow-realtime start` |

6. Railway asigna un puerto vía `PORT` (ya lo lee el código).

> El script `build` de `glow-realtime` compila explícitamente sus dependencias workspace
> antes de `tsc` (`pnpm -C ../web/packages/glow-presets build && pnpm -C ../web/packages/glow-visuals build && tsc`),
> usando rutas explícitas en vez de `--filter glow-presets` (que era ambiguo: existían dos
> paquetes con ese nombre). El `start` ejecuta `node dist/index.js`, **sin `tsx` en
> runtime** (así no dependemos de devDependencies en producción).

### 4.3 Variables de entorno (realtime)

```env
NODE_ENV=production

PORT=4000

POSTGRES_URL=postgresql://postgres.[REF]:[PASSWORD]@....pooler.supabase.com:6543/postgres

SUPABASE_URL=https://[REF].supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Origen exacto de la web en producción (sin barra final)
CORS_ORIGIN=https://tu-dominio.com

# Debe coincidir exactamente con Vercel (web)
VISUALS_TOKEN_SECRET=tu-secreto-compartido
```

Si usas preview de Vercel, puedes listar varios orígenes separados por coma:

```env
CORS_ORIGIN=https://tu-dominio.com,https://tu-proyecto.vercel.app
```

> En producción CORS es estricto: solo acepta los orígenes de `CORS_ORIGIN`, no IPs de LAN.

### 4.4 Dominio público para realtime

1. Railway → servicio → **Settings → Networking → Generate Domain**
2. Obtendrás algo como `glow-realtime-production.up.railway.app`
3. Copia esa URL (con `https://`) a Vercel como `NEXT_PUBLIC_REALTIME_URL`
4. Redespliega **web** en Vercel para que coja la variable nueva

**Opcional:** subdominio propio `realtime.tu-dominio.com` → CNAME al dominio de Railway.

### 4.5 Verificar realtime

Abre en el navegador:

```txt
https://tu-url-realtime/status
```

O la raíz del servicio; debe responder JSON:

```json
{"status":"ok","service":"glow-realtime"}
```

### 4.6 Troubleshooting Railway + monorepo

Errores reales encontrados desplegando `glow-realtime` y su causa raíz. **El problema de
fondo es siempre el mismo:** Railway trataba `realtime` como un proyecto aislado, pero
depende del monorepo pnpm completo.

| Error | Causa raíz | Arreglo |
| --- | --- | --- |
| `ERR_PNPM_OUTDATED_LOCKFILE` | Deploy desde `realtime/` (sin el `pnpm-lock.yaml` raíz) o lockfile no pusheado | Deploy desde `/`; commitear y pushear el `pnpm-lock.yaml` raíz |
| `EUNSUPPORTEDPROTOCOL workspace:*` | Railway cayó a **npm** (npm no entiende `workspace:*`) | `nixpacks.toml` + `package.json` raíz con `packageManager: pnpm@…` fuerzan pnpm |
| `pnpm: not found` | Railpack eligió npm porque no veía `pnpm-lock.yaml` ni `packageManager` en la raíz del deploy | Deploy desde `/`; `nixpacks.toml` instala `pnpm` en setup |
| `build` no compila `glow-visuals` | El script de build solo encadenaba `glow-presets` | `build` compila `glow-presets` **y** `glow-visuals` y luego `tsc` |
| `start` falla (falta `tsx`) | `tsx` es devDependency; producción puede podarlas | `start` usa `node dist/index.js` |
| Paquete `glow-presets` duplicado | Existía en `packages/` y `web/packages/`; `--filter glow-presets` compilaba el equivocado | Rutas explícitas `pnpm -C ../web/packages/...` |
| Deploy bloqueado por CVE en Next | Al desplegar desde `/`, Railway escanea todo el lockfile (incl. `web`) y bloqueó `next@15.6.0-canary.59` | Bump de `next` a una versión sin el CVE |
| Deploy `SKIPPED` | Los `watchPatterns` no incluían `pnpm-lock.yaml` ni `web/package.json` | `watchPatterns` ampliados en `realtime/railway.toml` |

**Configuración final correcta (Railway dashboard):**

| Ajuste | Valor |
| --- | --- |
| Root Directory | `/` (raíz del repo) |
| Config file | `/realtime/railway.toml` |
| Install | `pnpm install --frozen-lockfile` |
| Build | `pnpm --filter glow-realtime build` |
| Start | `pnpm --filter glow-realtime start` |

**Ficheros que sostienen este montaje** (todos commiteados en el repo):

- `package.json` (raíz) — `"packageManager": "pnpm@10.32.1"` + scripts `build:realtime` / `start:realtime`.
- `nixpacks.toml` (raíz) — instala `nodejs_22` + `pnpm` y fuerza `pnpm install --frozen-lockfile`.
- `realtime/railway.toml` — `buildCommand` / `startCommand` con `--filter glow-realtime` + `watchPatterns` ampliados.
- `.railwayignore` (raíz) — excluye `node_modules`, `.pnpm-store`, `dist`, `.next`.
- `realtime/package.json` — `build` compila ambos paquetes workspace; `start` = `node dist/index.js`.

---

## Paso 5 — Conectar todo

Orden recomendado:

```txt
1. Supabase (migraciones + seed + redirect URLs)
2. Realtime (deploy + URL pública + CORS)
3. Vercel web (NEXT_PUBLIC_REALTIME_URL apuntando al realtime)
4. Stripe webhook apuntando a Vercel
5. Prueba end-to-end
```

---

## Paso 6 — Prueba en producción

Checklist de validación:

1. **Health realtime:** `https://...` → `{ status: ok }`
2. **Login:** `/sign-in` → crear cuenta o Google
3. **Crear sala:** `/room/new` → no debe quedarse en "Connecting..."
4. **Segundo dispositivo:** `/join` con el código de sala
5. **Control:** cambiar color en matrix desde el orquestador
6. **Billing (test):** `/billing` → checkout Stripe test → plan actualizado, ads desactivados en salas de pago

Si el socket se queda en **Connecting...**:

- `NEXT_PUBLIC_REALTIME_URL` incorrecta o no redesplegada en Vercel
- `CORS_ORIGIN` no incluye el origen exacto de la web (protocolo + dominio + sin `/` final)
- Realtime caído o sin HTTPS

Si falla **login / bootstrap**:

- Migraciones o seed no aplicados
- `POSTGRES_URL` incorrecta o pool agotado (usa puerto **6543**)

---

## Referencia rápida de variables

### Web (Vercel)

| Variable | Obligatoria | Notas |
| --- | --- | --- |
| `BASE_URL` | Sí | URL pública de la web |
| `POSTGRES_URL` | Sí | Pooler `:6543` |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Sí | |
| `NEXT_PUBLIC_REALTIME_URL` | Sí | HTTPS del servicio realtime |
| `STRIPE_SECRET_KEY` | Sí (billing) | |
| `STRIPE_WEBHOOK_SECRET` | Sí (billing) | |
| `SUPABASE_SERVICE_ROLE_KEY` | Opcional | Scripts / seed |
| `VISUALS_TOKEN_SECRET` | v2 | Firma el token de la superficie de visuales (debe coincidir con realtime). Ver [features/01](./features/01-visuals-surface.md) |
| `KLIPY_APP_KEY` | v2 | Clave servidor para la API de GIFs Klipy (proxy). Ver [features/06](./features/06-orchestrator-media.md) |
| `TURN_URL` | v2 | URL TURN principal (`turn:host:3478`). Ver [features/09](./features/09-webrtc-live-call.md) |
| `TURN_URLS` | v2 | Varias URLs TURN (coma o JSON array). Opcional si ya usas `TURN_URL` |
| `TURN_USERNAME` / `TURN_CREDENTIAL` | v2 | Credenciales TURN (servidor; el navegador las obtiene vía `/api/webrtc/ice-servers`) |
| `TURN_RELAY_ONLY` | v2 | `true` fuerza ICE relay-only (pruebas cross-network) |
| `WEBRTC_ICE_TRANSPORT_POLICY` | v2 | `all` (default) o `relay` |

### Realtime (Railway / Fly / Render)

| Variable | Obligatoria | Notas |
| --- | --- | --- |
| `POSTGRES_URL` | Sí | Misma DB que web |
| `SUPABASE_URL` | Sí | |
| `SUPABASE_SERVICE_ROLE_KEY` | Recomendada | Validación JWT orquestador |
| `CORS_ORIGIN` | Sí | URL(s) de la web |
| `PORT` | Auto | Lo inyecta la plataforma |
| `NODE_ENV` | Sí | `production` |
| `VISUALS_TOKEN_SECRET` | v2 | Verifica el token de la superficie de visuales (igual que en web) |

---

## Alternativas a Railway para `realtime`

| Plataforma | Notas |
| --- | --- |
| **Fly.io** | Buena para WebSockets; requiere `fly.toml` |
| **Render** | Web Service con `pnpm start`; plan free duerme |
| **Google Cloud Run** | Posible pero WebSockets + estado en memoria son incómodos |
| **VPS** (Hetzner, etc.) | Máximo control; tú gestionas PM2/systemd + nginx |

Para el primer deploy, **Railway o Fly** suelen ser los más directos.

---

## Limitaciones del MVP en producción

- **Una instancia de realtime:** salas en memoria; reiniciar el servicio cierra salas activas.
- **Sin persistencia de eventos de color** (by design en MVP).
- **Reproductores anónimos:** cualquiera con el código puede unirse.
- **Login email/password** es temporal; el objetivo final es OAuth (Google).

---

## Después del primer deploy

- [ ] Pasar Stripe de test a live cuando el producto esté listo
- [ ] Dominio propio para web y realtime
- [ ] Quitar login email/password si solo quieres OAuth
- [ ] Monitorizar logs de Vercel + Railway
- [ ] Planificar escalado de realtime (Redis adapter) si crece el tráfico

---

## WebRTC live-call — TURN y pruebas cross-network

Las credenciales TURN se configuran **solo en el servidor web** (Vercel). El navegador las
obtiene en runtime desde `GET /api/webrtc/ice-servers` (no uses `NEXT_PUBLIC_TURN_*`). El
servicio **realtime no necesita variables TURN** (solo relaya signaling, no media).

### Variables (web)

Ejemplo con **Metered** (proveedor TURN gestionado usado en Glow; credenciales estáticas
username/password — la API Key de credenciales dinámicas aún no se usa):

```env
# Varias URLs como JSON array (recomendado) o separadas por coma
TURN_URLS=["turn:global.relay.metered.ca:80","turn:global.relay.metered.ca:443","turns:global.relay.metered.ca:443?transport=tcp"]
TURN_USERNAME=tu-usuario-metered
TURN_CREDENTIAL=tu-password-metered
WEBRTC_ICE_TRANSPORT_POLICY=all
TURN_RELAY_ONLY=false

# Alternativa simple de una sola URL:
# TURN_URL=turn:your-turn.example.com:3478
```

Comprobar: `GET https://tu-dominio.com/api/webrtc/ice-servers` debe devolver `"hasTurn": true`.

### Pruebas manuales

| Escenario | Config | Resultado esperado |
| --- | --- | --- |
| LAN sin TURN | Sin vars TURN | STUN-only; funciona en la misma red |
| Cross-network | TURN_* configurado | Publisher en datos móviles aparece en visuals surface |
| Relay-only | `WEBRTC_ICE_TRANSPORT_POLICY=relay` o `TURN_RELAY_ONLY=true` | Solo candidatos relay; útil para validar TURN |
| Cambio WiFi ↔ celular | TURN + resilience | Tile se recupera vía ICE restart / re-offer |
| Surface tardía | `visuals:subscribe` con live call activo | `surface_reconnect` re-oferta (cooldown 5s por publisher) |

> **Seguridad:** las credenciales TURN llegan al cliente porque WebRTC las necesita. Usa
> credenciales temporales del proveedor TURN cuando sea posible.

---

## Comandos útiles

```bash
# Local
cd web && pnpm dev
cd realtime && pnpm dev

# Migraciones + seed (antes o después del primer deploy remoto)
cd web && pnpm db:migrate && pnpm db:seed

# Build de comprobación
cd web && pnpm build
cd realtime && pnpm build
```

---

## Documentos relacionados

- [product-intent.md](./product-intent.md) — arquitectura y producto
- [architecture.md](./architecture.md) — arquitectura v2 (superficies, topics, datos)
- [plans.md](./plans.md) — planes y gating de features
- [features/00-feature-index.md](./features/00-feature-index.md) — specs numeradas v2
- [strategy.md](./strategy.md) — fases de implementación (Fase 11 = deploy)
- [../README.md](../README.md) — desarrollo local
