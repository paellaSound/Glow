# Guía de Scripts — Proyecto Glow

Este documento sirve como referencia rápida para entender qué hace cada script disponible en el proyecto monorrepo de Glow, divididos por el servicio al que pertenecen.

---

## 💻 Web App (Directorio `/web`)

Este es el backend y frontend principal construido con Next.js (App Router), Drizzle ORM (Postgres/Supabase), y Stripe.

Para ejecutar cualquiera de estos scripts, sitúate primero en el directorio `web`:
```bash
cd web
```

| Script Command | Comando Real | Descripción |
| :--- | :--- | :--- |
| **`pnpm dev`** | `next dev --turbopack --hostname 0.0.0.0` | Inicia el servidor de desarrollo de Next.js usando Turbopack. Escucha en todas las interfaces de red (`0.0.0.0`) para que puedas probar la aplicación en tu móvil usando la IP de tu ordenador en la misma red local. |
| **`pnpm build`** | `pnpm --filter glow-presets build && next build` | Compila primero el paquete compartido de presets (`glow-presets`) y luego compila la aplicación Next.js para producción optimizando páginas estáticas y SSR. |
| **`pnpm start`** | `next start` | Arranca el servidor Next.js compilado en modo producción (requiere haber ejecutado `pnpm build` previamente). |
| **`pnpm generate-assets`** | `python3 scripts/generate-assets.py` | Genera de manera automatizada favicons, logotipos e iconos PWA adaptados a todos los tamaños necesarios a partir de una sola imagen o SVG transparente. *(Ver sección detallada más abajo)*. |
| **`pnpm db:setup`** | `npx tsx lib/db/setup.ts` | Corre el script inicializador de base de datos para preparar tablas básicas y configuraciones iniciales. |
| **`pnpm db:seed`** | `npx tsx lib/db/seed.ts` | Siembra la base de datos con planes de suscripción, límites de uso y crea un usuario de prueba local (`test@test.com` con contraseña `admin123`). |
| **`pnpm db:generate`** | `drizzle-kit generate` | Genera los archivos SQL de migración basados en los cambios detectados en tus esquemas de Drizzle (`lib/db/schema.ts`). |
| **`pnpm db:migrate`** | `drizzle-kit migrate` | Aplica todas las migraciones SQL pendientes a tu base de datos conectada en Supabase. |
| **`pnpm db:studio`** | `drizzle-kit studio` | Abre una interfaz de base de datos interactiva en tu navegador en `http://local.drizzle.studio` para explorar y modificar datos visualmente. |
| **`pnpm stripe:listen`** | `stripe listen --forward-to localhost:3000/api/stripe/webhook` | Redirige eventos de tu cuenta de pruebas de Stripe a tu webhook local de Next.js para probar pagos y suscripciones en desarrollo (requiere la CLI de Stripe). |
| **`pnpm supabase:link`** | `supabase link --project-ref eakiuxrwhptmzcirkiry` | Vincula el CLI local de Supabase con tu proyecto remoto en la nube. |

---

## ⚡ Servidor Realtime (Directorio `/realtime`)

Este es el servidor Node.js que gestiona las conexiones persistentes WebSocket usando Socket.io para sincronizar los píxeles de luz de cada pantalla en tiempo real.

Para ejecutar cualquiera de estos scripts, sitúate en el directorio `realtime`:
```bash
cd realtime
```

| Script Command | Comando Real | Descripción |
| :--- | :--- | :--- |
| **`pnpm dev`** | `pnpm --filter glow-presets build && tsx watch src/index.ts` | Compila los presets e inicia el servidor WebSocket de desarrollo usando `tsx`. Observa y recarga en caliente (hot-reload) si modificas cualquier archivo del código. |
| **`pnpm build`** | `pnpm --filter glow-presets build && tsc` | Compila la librería de presets y transpila todo el servidor TypeScript a JavaScript nativo listo para producción. |
| **`pnpm start`** | `tsx src/index.ts` | Inicia el servidor realtime de producción ejecutando el código transpílado. |
| **`pnpm typecheck`** | `tsc --noEmit` | Ejecuta el compilador de TypeScript para comprobar la integridad de tipos en el servidor realtime sin generar archivos de salida (útil para auditorías pre-commit). |

---

## 🎨 Librería de Presets Compartidos (Directorio `/web/packages/glow-presets`)

Librería interna que contiene las matemáticas y algoritmos para renderizar efectos como ondas de audio, destellos, arcoíris, etc. Es compartida por el frontend (`web`) y el servidor WebSocket (`realtime`).

Para ejecutar cualquiera de estos scripts, sitúate en el directorio `/web/packages/glow-presets`:
```bash
cd web/packages/glow-presets
```

| Script Command | Comando Real | Descripción |
| :--- | :--- | :--- |
| **`pnpm build`** | `tsc` | Compila el código TypeScript a JavaScript nativo para que sea consumible por el monorrepo. |
| **`pnpm test`** | `pnpm build && node --import tsx --test tests/**/*.test.ts` | Ejecuta el corredor de pruebas nativo de Node.js sobre los tests de rendimiento y renderizado de presets. |
| **`pnpm typecheck`** | `tsc --noEmit` | Realiza una verificación de tipado en toda la librería de presets. |

---

## ⚙️ Uso Detallado: Generador de Logotipos e Iconos (`generate-assets`)

Este script te permite regenerar instantáneamente toda la suite de favicons, iconos de iOS, Android, PWA y logos optimizados.

### Recomendación para la imagen origen:
Para obtener un resultado óptimo en todos los dispositivos y navegadores, te recomendamos pasar un archivo **PNG con fondo transparente (modo RGBA)** o un archivo vectorial **SVG sin fondo**, con una resolución alta (ej. `1024x1024` píxeles) y el logotipo centrado.

### Modo de uso:
Sitúate en el directorio `/web` y ejecuta el script pasándole la ruta de tu imagen:

```bash
pnpm generate-assets public/logo.svg
```

#### Opciones avanzadas:
* **Fondo Transparente en los márgenes de relleno**:
  Si tu imagen es apaisada y deseas que el script no autodetecte el color de fondo, sino que rellene el lienzo superior/inferior con transparencia:
  ```bash
  pnpm generate-assets public/logo.svg --transparent
  ```
* **Fondo con Color de relleno personalizado**:
  ```bash
  pnpm generate-assets public/logo.svg --bg "#0E081B"
  ```
