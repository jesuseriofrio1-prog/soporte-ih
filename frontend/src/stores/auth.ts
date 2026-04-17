import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../services/api'
import router from '../router'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('skinna_token'))
  const userEmail = ref<string | null>(localStorage.getItem('skinna_user_email'))

  const isAuthenticated = computed(() => !!token.value)

  async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password })

    token.value = data.access_token
    userEmail.value = data.user.email

    localStorage.setItem('skinna_token', data.access_token)
    localStorage.setItem('skinna_user_email', data.user.email)
  }

  function logout() {
    token.value = null
    userEmail.value = null
    localStorage.removeItem('skinna_token')
    localStorage.removeItem('skinna_user_email')
    localStorage.removeItem('skinna_fcm_registered')
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
