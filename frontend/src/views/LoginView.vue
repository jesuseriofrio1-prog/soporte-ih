<script setup lang="ts">
import { ref } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useToast } from 'vue-toastification'
import { useAuthStore } from '../stores/auth'

const authStore = useAuthStore()
const router = useRouter()
const route = useRoute()
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
    toast.success('Bienvenido a Soporte IH')
    const redirect = (route.query.redirect as string) || '/dashboard'
    // Evitar loop: si redirect es /login o apunta a algo raro, volvemos al dashboard.
    const safe = redirect.startsWith('/') && !redirect.startsWith('/login') ? redirect : '/dashboard'
    router.push(safe)
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
  <div class="min-h-screen bg-navy flex items-center justify-center px-4">
    <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm">
      <!-- Logo -->
      <div class="text-center mb-8">
        <h1 class="text-4xl font-black text-navy tracking-tighter">✨ Soporte IH</h1>
        <p class="text-xs uppercase tracking-widest text-lavanda-medio mt-1">Panel de Gestión</p>
      </div>

      <!-- Formulario -->
      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm font-bold text-navy mb-1">Email</label>
          <input
            v-model="email"
            type="email"
            placeholder="admin@soporteih.com"
            class="w-full px-4 py-3 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy placeholder-lavanda-medio focus:outline-none focus:border-mauve transition"
          />
        </div>

        <div>
          <label class="block text-sm font-bold text-navy mb-1">Contraseña</label>
          <input
            v-model="password"
            type="password"
            placeholder="••••••••"
            class="w-full px-4 py-3 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy placeholder-lavanda-medio focus:outline-none focus:border-mauve transition"
          />
        </div>

        <button
          type="submit"
          :disabled="loading"
          class="w-full bg-mauve text-white font-bold py-3 rounded-lg hover:opacity-90 transition disabled:opacity-50 shadow-md"
        >
          {{ loading ? 'Ingresando...' : 'Ingresar' }}
        </button>
      </form>
    </div>
  </div>
</template>
