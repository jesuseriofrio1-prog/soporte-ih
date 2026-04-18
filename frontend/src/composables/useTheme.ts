import { ref, watch } from 'vue'

/**
 * Gestión del tema (light/dark) con persistencia en localStorage.
 * El tema inicial se aplica en index.html ANTES de cargar la app
 * para evitar flash. Aquí solo sincronizamos el estado reactivo.
 */

const STORAGE_KEY = 'sih_theme'

type Theme = 'light' | 'dark'

function currentFromDOM(): Theme {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

const theme = ref<Theme>(currentFromDOM())

watch(theme, (t) => {
  try {
    localStorage.setItem(STORAGE_KEY, t)
  } catch {
    // silencioso
  }
  document.documentElement.classList.toggle('dark', t === 'dark')
  document.documentElement.setAttribute('data-theme', t)
})

export function useTheme() {
  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
  }
  return { theme, toggle }
}
