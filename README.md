# Soporte IH

Plataforma multi-tienda de gestión de pedidos para marcas de dropshipping en Ecuador. Integra con **Rocket Ecuador** (import de Excel + webhook de estados + matching de productos con IA) y expone un **formulario público por producto** que tus clientes finales llenan y que se auto-enlaza con el pedido que creas en Rocket.

**Producción**: https://soporteih.vercel.app

## Estructura

```
soporte-ih/
├── api/           # Entrada serverless unificada para Vercel (wrapper del backend)
├── backend/       # API REST con NestJS + Supabase
│   ├── src/
│   │   ├── auth/           # Login JWT (guard definido pero no global)
│   │   ├── tiendas/        # Multi-tienda (slug público, colores, logo)
│   │   ├── productos/      # Catálogo por tienda
│   │   ├── clientes/       # CRM básico
│   │   ├── pedidos/        # Core: estados, historial, retención
│   │   ├── dashboard/      # KPIs, series, canales, storage
│   │   ├── tracking/       # Scraping de Servientrega
│   │   ├── notifications/  # FCM push (opcional)
│   │   ├── imports/        # Rocket: parser Excel + matcher IA (Claude Haiku)
│   │   ├── webhooks/       # Rocket: receiver de cambios de estado
│   │   └── solicitudes/    # Formulario público de pedidos + auto-enlace
│   └── supabase/migrations/
├── frontend/      # Vue 3 + Vite + PrimeVue + Tailwind
└── vercel.json    # Monorepo: un solo deploy para todo
```

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Vue 3, TypeScript, Vite, PrimeVue, TailwindCSS, Pinia, vue-router |
| Backend | NestJS 11, TypeScript, Express adapter (serverless) |
| BD | Supabase (PostgreSQL 17, RLS, RPCs) |
| IA | Anthropic SDK + `claude-haiku-4-5` (matching de productos) |
| Excel | exceljs (parseo del Resumen Excel de Rocket) |
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

Vite proxea `/api/*` → `http://localhost:3000` en dev (ver `frontend/vite.config.ts`).

## Tests

```bash
# Todo: backend (Jest) + frontend (Vitest)
npm test
# 43 backend + 56 frontend = 99 tests passing
```

Por separado:
```bash
npm run test:backend   # Jest
npm run test:frontend  # Vitest (watch mode: cd frontend && npm run test:watch)
```

Cobertura:
- **Backend**: utils/teléfono, DTOs de pedidos, CRUD de tiendas, parser de Excel Rocket (fixture real), mapeo de 16 estados Rocket, `GET /health`.
- **Frontend**: composables (`useTextExtractor` extrae datos de mensajes WhatsApp, `useWhatsApp` normaliza teléfonos ecuatorianos) y stores (`productos`, `auth`) con service mockeado.

## Base de datos

Migraciones en `backend/supabase/migrations/` (aplicadas contra el proyecto Supabase `yntdsltpcokcxqcbecro`):

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
| 013 | `013_stats_enriquecidas.sql` | Dashboard: novedades, riesgo de devolución |
| 014 | `014_limpiar_retencion_terminales.sql` | Cleanup de `retencion_inicio` en estados terminales |
| 015 | `015_rocket_import.sql` | `external_source`, `external_order_id`, `cantidad` + tabla `producto_aliases` |
| 016 | `016_provincia_y_webhook_logs.sql` | Columna `provincia` en clientes/pedidos + tabla `webhook_logs` |
| 017 | `017_solicitudes.sql` | `tiendas.slug` + tabla `solicitudes` (formulario público) |

## API — endpoints

Todos bajo `/api`, con validación vía `class-validator` y `ValidationPipe` global.

### Core

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/health` | Healthcheck |
| POST | `/auth/login` | Login JWT (actualmente sin guard global) |
| GET / POST / PATCH | `/tiendas[/:id]` | Multi-tienda CRUD |
| GET / POST / PATCH / DELETE | `/productos[/:id]` | Catálogo |
| GET / POST / PATCH / DELETE | `/clientes[/:id]` | CRM |
| GET / POST / PATCH / DELETE | `/pedidos[/:id]` | Pedidos + estado + retención |
| GET | `/dashboard/{stats,ventas-semana,canales,storage}` | KPIs del panel |
| POST | `/tracking/sincronizar?tienda_id=…` | Scraping de Servientrega |
| POST | `/notifications/{register-token,check-alertas}` | FCM |

### Integración con Rocket Ecuador

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/imports/rocket-excel?tienda_id=…` | Import idempotente del Resumen Excel de Rocket. Matchea productos por nombre exacto → alias guardado → **IA batch** (Claude Haiku) con auto-mapping ≥85% y sugerencia ≥50% |
| GET / POST / DELETE | `/imports/producto-aliases[/:id]` | Mappings de nombre externo → producto local |
| POST | `/webhooks/rocket/:secret` | **Público** (protegido por secreto-en-URL). Recibe cambios de estado, actualiza el pedido, guarda historial y enlaza solicitudes |
| GET | `/webhooks/rocket/logs` | Últimos eventos recibidos |

### Formulario público + solicitudes

Los endpoints `/public/*` son `@Public()` (sin JWT) y rate-limited (5 POST/min por IP, 60 GET/min).

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/public/tiendas/:slug` | Tienda pública (branding + catálogo) |
| GET | `/public/tiendas/:slug/productos/:productoSlug` | Tienda + producto individual |
| POST | `/public/tiendas/:slug/solicitudes[?producto=slug]` | Crea una **solicitud** (no un pedido) |
| GET | `/solicitudes?tienda_id=…&estado=…` | Bandeja del admin |
| GET | `/solicitudes/stats?tienda_id=…` | Contadores para el badge del sidebar |
| PATCH | `/solicitudes/:id/vincular-rocket` | Pega el `rocket_order_id` — si el pedido ya existe, se enlaza inmediato |
| PATCH | `/solicitudes/:id/estado` | Cambiar entre `PENDIENTE`, `ENVIADA_A_ROCKET`, `ENLAZADA`, `CANCELADA` |
| DELETE | `/solicitudes/:id` | Eliminar |

## Flujo de negocio

```
Cliente final          Tú (admin)              Rocket Ecuador         Soporte IH
─────────────          ──────────             ───────────────         ──────────
Ve anuncio ─────────► Le manda link          
                      /p/skinna/<producto>
Llena form      ─────────────────────────────────────────────────►   crea Solicitud (PENDIENTE)
                      Abre bandeja /solicitudes
                      "Copiar todo" ────► Pega en Rocket
                                           Rocket genera ID ─────►   
                      Pega ID en solicitud ──────────────────────►   ENVIADA_A_ROCKET
                                           Webhook / Excel  ──────►  crea Pedido (external_order_id)
                                                                     ↓ auto-enlace por rocket_order_id
                                                                     Solicitud → ENLAZADA (pedido_id)
```

**Garantía anti-duplicados**: el pedido real sólo se crea desde Rocket (webhook/Excel). El formulario sólo crea *Solicitudes*. El enlace es bidireccional vía `rocket_order_id`.

## Matching de productos con IA

Cuando el import de Rocket encuentra un nombre que no está ni en el catálogo ni en la tabla de aliases, se envían **todos los nombres pendientes en un único batch** a Claude Haiku (`claude-haiku-4-5`) con structured outputs:

- **Confianza ≥ 85%** → alias guardado automáticamente, pedido creado
- **Confianza 50–84%** → sugerencia en la UI para confirmar con 1 click
- **Sin `ANTHROPIC_API_KEY`** → matcher opera como no-op (la importación sigue funcionando)

Ver `backend/src/imports/producto-matcher.ts`.

## Autenticación

Auth global activada con **cookies HttpOnly + CSRF double-submit**.

Flujo:
1. `POST /auth/login` valida contra Supabase Auth y setea:
   - `sih_session` — HttpOnly, contiene el JWT (inaccesible desde JS).
   - `sih_csrf` — legible por JS, para el patrón doble-submit.
2. `JwtAuthGuard` está registrado como `APP_GUARD` global (`app.module.ts`).
   Todas las rutas requieren JWT salvo las marcadas `@Public()`.
3. En mutaciones (POST/PUT/PATCH/DELETE), el guard valida que
   `X-CSRF-Token` header coincida con `sih_csrf` cookie (timing-safe).
4. `GET /auth/me` devuelve `{id, email}` — el frontend lo usa para saber
   si sigue logueado sin guardar nada en localStorage.
5. `POST /auth/logout` limpia ambas cookies.

Rate-limit login: **20 intentos / 5 min por IP**.

Rutas marcadas `@Public()` (sin token):
- `POST /auth/login`, `POST /auth/logout`
- `GET /health`
- `POST /webhooks/rocket/:secret` (secret comparado en tiempo constante)
- `GET /public/tiendas/:slug[/productos/:productoSlug]` (catálogo y form)
- `POST /public/tiendas/:slug/solicitudes`

El frontend:
- `services/api.ts` con `withCredentials: true` + interceptor que añade
  `X-CSRF-Token` en mutaciones. En 401 redirige a `/login?redirect=`.
- Router `beforeEach` cachea la sesión con `/auth/me` una vez por carga;
  las rutas `meta.public` puras (formularios `/p/:slug`) se saltan el guard.

## Deploy en Vercel (unificado)

Un solo proyecto Vercel: `soporteih` → https://soporteih.vercel.app

- **Root Directory**: raíz del repo
- **Framework Preset**: Other
- Build: `npm run build` (corre backend y frontend vía workspaces)
- Output estático: `frontend/dist`
- Función serverless: `api/index.ts` (incluye `backend/dist/**`)
- Rewrites: `/api/*` → función; resto → `index.html` (SPA)
- `vercel.json` tiene `"alias": ["soporteih.vercel.app"]` para pinear el dominio

### Variables de entorno

**Requeridas**:

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | `https://yntdsltpcokcxqcbecro.supabase.co` |
| `SUPABASE_ANON_KEY` | Anon key de Supabase |
| `SUPABASE_SERVICE_KEY` | Service role key (backend) |

**Integraciones**:

| Variable | Cuándo |
|----------|--------|
| `ANTHROPIC_API_KEY` | Matching de productos por IA en el import de Rocket |
| `ROCKET_WEBHOOK_SECRET` | Secreto que Rocket debe incluir en la URL del webhook (`/api/webhooks/rocket/<secret>`) |

**Opcionales**:

| Variable | Cuándo |
|----------|--------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | Push notifications (backend) |
| `VITE_FIREBASE_*` | Push notifications (frontend — FCM) |
| `VITE_API_URL` | Solo si el frontend apunta a otro backend (default: `/api`) |
| `FRONTEND_URL` | Solo si se despliega el backend en dominio separado (CORS) |

Gestión vía Vercel CLI:
```bash
# Agregar/sobrescribir
printf 'VALUE' | vercel env add NAME production --force
vercel env ls
```

### Primer deploy

```bash
vercel link --yes --project soporteih
# añadir env vars...
vercel --prod --yes
```

## Mantenimiento

### Dominio

Solo `soporteih.vercel.app` debería responder. Los subdominios automáticos se eliminan con:

```bash
vercel alias rm <subdominio> --yes
```

### SSO / Deployment Protection

Vercel habilita "Vercel Authentication" por defecto en planes Hobby (401 a anónimos). Para dejar el sitio público:

```bash
TOKEN=$(python3 -c "import json; print(json.load(open('$HOME/Library/Application Support/com.vercel.cli/auth.json'))['token'])")
curl -X PATCH "https://api.vercel.com/v9/projects/prj_8qmqQ7X1NagYBrUg4v8LBgEbnIZn?teamId=team_cGcEYqmjlbOgpIUuL3JDrN5c" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"ssoProtection":null}'
```

### Webhook de Rocket

Configurar en Rocket → Configuración → Webhooks:
```
https://soporteih.vercel.app/api/webhooks/rocket/<ROCKET_WEBHOOK_SECRET>
```

El backend tolera distintas variantes de payload (`order_id`/`external_order_id`/`id_pedido`, `estado`/`status`/`nuevo_estado`). Eventos con secreto inválido → 403. Eventos con datos incompletos → se loguean como `IGNORADO` y responden 200 para que Rocket no reintente.

## Deploy alternativo del backend (standalone)

### Railway / Render
- **Root Directory**: `backend`
- **Build**: `npm ci && npm run build`
- **Start**: `npm run start:prod`
- Variables: `SUPABASE_*`, `ANTHROPIC_API_KEY`, `ROCKET_WEBHOOK_SECRET`, `FRONTEND_URL` (CORS).

### Docker

```bash
cd backend
docker build -t soporte-ih-api .
docker run -p 3000:3000 --env-file .env soporte-ih-api
```
