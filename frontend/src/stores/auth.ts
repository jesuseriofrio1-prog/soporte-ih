import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api'
import router from '../router'

/**
 * Store de autenticación.
 *
 * Modelo: cookies HttpOnly. NO almacenamos el JWT en localStorage ni en memoria
 * para que un eventual XSS no pueda robarlo. El estado local que conservamos
 * (email, id) es sólo UX: el "source of truth" es siempre el backend vía
 * GET /auth/me.
 *
 * Limpieza legacy: borramos cualquier token antiguo de versiones previas
 * (localStorage-based) para evitar confusión.
 */

const LEGACY_KEYS = [
  'soporte_ih_token',
  'soporte_ih_user_email',
  'skinna_token',
  'skinna_user_email',
]
;(function limpiarLegacy() {
  try {
    for (const k of LEGACY_KEYS) localStorage.removeItem(k)
  } catch {
    // Silencioso: algunos entornos (Safari en modo privado) no permiten ls.
  }
})()

export const useAuthStore = defineStore('auth', () => {
  // Estado cacheado (se refresca con checkToken). Null = no logueado / desconocido.
  const userId = ref<string | null>(null)
  const userEmail = ref<string | null>(null)
  const checked = ref(false) // si ya llamamos a /auth/me en esta sesión

  const isAuthenticated = computed(() => !!userId.value)

  async function login(email: string, password: string) {
    // El backend setea cookies HttpOnly (sih_session, sih_csrf) y devuelve el user.
    const { data } = await api.post('/auth/login', { email, password })
    userId.value = data.user.id
    userEmail.value = data.user.email ?? null
    checked.value = true
  }

  async function logout() {
    try {
      await api.post('/auth/logout')
    } catch {
      // Ignorar: limpiamos estado local igual.
    }
    userId.value = null
    userEmail.value = null
    checked.value = true
    router.push('/login')
  }

  /**
   * Verifica que la cookie de sesión siga viva. Llama a GET /auth/me.
   * Devuelve true/false. Si falla con 401 el interceptor ya redirige.
   */
  async function checkToken(): Promise<boolean> {
    try {
      const { data } = await api.get('/auth/me')
      userId.value = data.id
      userEmail.value = data.email ?? null
      checked.value = true
      return true
    } catch {
      userId.value = null
      userEmail.value = null
      checked.value = true
      return false
    }
  }

  return { userId, userEmail, isAuthenticated, checked, login, logout, checkToken }
})
