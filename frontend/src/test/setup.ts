/**
 * Setup global para Vitest.
 * - Polyfill de localStorage (jsdom 29 no lo trae activo por defecto).
 * - Stub de `window.open` y `navigator.clipboard` (usados en composables).
 * - No configuramos Pinia aquí: cada test crea su propia instancia con
 *   `createPinia` según necesite.
 */
import { vi } from 'vitest'

// Polyfill mínimo de Storage para jsdom 29.
class MemoryStorage implements Storage {
  private store = new Map<string, string>()
  get length() { return this.store.size }
  clear() { this.store.clear() }
  getItem(key: string) { return this.store.get(key) ?? null }
  setItem(key: string, value: string) { this.store.set(key, String(value)) }
  removeItem(key: string) { this.store.delete(key) }
  key(i: number) { return Array.from(this.store.keys())[i] ?? null }
}

if (typeof window !== 'undefined') {
  if (typeof window.localStorage === 'undefined' ||
      typeof window.localStorage.setItem !== 'function') {
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: new MemoryStorage(),
    })
  }
  if (typeof window.sessionStorage === 'undefined' ||
      typeof window.sessionStorage.setItem !== 'function') {
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      value: new MemoryStorage(),
    })
  }

  // window.open se usa en useWhatsApp.abrirWhatsApp
  Object.defineProperty(window, 'open', {
    writable: true,
    value: vi.fn(),
  })

  // Clipboard API (algunas vistas usan navigator.clipboard.writeText)
  if (!('clipboard' in navigator)) {
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: { writeText: vi.fn(() => Promise.resolve()) },
    })
  }
}
