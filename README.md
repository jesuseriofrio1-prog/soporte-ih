# SKINNA

Panel interno de gestión de pedidos para una marca de skincare en Ecuador.

## Estructura

```
skinna/
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

## Deploy Frontend en Vercel

### 1. Conectar repositorio

- En Vercel, importa el repositorio
- **Root Directory**: `frontend`
- **Framework Preset**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

### 2. Variables de entorno en Vercel

| Variable | Descripción |
|----------|-------------|
| `VITE_API_URL` | URL del backend en producción (ej: `https://api.skinna.ec/api`) |
| `VITE_FIREBASE_API_KEY` | API Key de Firebase |
| `VITE_FIREBASE_AUTH_DOMAIN` | Auth domain (ej: `skinna.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | Project ID de Firebase |
| `VITE_FIREBASE_STORAGE_BUCKET` | Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | Messaging Sender ID |
| `VITE_FIREBASE_APP_ID` | App ID de Firebase |
| `VITE_FIREBASE_VAPID_KEY` | VAPID Key para Web Push |

### 3. Deploy

Cada push a `main` dispara un deploy automático. El `vercel.json` ya configura:
- SPA rewrites (todas las rutas a `/index.html`)
- Cache inmutable para assets estáticos
- Headers correctos para el service worker de FCM

## Deploy Backend

El backend NestJS se puede deployar en cualquier servicio que soporte Node.js (Railway, Render, Fly.io, etc.).

### Variables de entorno del backend

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_SERVICE_KEY` | Service role key de Supabase |
| `SUPABASE_ANON_KEY` | Anon key de Supabase |
| `PORT` | Puerto del servidor (default: 3000) |
| `FRONTEND_URL` | URL del frontend en producción (para CORS) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | JSON string del service account de Firebase |

### Opcion A: Railway (sin Docker)

1. Conecta el repositorio en Railway
2. **Root Directory**: `backend`
3. **Build Command**: `npm ci && npm run build`
4. **Start Command**: `npm run start:prod`
5. Configura las variables de entorno en el dashboard
6. Railway asigna el `PORT` automáticamente

### Opcion B: Render (sin Docker)

1. Crea un **Web Service** en Render
2. **Root Directory**: `backend`
3. **Build Command**: `npm ci && npm run build`
4. **Start Command**: `npm run start:prod`
5. Configura las variables de entorno
6. Render asigna el `PORT` automáticamente

### Opcion C: Docker

El backend incluye un `Dockerfile` multi-stage optimizado:

```bash
cd backend
docker build -t skinna-api .
docker run -p 3000:3000 --env-file .env skinna-api
```

Funciona en cualquier plataforma con soporte Docker (Fly.io, Google Cloud Run, AWS ECS, etc.).
