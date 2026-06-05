# Guía de Desarrollo y Base de Datos

Esta guía detalla cómo levantar el proyecto localmente, configurar las conexiones a la base de datos (tanto local como producción en Supabase), y migrar datos desde producción a local de forma segura para realizar pruebas sin poner en peligro el entorno productivo.

---

## 🚀 Cómo levantar el proyecto localmente

Sigue estos pasos para instalar dependencias y levantar el servidor de desarrollo por primera vez:

### 1. Clonar e Instalar Dependencias
Instala los módulos necesarios del proyecto usando `pnpm`:
```bash
pnpm install
```

### 2. Configurar el Entorno y Stripe CLI
Para el funcionamiento correcto de los pagos, inicia sesión en la interfaz de línea de comandos de Stripe:
```bash
stripe login
```

A continuación, ejecuta el script de configuración interactivo que creará tu archivo `.env` base:
```bash
pnpm db:setup
```
> [!NOTE]
> Durante la ejecución de `pnpm db:setup`, el script te preguntará si deseas usar una instancia local de Postgres con Docker (`L`) o una remota (`R`). Elige **`L`** si deseas crear y arrancar automáticamente un contenedor de base de datos local.

### 3. Ejecutar Migraciones y Datos de Semilla (Seed)
Una vez que el archivo `.env` esté listo y la base de datos en funcionamiento, ejecuta las migraciones de Drizzle para crear el esquema e introduce los datos iniciales de prueba:
```bash
pnpm db:migrate
pnpm db:seed
```
*Esto creará un usuario de prueba en tu base de datos local con las credenciales:*
- **Email:** `test@test.com`
- **Contraseña:** `admin123`

### 4. Iniciar Servidor de Desarrollo
Levanta el servidor local de Next.js:
```bash
pnpm dev
```
La aplicación estará disponible en [http://localhost:3000](http://localhost:3000).

Para recibir los Webhooks de Stripe de manera local en desarrollo, abre otra terminal y ejecuta:
```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

## 🗄️ Configuración de Bases de Datos (Local vs. Producción)

El proyecto utiliza Drizzle ORM para interactuar con la base de datos a través de la variable `POSTGRES_URL` en tu archivo `.env`.

### 1. Entorno Local (Docker)
Si estás desarrollando de forma aislada sin internet o quieres probar cambios disruptivos, debes apuntar a tu contenedor de Docker local.
Asegúrate de que el contenedor de Postgres local esté activo (`docker compose up -d`) y usa esta cadena en tu archivo `.env`:

```env
# Conexión local a Docker (Puerto 54322 definido en docker-compose.yml)
POSTGRES_URL=postgres://postgres:postgres@localhost:54322/postgres
```

### 2. Entorno de Producción (Supabase)
Si deseas conectar tu entorno local a tu base de datos de producción en Supabase (o cuando despliegues a producción en Vercel), debes usar la URL del **Connection Pooler** de tu proyecto.

```env
# Conexión remota a Supabase (Usa el host asignado a tu proyecto, ej: aws-1 o aws-0)
POSTGRES_URL=postgresql://postgres.eakiuxrwhptmzcirkiry:[TU_CONTRASEÑA]@aws-1-eu-west-2.pooler.supabase.com:5432/postgres
```

> [!IMPORTANT]
> **Nota sobre puertos y hosts en Supabase:**
> - **Puerto 5432 (Session Mode / Pooler):** Recomendado para desarrollo local y migraciones, ya que mantiene la compatibilidad con comandos de Drizzle (`pnpm db:migrate`).
> - **Puerto 6543 (Transaction Mode / Pooler):** Recomendado para Serverless/Edge Functions en producción para gestionar de forma eficiente la concurrencia.
> - **Host (`aws-1` vs `aws-0`):** Asegúrate de usar el host asignado por Supabase para evitar el error `Tenant or user not found`. Puedes confirmarlo ejecutando `supabase db query --linked "SELECT 1"` o mirando el archivo de enlace de Supabase CLI en `supabase/.temp/pooler-url`.

---

## 🔒 Migrar Datos de Producción a Local de Forma Segura

Para hacer pruebas realistas en local utilizando datos de producción **sin peligro de alterar o borrar la base de datos real**, puedes replicar/clonar los datos siguiendo este procedimiento.

### Paso 1: Exportar los datos desde Producción (Supabase)
Utilizando Supabase CLI, puedes exportar únicamente los registros (filas de datos) omitiendo la estructura de tablas para evitar colisiones de esquema:

```bash
# Exportar solo los datos de producción en formato SQL
export PATH=/opt/homebrew/bin:$PATH # Si usas macOS y necesitas localizar el CLI
supabase db dump --linked --data-only -f data_prod_dump.sql
```

> [!TIP]
> Si deseas usar herramientas PostgreSQL estándar como `pg_dump`, puedes hacerlo mediante la cadena de conexión:
> ```bash
> pg_dump --data-only --inserts --column-inserts -d "postgresql://postgres.eakiuxrwhptmzcirkiry:[TU_CONTRASEÑA]@aws-1-eu-west-2.pooler.supabase.com:5432/postgres" -f data_prod_dump.sql
> ```

### Paso 2: Preparar y Limpiar la Base de Datos Local
1. Asegúrate de que tu `.env` local esté apuntando al puerto de Docker local (`localhost:54322`).
2. Si tienes datos previos creados por el seed o pruebas manuales en local que puedan generar conflictos de claves primarias (ID duplicados), limpia las tablas locales. Puedes vaciarlas rápidamente ejecutando comandos SQL locales o recreando el contenedor:
   ```bash
   # Opción radical: Borrar y recrear el contenedor local limpio
   docker compose down -v
   docker compose up -d
   pnpm db:migrate
   ```

### Paso 3: Importar los Datos a tu Postgres Local (Docker)
Dado que el contenedor de Docker expone el puerto de Postgres, el método más rápido y limpio (sin necesidad de tener instalado `psql` o herramientas Postgres en tu sistema operativo) es pasar el archivo SQL al contenedor y ejecutarlo por dentro:

```bash
# 1. Copiar el archivo SQL generado al contenedor de Docker
docker cp data_prod_dump.sql next_saas_starter_postgres:/data_prod_dump.sql

# 2. Ejecutar el script SQL dentro del contenedor usando psql integrado
docker exec -it next_saas_starter_postgres psql -U postgres -d postgres -f /data_prod_dump.sql
```

Si tienes `psql` instalado localmente en tu terminal de macOS/Linux, también puedes hacerlo directamente así:
```bash
PGPASSWORD=postgres psql -h localhost -p 54322 -U postgres -d postgres -f data_prod_dump.sql
```

### Paso 4: Validar
Arranca el servidor local de desarrollo (`pnpm dev`) y comprueba que puedes iniciar sesión con los usuarios y cuentas reales que estaban registrados en producción. **Todo cambio, escritura o borrado que hagas a partir de ahora afectará únicamente a tu Docker local en el puerto 54322.**

---

## 🛠️ Comandos útiles

| Comando | Acción |
| :--- | :--- |
| `pnpm dev` | Inicia el servidor de desarrollo de Next.js |
| `pnpm db:setup` | Configura el entorno e inicia Docker Postgres |
| `pnpm db:generate` | Genera los archivos de migración de Drizzle a partir del esquema |
| `pnpm db:migrate` | Aplica las migraciones pendientes en la base de datos activa |
| `pnpm db:seed` | Inserta datos de prueba en la base de datos activa |
| `pnpm stripe:listen` | Escucha y redirige webhooks de Stripe localmente |
| `pnpm supabase:link` | Vincula explícitamente el proyecto local con la app en Supabase producción |
| `docker compose up -d` | Inicia la base de datos local en segundo plano |
| `docker compose down` | Detiene y apaga el contenedor de base de datos local |
| `docker compose logs -f` | Muestra los logs en tiempo real de tu base de datos local |
