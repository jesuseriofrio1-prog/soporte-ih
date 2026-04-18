import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Mock del router antes de importar el store (el store hace router.push).
vi.mock('../router', () => ({
  default: { push: vi.fn() },
}))

// Mock de axios: api.get, api.post son lo único que usa el store.
vi.mock('../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

import api from '../services/api'
import router from '../router'
import { useAuthStore } from './auth'

const mockedApi = vi.mocked(api)
const mockedRouter = vi.mocked(router)

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('limpieza legacy', () => {
    it('re-importar el módulo borra tokens viejos de localStorage', async () => {
      localStorage.setItem('soporte_ih_token', 'legacy-token')
      localStorage.setItem('skinna_token', 'legacy-skinna-token')
      // Forzar re-ejecución de la IIFE importando el módulo de nuevo.
      vi.resetModules()
      await import('./auth')
      expect(localStorage.getItem('soporte_ih_token')).toBeNull()
      expect(localStorage.getItem('skinna_token')).toBeNull()
    })
  })

  describe('login', () => {
    it('setea userId y userEmail al recibir respuesta exitosa', async () => {
      mockedApi.post.mockResolvedValueOnce({
        data: { user: { id: 'user-123', email: 'admin@soporteih.com' } },
      })
      const auth = useAuthStore()
      await auth.login('admin@soporteih.com', 'pw')

      expect(auth.userId).toBe('user-123')
      expect(auth.userEmail).toBe('admin@soporteih.com')
      expect(auth.isAuthenticated).toBe(true)
      expect(auth.checked).toBe(true)
      expect(mockedApi.post).toHaveBeenCalledWith('/auth/login', {
        email: 'admin@soporteih.com',
        password: 'pw',
      })
    })

    it('no escribe el token en localStorage (es el cambio de diseño de PR1)', async () => {
      mockedApi.post.mockResolvedValueOnce({
        data: { user: { id: 'user-123', email: 'x@y.com' } },
      })

      const setSpy = vi.spyOn(Storage.prototype, 'setItem')
      const auth = useAuthStore()
      await auth.login('x@y.com', 'pw')

      // El store nunca debe escribir nada con "token" o "session" en su nombre.
      const escrituras = setSpy.mock.calls.map((c) => c[0])
      expect(escrituras.some((k) => /token|session/i.test(k))).toBe(false)
    })

    it('propaga errores del API', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('401'))
      const auth = useAuthStore()
      await expect(auth.login('x', 'y')).rejects.toThrow('401')
      expect(auth.isAuthenticated).toBe(false)
    })
  })

  describe('checkToken', () => {
    it('devuelve true y carga user cuando /auth/me responde', async () => {
      mockedApi.get.mockResolvedValueOnce({ data: { id: 'u1', email: 'a@b.com' } })
      const auth = useAuthStore()
      const ok = await auth.checkToken()
      expect(ok).toBe(true)
      expect(auth.userId).toBe('u1')
      expect(auth.checked).toBe(true)
    })

    it('devuelve false y deja user en null cuando /auth/me falla', async () => {
      mockedApi.get.mockRejectedValueOnce({ response: { status: 401 } })
      const auth = useAuthStore()
      const ok = await auth.checkToken()
      expect(ok).toBe(false)
      expect(auth.userId).toBeNull()
      expect(auth.isAuthenticated).toBe(false)
      expect(auth.checked).toBe(true)
    })
  })

  describe('logout', () => {
    it('llama a /auth/logout, limpia estado y redirige a /login', async () => {
      mockedApi.post.mockResolvedValueOnce({ data: { ok: true } })
      const auth = useAuthStore()
      auth.userId = 'u1'
      auth.userEmail = 'a@b.com'

      await auth.logout()

      expect(mockedApi.post).toHaveBeenCalledWith('/auth/logout')
      expect(auth.userId).toBeNull()
      expect(auth.userEmail).toBeNull()
      expect(mockedRouter.push).toHaveBeenCalledWith('/login')
    })

    it('limpia estado incluso si /auth/logout falla', async () => {
      mockedApi.post.mockRejectedValueOnce(new Error('network'))
      const auth = useAuthStore()
      auth.userId = 'u1'
      auth.userEmail = 'a@b.com'

      await auth.logout()

      expect(auth.userId).toBeNull()
      expect(auth.userEmail).toBeNull()
      expect(mockedRouter.push).toHaveBeenCalledWith('/login')
    })
  })
})
