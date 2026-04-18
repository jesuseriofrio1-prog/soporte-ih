# Soporte IH

Plataforma multi-tienda de gestión de pedidos para marcas con despacho por Servientrega en Ecuador.

**Producción**: https://soporteih.vercel.app

## Estructura

```
soporte-ih/
├── api/           # Entrada serverless unificada para Vercel (wrapper del backend)
├── backend/       # API REST con NestJS + Supabase
├── frontend/      # Vue 3 + Vite + PrimeVue + Tailwind
└── vercel.json    # Monorepo: un solo deploy para todo
```

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Vue 3, TypeScript, Vite, PrimeVue, TailwindCSS, Pinia, vue-router |
| Backend | NestJS 11, TypeScript, Express adapter (serverless) |
| BD | Supabase (PostgreSQL 17, RLS, RPCs) |
| Push | Firebase Cloud Messaging (opcional) |
| Tracking | Scraping de Servientrega |
| Deploy | Vercel (single project, npm workspaces) |

## Desarrollo local

```bash
# 1) Instalar todas las dependencias (backend y frontend vía workspaces)
npm install

# 2) Variables de entorno:
cp backend/.env.example  backend/.env
cp frontend/.env.example frontend/.env
# Editar con las claves reales

# 3) Backend NestJS en http://localhost:3000
npm run dev:backend

# 4) Frontend Vite en http://localhost:5173
npm run dev:frontend
```

Vite proxea `/api/*` → `http://localhost:3000` en dev (ver `frontend/vite.config.ts`). El código del frontend usa paths relativos `/api/...` igual que en producción.

## Tests

Backend (Jest):

```bash
npm test -w backend
# 29/29 tests passing
```

Cobertura:
- `utils.spec.ts` — normalización de teléfono
- `pedidos.controller.spec.ts` — validación de `tienda_id` en la ruta `GET /pedidos`
- `pedidos/dto/create-pedido.dto.spec.ts` — constraints del DTO con class-validator
- `tiendas.service.spec.ts` — CRUD con Supabase mockeado
- `app.controller.spec.ts` — `GET /health`

Frontend: sin tests unitarios por ahora.

## Base de datos

Migraciones en `backend/supabase/migrations/` (aplicadas en orden contra el proyecto Supabase `yntdsltpcokcxqcbecro`):

| # | Archivo | Resumen |
|---|---------|---------|
| 001 | `001_initial_schema.sql` | Tablas base (productos, clientes, pedidos, historial) + RLS |
| 002 | `002_dashboard_functions.sql` | `get_dashboard_stats()`, `get_ventas_semana()` |
| 003 | `003_canales_stats.sql` | `get_canales_stats()` |
| 004 | `004_fcm_tokens.sql` | Tabla `fcm_tokens` para push notifications |
| 005 | `005_atomic_stock.sql` | RPCs `descontar_stock` / `devolver_stock` |
| 006 | `006_db_size_function.sql` | `get_db_size()` |
| 007 | `007_clientes_con_stats.sql` | Vista `clientes_con_stats` |
| 008 | `008_new_estados.sql` | Flujo de estados nuevo (text, sin ENUM) |
| 009 | `009_pedido_nombre_directo.sql` | `cliente_nombre` / `cliente_telefono` en `pedidos` |
| 010 | `010_retencion_timer.sql` | `retencion_inicio` en `pedidos` |
| 011 | `011_multi_tienda.sql` | Tabla `tiendas`, `tienda_id` FK, RPCs por tienda |
| 012 | `012_colores_extra_tienda.sql` | `color_fondo` / `color_borde` en `tiendas` |

## API — endpoints

Todos bajo `/api`, con validación vía `class-validator` y `ValidationPipe` global.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Healthcheck |
| POST | `/auth/login` | Login JWT (actualmente sin guard global — ver sección Auth) |
| GET | `/tiendas` | Lista tiendas |
| GET | `/tiendas/:id` | Detalle |
| POST | `/tiendas` | Crear |
| PATCH | `/tiendas/:id` | Actualizar |
| GET | `/productos?tienda_id=…` | Lista productos de una tienda |
| POST / PATCH / DELETE | `/productos[/:id]` | CRUD |
| GET | `/clientes?tienda_id=…` | Lista clientes |
| POST / PATCH / DELETE | `/clientes[/:id]` | CRUD |
| GET | `/pedidos?tienda_id=…` | Lista pedidos (requiere `tienda_id` como UUID) |
| POST | `/pedidos` | Crear pedido (verifica tienda y producto) |
| PATCH | `/pedidos/:id` | Editar campos |
| PATCH | `/pedidos/:id/estado` | Cambiar estado |
| PATCH | `/pedidos/:id/retencion` | Toggle del timer de retención |
| DELETE | `/pedidos/:id` | Eliminar pedido |
| GET | `/dashboard/stats?tienda_id=…` | KPIs del mes |
| GET | `/dashboard/ventas-semana?tienda_id=…` | Serie diaria últimos 7 días |
| GET | `/dashboard/canales?tienda_id=…` | Distribución por canal de origen |
| GET | `/dashboard/storage` | Tamaño de la BD |
| POST | `/tracking/sincronizar?tienda_id=…` | Scraping de Servientrega para actualizar estados |
| POST | `/notifications/register-token` | Registrar FCM token |
| POST | `/notifications/send-alerta` | Enviar alerta push |

## Autenticación

El backend tiene `AuthModule` con login vía Supabase Auth y un `AuthGuard`, pero **no está registrado como guard global** en `app.module.ts`. Todas las rutas públicas responden sin token.

El frontend tiene `LoginView` pero **no está conectado al router**. El flujo funciona así de forma intencional hasta decidir el modelo de acceso del panel.

Si se reactiva el flujo:
1. Registrar `APP_GUARD` con `AuthGuard` en `app.module.ts`.
2. Añadir ruta `/login` en `frontend/src/router/index.ts` + `beforeEach` que valide token.
3. Añadir request interceptor en `frontend/src/services/api.ts` para inyectar `Authorization: Bearer <token>`.

## Deploy en Vercel (unificado)

Un solo proyecto Vercel: `soporte-ih` → https://soporteih.vercel.app

- **Root Directory**: raíz del repo
- **Framework Preset**: Other
- Build: `npm run build` (corre backend y frontend vía workspaces)
- Output estático: `frontend/dist`
- Función serverless: `api/index.ts` (incluye `backend/dist/**`)
- Rewrites: `/api/*` → función; resto → `index.html` (SPA)

### Variables de entorno requeridas

Solo las críticas:

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | `https://yntdsltpcokcxqcbecro.supabase.co` |
| `SUPABASE_ANON_KEY` | Anon key de Supabase |
| `SUPABASE_SERVICE_KEY` | Service role key (usado por el backend) |

Opcionales (solo si activas features):

| Variable | Cuándo |
|----------|--------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Push notifications (backend) |
| `VITE_FIREBASE_*` | Push notifications (frontend — Firebase Cloud Messaging) |
| `VITE_API_URL` | Solo si el frontend apunta a otro backend (default: `/api`) |
| `FRONTEND_URL` | Solo si se despliega el backend en dominio separado (CORS) |

Gestión vía Vercel CLI:
```bash
vercel env add SUPABASE_URL production
vercel env ls
```

### Primer deploy

```bash
vercel project add soporte-ih
vercel link --yes --project soporte-ih
# añadir env vars...
vercel --prod --yes
```

## Mantenimiento

### Dominio

Solo `soporteih.vercel.app` debería responder. Los subdominios automáticos (`soporte-ih.vercel.app`, `*-jesuseriofrio1-6136s-projects.vercel.app`) se eliminan con:

```bash
vercel alias rm <subdominio> --yes
```

### SSO / Deployment Protection

Vercel habilita "Vercel Authentication" por defecto en planes Hobby, lo que devuelve 401 a visitantes anónimos. Para dejar el sitio público:

```bash
TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/Library/Application Support/com.vercel.cli/auth.json'))['token'])")
curl -X PATCH "https://api.vercel.com/v9/projects/prj_8qmqQ7X1NagYBrUg4v8LBgEbnIZn?teamId=team_cGcEYqmjlbOgpIUuL3JDrN5c" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ssoProtection":null}'
```

## Deploy alternativo del backend

El backend NestJS también puede desplegarse standalone:

### Railway / Render

- **Root Directory**: `backend`
- **Build**: `npm ci && npm run build`
- **Start**: `npm run start:prod`
- Variables: `SUPABASE_*`, `FIREBASE_SERVICE_ACCOUNT_JSON`, `FRONTEND_URL` (para CORS).

### Docker

```bash
cd backend
docker build -t soporte-ih-api .
docker run -p 3000:3000 --env-file .env soporte-ih-api
```
