# Soporte IH

Plataforma multi-tienda de gestión de pedidos para marcas de dropshipping en Ecuador. Integra con **Rocket Ecuador** (import de Excel + webhook de estados + matching de productos con IA) y expone un **formulario público por producto** (`/p/:tiendaSlug/:productoSlug`) que tus clientes finales llenan y que se auto-enlaza con el pedido que creas en Rocket. Incluye tracking público de guías, bandeja de upsell por novedades, unit economics por producto, bundles cosméticos y sistema de referidos con atribución por link.

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
│   │   ├── tracking/       # Scraping de Servientrega (admin)
│   │   ├── tracking-publico/ # /t/:code — tracking con marca para el cliente final
│   │   ├── notifications/  # FCM push (opcional)
│   │   ├── imports/        # Rocket: parser Excel + matcher IA (Claude Haiku)
│   │   ├── webhooks/       # Rocket: receiver de cambios de estado
│   │   ├── templates/      # Plantillas de WhatsApp por tienda
│   │   ├── direcciones/    # Parser de direcciones desde WhatsApp
│   │   ├── referidos/      # Códigos de referido + atribución
│   │   └── solicitudes/    # Formulario público de pedidos + auto-enlace
│   └── supabase/migrations/
├── frontend/      # Vue 3 + Vite + Tailwind + design system v2
└── vercel.json    # Monorepo: un solo deploy para todo
```

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Vue 3, TypeScript, Vite, TailwindCSS, Pinia, vue-router |
| Backend | NestJS 11, TypeScript, Express adapter (serverless) |
| BD | Supabase (PostgreSQL 17, RLS, RPCs) |
| IA | Anthropic SDK + `claude-haiku-4-5` (matching de productos) |
| Excel | exceljs (parseo del Resumen Excel de Rocket) |
| Push | Firebase Cloud Messaging (opcional) |
| Tracking | Scraping de Servientrega |
| Mapas | Google Maps JavaScript API + Geocoding (map picker del form público) |
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
| 018 | `018_webhook_logs_tienda.sql` | `tienda_id` en `webhook_logs` para filtrar por tienda |
| 019 | `019_fcm_tokens_tienda.sql` | `tienda_id` en `fcm_tokens` (push segmentado) |
| 020 | `020_whatsapp_templates.sql` | Tabla `whatsapp_templates` (plantillas por tienda) |
| 021 | `021_tracking_code.sql` | `tracking_code` en `pedidos` para `/t/:code` público |
| 022 | `022_productos_unit_economics.sql` | `costo_unitario` / `fee_envio` en `productos` |
| 023 | `023_productos_bundles.sql` | `es_bundle` / `bundle_upgrade_desde` (upgrade cosmético) |
| 024 | `024_referidos.sql` | Tabla `referidos` + `referido_codigo` en `solicitudes`/`pedidos` |
| 025 | `025_productos_foto.sql` | `foto_url` en `productos` + bucket `producto-fotos` |
| 026 | `026_direcciones_coordenadas.sql` | `lat` / `lng` / `direccion_referencia` en `solicitudes` y `pedidos` (Google Maps picker) |
| 027 | `027_tipo_entrega.sql` | `tipo_entrega` (DOMICILIO / AGENCIA) + `agencia_nombre` / `agencia_direccion` en `solicitudes` y `pedidos` |

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
| POST | `/tracking/sincronizar?tienda_id=…` | Scraping de Servientrega — concurrencia 4 con timeout de 8s por guía. Excluye estados terminales (`ENTREGADO`, `Reportado Entregado…`, `DEVUELTO`, `Devuelto de…`, `DEVOLUCION…`) pero re-procesa `NO_ENTREGADO` (re-intentable) |
| POST | `/notifications/{register-token,check-alertas}` | FCM |

### Integración con Rocket Ecuador

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/imports/rocket-excel?tienda_id=…` | Import idempotente del Resumen Excel de Rocket. Matchea productos por nombre exacto → alias guardado → **IA batch** (Claude Haiku) con auto-mapping ≥85% y sugerencia ≥50% |
| GET / POST / DELETE | `/imports/producto-aliases[/:id]` | Mappings de nombre externo → producto local |
| POST | `/webhooks/rocket/:secret` | **Público** (protegido por secreto-en-URL). Recibe cambios de estado, actualiza el pedido, guarda historial y enlaza solicitudes |
| GET | `/webhooks/rocket/logs` | Últimos eventos recibidos |

### Formulario público + solicitudes

Los endpoints `/public/*` son `@Public()` (sin JWT) y rate-limited (5 POST/min por IP, 60 GET/min). **El link de compra siempre es por producto** (`/p/:tiendaSlug/:productoSlug`) — el link genérico de catálogo fue removido para simplificar atribución y evitar pedidos sin producto.

El formulario público captura:
- Datos del cliente: nombre + **teléfono WhatsApp ecuatoriano** (validación estricta: 10 dígitos empezando con `09`, sanitización en tiempo real).
- **Tipo de entrega** (toggle obligatorio):
  - **Domicilio**: dirección + mapa con pin (flujo completo).
  - **Retiro en agencia Servientrega**: dropdown con 739 agencias reales filtradas por provincia/ciudad. La data se sincroniza desde el endpoint oficial de servientrega.com.ec con los scripts de `scripts/`.
- **Provincia y ciudad como dropdowns cascada** (24 provincias × 221 cantones de Ecuador). Lista en `frontend/src/data/ecuador-geo.ts`.
- **Dirección textual** + **GPS obligatorio** (solo en modo domicilio): mapa siempre visible, se re-centra en la ciudad elegida y el cliente arrastra un pin hasta su casa. Coordenadas (`lat`/`lng`) se guardan en `solicitudes` y se copian al `pedido` al auto-enlazar.
- **Modal guiado para permisos GPS bloqueados**: si el navegador denegó la ubicación o el sistema operativo tiene Servicios de Localización apagados, se muestra un modal con instrucciones específicas por plataforma (iOS, Mac, Windows) en vez de un error críptico.
- Referencia opcional para el mensajero + notas del pedido.

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/public/tiendas/:slug/productos/:productoSlug` | Tienda + producto individual (form público) |
| POST | `/public/tiendas/:slug/solicitudes?producto=slug` | Crea una **solicitud** con `lat`/`lng`/`direccion_referencia` opcionales |
| GET | `/public/tracking/:code` | Tracking público con marca (route `/t/:code`) |
| POST | `/referidos` · GET `/referidos?tienda_id=…` | Gestión de códigos de referido |
| GET | `/public/referidos/validar?tienda_id=…&codigo=…` | Validar código en el form público |

### Tracking público

| Método | Ruta | Descripción |
|--------|------|-------------|
| GET | `/t/:tracking_code` | Página pública con estado, hitos y marca de la tienda. `tracking_code` se genera por pedido en la migración 021 |

## Flujo de negocio

```
Cliente final          Tú (admin)              Rocket Ecuador         Soporte IH
─────────────          ──────────             ───────────────         ──────────
Ve anuncio ─────────► Le manda link
                      /p/skinna/<producto>
                      (opcional ?ref=CODIGO)
Llena form      ─────────────────────────────────────────────────►   crea Solicitud (PENDIENTE)
                                                                     + registra uso de referido (si vino ?ref=)
                      Copia datos ────► Pega en Rocket
                                         Rocket genera ID ─────►
                                         Webhook / Excel  ──────►    crea Pedido (external_order_id)
                                                                     ↓ auto-enlace por rocket_order_id
                                                                     Solicitud → ENLAZADA (pedido_id)
                                                                     ↓
Recibe link /t/<code>  ◄──────────── Tracking público con marca ◄──── tracking_code del pedido
```

**Garantía anti-duplicados**: el pedido real sólo se crea desde Rocket (webhook/Excel). El formulario sólo crea *Solicitudes*. El enlace es bidireccional vía `rocket_order_id`.

## Matching de productos con IA

Cuando el import de Rocket encuentra un nombre que no está ni en el catálogo ni en la tabla de aliases, se envían **todos los nombres pendientes en un único batch** a Claude Haiku (`claude-haiku-4-5`) con structured outputs:

- **Confianza ≥ 85%** → alias guardado automáticamente, pedido creado
- **Confianza 50–84%** → sugerencia en la UI para confirmar con 1 click
- **Sin `ANTHROPIC_API_KEY`** → matcher opera como no-op (la importación sigue funcionando)

Ver `backend/src/imports/producto-matcher.ts`.

> **Nota técnica:** la tabla `producto_aliases` tiene un índice único *funcional* sobre `(tienda_id, external_source, lower(alias_externo))`. Postgres no resuelve `ON CONFLICT` contra índices funcionales, así que el upsert se implementa como `select` + `insert`/`update` manual con `ilike` (ver `imports.service.ts` → `upsertAlias`). Sin este patrón, cualquier guardado de alias devuelve 500.

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
- `GET /public/tracking/:code` (página `/t/:code`)
- `GET /public/referidos/validar`

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
| `VITE_GOOGLE_MAPS_API_KEY` | Map picker del formulario público (Google Maps JS + Geocoding). Debe restringirse por HTTP-referrer al dominio de producción |

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
