import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api'
import router from '../router'

const TOKEN_KEY = 'soporte_ih_token'
const EMAIL_KEY = 'soporte_ih_user_email'
const FCM_KEY = 'soporte_ih_fcm_registered'

// Migración one-shot desde las keys antiguas ("skinna_*") a las nuevas.
// Se puede eliminar en un release futuro cuando todos los clientes hayan actualizado.
;(function migrateLegacyKeys() {
  const legacyToken = localStorage.getItem('skinna_token')
  if (legacyToken && !localStorage.getItem(TOKEN_KEY)) {
    localStorage.setItem(TOKEN_KEY, legacyToken)
  }
  const legacyEmail = localStorage.getItem('skinna_user_email')
  if (legacyEmail && !localStorage.getItem(EMAIL_KEY)) {
    localStorage.setItem(EMAIL_KEY, legacyEmail)
  }
  const legacyFcm = localStorage.getItem('skinna_fcm_registered')
  if (legacyFcm && !localStorage.getItem(FCM_KEY)) {
    localStorage.setItem(FCM_KEY, legacyFcm)
  }
  localStorage.removeItem('skinna_token')
  localStorage.removeItem('skinna_user_email')
  localStorage.removeItem('skinna_fcm_registered')
})()

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem(TOKEN_KEY))
  const userEmail = ref<string | null>(localStorage.getItem(EMAIL_KEY))

  const isAuthenticated = computed(() => !!token.value)

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password })

    token.value = data.access_token
    userEmail.value = data.user.email

    localStorage.setItem(TOKEN_KEY, data.access_token)
    localStorage.setItem(EMAIL_KEY, data.user.email)
  }

  function logout() {
    token.value = null
    userEmail.value = null
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(EMAIL_KEY)
    localStorage.removeItem(FCM_KEY)
    router.push('/login')
  }

  /** Verifica que el token guardado siga siendo válido */
  async function checkToken() {
    if (!token.value) return false
    try {
      await api.get('/dashboard/stats')
      return true
    } catch {
      logout()
      return false
    }
  }

  return { token, userEmail, isAuthenticated, login, logout, checkToken }
})
