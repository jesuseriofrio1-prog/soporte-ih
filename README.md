# Soporte IH

Plataforma multi-tienda de gestión de pedidos para marcas con despacho por Servientrega en Ecuador.

## Estructura

```
soporte-ih/
├── backend/    # API REST con NestJS + Supabase
├── frontend/   # Vue 3 + Vite + PrimeVue + Tailwind
```

## Desarrollo local

```bash
# Instalar todas las dependencias
npm run install:all

# Iniciar backend en modo desarrollo
npm run dev:backend

# Iniciar frontend en modo desarrollo
npm run dev:frontend
```

Copia los archivos `.env.example` a `.env` en `/backend` y `/frontend` y completa los valores.

## Base de datos

Las migraciones SQL viven en `backend/supabase/migrations/`. Aplícalas en orden contra tu proyecto Supabase:

1. `001_initial_schema.sql` — tablas base (productos, clientes, pedidos, historial).
2. `002_multi_tienda.sql` — tabla `tiendas`, `tienda_id` en las demás tablas, ENUM `estado_pedido` actualizado, RPCs `descontar_stock` y `devolver_stock`, vista `dashboard_stats` con agrupación por tienda.

## Deploy Frontend en Vercel

1. En Vercel importa el repositorio.
   - **Root Directory**: `frontend`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`

2. Variables de entorno:

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL del backend en producción (ej: `https://api.soporteih.com/api`) |
| `VITE_FIREBASE_API_KEY` | API Key de Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | Project ID de Firebase |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | App ID de Firebase |
| `VITE_FIREBASE_VAPID_KEY` | VAPID Key para Web Push |

El `frontend/vercel.json` sólo maneja SPA rewrites y caché de assets; el frontend llama al backend directo vía `VITE_API_URL`.

## Deploy Backend en Vercel

1. Importa el repositorio como segundo proyecto.
   - **Root Directory**: `backend`
   - **Build Command**: `npm run build`
   - Vercel detecta el entrypoint `api/index.ts` automáticamente.

2. Variables de entorno obligatorias:

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_KEY` | Service role key de Supabase |
| `SUPABASE_ANON_KEY` | Anon key de Supabase |
| `FRONTEND_URL` | **Obligatorio en prod** — URL del frontend (CORS) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON string del service account de Firebase |
| `PORT` | Puerto (sólo para ejecución local; Vercel lo ignora) |

> ⚠️ Si `FRONTEND_URL` no está definido en producción, el backend falla en el arranque — es intencional para evitar CORS `*`.

## Deploy Backend alternativo (Railway / Render / Docker)

El backend NestJS también se puede desplegar en cualquier host Node.

### Railway / Render

- **Root Directory**: `backend`
- **Build Command**: `npm ci && npm run build`
- **Start Command**: `npm run start:prod`
- Configura las variables de entorno listadas arriba.

### Docker

```bash
cd backend
docker build -t soporte-ih-api .
docker run -p 3000:3000 --env-file .env soporte-ih-api
```
