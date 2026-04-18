# Soporte IH

Plataforma multi-tienda de gestión de pedidos para marcas con despacho por Servientrega en Ecuador.

## Estructura

```
soporte-ih/
├── api/           # Entrada serverless unificada para Vercel (wrapper)
├── backend/       # API REST con NestJS + Supabase
├── frontend/      # Vue 3 + Vite + PrimeVue + Tailwind
└── vercel.json    # Configuración monorepo: un solo deploy para todo
```

## Desarrollo local

```bash
# Instalar todas las dependencias (backend y frontend)
npm run install:all

# En una terminal — backend NestJS en http://localhost:3000
npm run dev:backend

# En otra terminal — frontend Vite en http://localhost:5173
npm run dev:frontend
```

Vite proxea `/api/*` al backend local (ver `frontend/vite.config.ts`), así que el código usa paths relativos igual que en producción.

Copia `.env.example` a `.env` en `/backend` y `/frontend` y completa los valores.

## Base de datos

Las migraciones SQL viven en `backend/supabase/migrations/` y se aplican en orden:

| # | Archivo | Resumen |
|---|---------|---------|
| 001 | `001_initial_schema.sql` | Tablas base (productos, clientes, pedidos, historial) + RLS |
| 002 | `002_dashboard_functions.sql` | `get_dashboard_stats()`, `get_ventas_semana()` |
| 003 | `003_canales_stats.sql` | `get_canales_stats()` |
| 004 | `004_fcm_tokens.sql` | Tabla `fcm_tokens` para push notifications |
| 005 | `005_atomic_stock.sql` | RPCs `descontar_stock` / `devolver_stock` |
| 006 | `006_db_size_function.sql` | `get_db_size()` |
| 007 | `007_clientes_con_stats.sql` | Vista `clientes_con_stats` |
| 008 | `008_new_estados.sql` | Nuevo flujo de estados (text, sin ENUM) |
| 009 | `009_pedido_nombre_directo.sql` | `cliente_nombre` / `cliente_telefono` en `pedidos` |
| 010 | `010_retencion_timer.sql` | `retencion_inicio` en `pedidos` |
| 011 | `011_multi_tienda.sql` | Tabla `tiendas`, `tienda_id` FK, RPCs por tienda |
| 012 | `012_colores_extra_tienda.sql` | `color_fondo` / `color_borde` en `tiendas` |

Todas estas migraciones ya están aplicadas en el proyecto Supabase de producción (`yntdsltpcokcxqcbecro`). Los archivos se mantienen en el repo para trazabilidad y para recrear el schema en proyectos nuevos.

## Deploy en Vercel (unificado)

Frontend y backend viven en un único proyecto Vercel. El frontend se sirve como estático desde `frontend/dist`; las rutas `/api/*` caen en una función serverless (`api/index.ts` → wrapper de NestJS).

### Configuración del proyecto

1. En Vercel importa el repositorio.
   - **Root Directory**: dejar en raíz (no especificar).
   - **Framework Preset**: Other.
   - El `vercel.json` de la raíz ya define `buildCommand`, `outputDirectory`, rewrites y headers.

### Variables de entorno

Solo un set — todas en el mismo proyecto:

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_KEY` | Service role key de Supabase |
| `SUPABASE_ANON_KEY` | Anon key de Supabase |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON string del service account de Firebase (push) |
| `VITE_API_URL` | Opcional. Por defecto `/api` (same-origin). Solo se cambia si apuntas a otro backend. |
| `VITE_FIREBASE_API_KEY` | API Key de Firebase (web) |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Project ID de Firebase |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | App ID de Firebase |
| `VITE_FIREBASE_VAPID_KEY` | VAPID Key para Web Push |

No necesitas `FRONTEND_URL` — el deploy unificado es same-origin y CORS no aplica. Solo setea `FRONTEND_URL` si decides poner el backend en un dominio distinto.

### Git integration

Conecta el proyecto Vercel al repo GitHub (`jesuseriofrio1-prog/soporte-ih`) para que cada push a `main` dispare un deploy automático.

## Deploy alternativo del backend (Railway / Render / Docker)

El backend NestJS también se puede desplegar standalone en cualquier host Node.

### Railway / Render

- **Root Directory**: `backend`
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm run start:prod`
- Variables: `SUPABASE_*`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `FRONTEND_URL` (si el frontend está en otro dominio).

### Docker

```bash
cd backend
docker build -t soporte-ih-api .
docker run -p 3000:3000 --env-file .env soporte-ih-api
```
