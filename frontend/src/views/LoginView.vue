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
    toast.success('Bienvenido a SKINNA')
    router.push('/dashboard')
  } catch {
    toast.error('Credenciales inválidas')
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
        <h1 class="text-4xl font-black text-navy tracking-tighter">✨ SKINNA</h1>
        <p class="text-xs uppercase tracking-widest text-lavanda-medio mt-1">Panel de Gestión</p>
      </div>

      <!-- Formulario -->
      <form @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label class="block text-sm font-bold text-navy mb-1">Email</label>
          <input
            v-model="email"
            type="email"
            placeholder="admin@skinna.ec"
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
