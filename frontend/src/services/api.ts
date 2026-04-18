import axios, { type InternalAxiosRequestConfig } from 'axios'

/**
 * Cliente HTTP de Soporte IH.
 *
 * Autenticación:
 *  - El backend setea cookies HttpOnly (`sih_session`) + CSRF legible (`sih_csrf`)
 *    en POST /auth/login. No tocamos el JWT desde JS.
 *  - `withCredentials: true` hace que el navegador envíe las cookies en cada
 *    request same-origin. En dev con Vite proxy también funciona.
 *  - En mutaciones (POST/PUT/PATCH/DELETE) leemos `sih_csrf` de document.cookie
 *    y lo mandamos en X-CSRF-Token (doble submit).
 *  - En 401 forzamos ir a /login (salvo rutas públicas y la propia /login).
 */
const CSRF_COOKIE = 'sih_csrf'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

function readCookie(name: string): string | null {
  const prefix = name + '='
  const parts = document.cookie.split('; ')
  for (const p of parts) {
    if (p.startsWith(prefix)) return decodeURIComponent(p.slice(prefix.length))
  }
  return null
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const method = (config.method || 'get').toLowerCase()
  if (method !== 'get' && method !== 'head' && method !== 'options') {
    const csrf = readCookie(CSRF_COOKIE)
    if (csrf) {
      config.headers.set?.('X-CSRF-Token', csrf)
    }
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const status = error?.response?.status
    if (status === 401) {
      const path = window.location.pathname
      const isPublicPath = path.startsWith('/p/') || path === '/login'
      if (!isPublicPath) {
        // Redirect evitando loops. `replace` para no ensuciar history.
        const redirect = encodeURIComponent(path + window.location.search)
        window.location.replace(`/login?redirect=${redirect}`)
      }
    }
    return Promise.reject(error)
  },
)

export default api
