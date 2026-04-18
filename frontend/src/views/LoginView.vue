<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const toast = useToast()

const email = ref('')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!email.value || !password.value) {
    toast.warning('Ingresa email y contraseña')
    return
  }

  loading.value = true
  try {
    await authStore.login(email.value, password.value)
    // Siempre al Dashboard tras login — el redirect=? se ignora a
    // propósito: es el "home" natural del panel.
    router.push('/dashboard')
  } catch (e: unknown) {
    const err = e as { response?: { status?: number }; request?: unknown }
    if (!err.response && !err.request) {
      toast.error('Error de conexión. Verifica tu internet.')
    } else if (!err.response) {
      toast.error('No se pudo conectar con el servidor')
    } else if (err.response.status === 401) {
      toast.error('Email o contraseña incorrectos')
    } else if (err.response.status === 429) {
      toast.error('Demasiados intentos. Espera un momento.')
    } else {
      toast.error('Error del servidor. Intenta más tarde.')
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-paper text-ink flex items-center justify-center px-4">
    <div class="w-full max-w-sm">
      <!-- Brand -->
      <div class="flex items-center gap-2 mb-10 justify-center">
        <div class="w-7 h-7 rounded-md grid place-items-center" style="background: var(--ink);">
          <span class="text-[11px] font-bold tracking-tight" style="color: var(--paper);">ih</span>
        </div>
        <span class="text-[14px] font-semibold tracking-tight">Soporte IH</span>
      </div>

      <div class="surface rounded-xl p-8">
        <h1 class="h-display text-[26px] leading-tight mb-1">Iniciar sesión</h1>
        <p class="text-[12px] text-ink-muted mb-7">
          Panel de gestión multi-tienda
        </p>

        <form @submit.prevent="handleLogin" class="space-y-4">
          <div>
            <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1.5">
              Email
            </label>
            <input
              v-model="email"
              type="email"
              autocomplete="email"
              placeholder="admin@soporteih.com"
              class="w-full px-3 py-2.5 border hairline rounded-md bg-paper-alt text-[13px] text-ink focus:outline-none transition"
              :style="{ borderColor: 'var(--line)' }"
              @focus="($event.target as HTMLInputElement).style.borderColor = 'var(--accent)'"
              @blur="($event.target as HTMLInputElement).style.borderColor = 'var(--line)'"
            />
          </div>

          <div>
            <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1.5">
              Contraseña
            </label>
            <input
              v-model="password"
              type="password"
              autocomplete="current-password"
              placeholder="••••••••"
              class="w-full px-3 py-2.5 border hairline rounded-md bg-paper-alt text-[13px] text-ink focus:outline-none transition"
              @focus="($event.target as HTMLInputElement).style.borderColor = 'var(--accent)'"
              @blur="($event.target as HTMLInputElement).style.borderColor = 'var(--line)'"
            />
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full h-10 rounded-md text-[13px] font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center justify-center gap-2"
            style="background: var(--ink); color: var(--paper);"
          >
            <div v-if="loading" class="w-3.5 h-3.5 border-2 rounded-full animate-spin" style="border-color: var(--paper); border-top-color: transparent;"></div>
            {{ loading ? 'Ingresando…' : 'Ingresar' }}
          </button>
        </form>
      </div>

      <p class="text-[11px] text-ink-faint text-center mt-6">
        Soporte IH v2.0
      </p>
    </div>
  </div>
</template>
