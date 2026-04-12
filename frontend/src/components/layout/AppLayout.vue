<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../../stores/auth'
import { requestPermission, onMessageReceived } from '../../composables/useNotifications'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()

// Registrar notificaciones push al montar
onMounted(async () => {
  await requestPermission()
  await onMessageReceived()
})

const pageTitle = computed(() => (route.meta.title as string) || 'SKINNA')

const navItems = [
  { name: 'Dashboard', route: '/dashboard', icon: 'pi pi-chart-line' },
  { name: 'Envíos / Pedidos', route: '/pedidos', icon: 'pi pi-truck' },
  { name: 'Catálogo', route: '/catalogo', icon: 'pi pi-box' },
  { name: 'Clientes', route: '/clientes', icon: 'pi pi-users' },
]

// Sidebar móvil
const sidebarOpen = ref(false)

function isActive(path: string): boolean {
  return route.path === path
}

function navigateTo(path: string) {
  router.push(path)
  sidebarOpen.value = false
}

const userInitials = computed(() => {
  const email = authStore.userEmail || ''
  return email.charAt(0).toUpperCase()
})
</script>

<template>
  <div class="flex h-screen overflow-hidden">
    <!-- Backdrop móvil -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 bg-black/50 z-30 md:hidden"
      @click="sidebarOpen = false"
    ></div>

    <!-- Sidebar -->
    <aside
      class="fixed md:static inset-y-0 left-0 w-64 bg-navy text-white flex flex-col shrink-0 shadow-xl z-40 transition-transform duration-300 md:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'"
    >
      <!-- Logo -->
      <div class="p-6 text-center border-b border-lavanda-medio/20">
        <h1 class="text-3xl font-black tracking-tighter">✨ SKINNA</h1>
        <p class="text-xs mt-1 uppercase tracking-widest italic text-lavanda-medio">Panel de Gestión</p>
      </div>

      <!-- Navegación -->
      <nav class="flex-1 p-4 space-y-2">
        <a
          v-for="item in navItems"
          :key="item.route"
          href="#"
          @click.prevent="navigateTo(item.route)"
          class="flex items-center space-x-3 p-3 rounded-lg transition"
          :class="
            isActive(item.route)
              ? 'bg-mauve text-white font-medium shadow-md'
              : 'hover:bg-lavanda-medio/20 text-lavanda'
          "
        >
          <i :class="item.icon" class="w-5 text-center"></i>
          <span>{{ item.name }}</span>
        </a>
      </nav>

      <!-- Footer sidebar -->
      <div class="p-4 text-xs text-center border-t border-lavanda-medio/20 text-lavanda-medio">
        SKINNA v1.0
      </div>
    </aside>

    <!-- Área principal -->
    <main class="flex-1 flex flex-col h-screen overflow-hidden">
      <!-- Header -->
      <header class="bg-white shadow-sm border-b border-lavanda-medio p-4 flex justify-between items-center z-10 shrink-0">
        <div class="flex items-center gap-3">
          <!-- Hamburguesa móvil -->
          <button
            @click="sidebarOpen = true"
            class="md:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-lavanda transition"
          >
            <i class="pi pi-bars text-navy text-lg"></i>
          </button>
          <h2 class="text-xl font-bold text-navy">{{ pageTitle }}</h2>
        </div>

        <div class="flex items-center space-x-3">
          <button
            @click="navigateTo('/pedidos')"
            class="bg-mauve text-white px-5 py-2 rounded-lg font-bold hover:opacity-90 transition flex items-center gap-2 shadow-sm"
          >
            <i class="pi pi-plus"></i>
            <span class="hidden sm:inline">Nuevo Pedido</span>
          </button>

          <!-- Avatar / Logout -->
          <button
            @click="authStore.logout()"
            class="w-10 h-10 bg-lavanda rounded-full flex items-center justify-center border border-lavanda-medio hover:bg-lavanda-medio transition"
            title="Cerrar sesión"
          >
            <span class="font-bold text-navy text-sm">{{ userInitials }}</span>
          </button>
        </div>
      </header>

      <!-- Contenido -->
      <div class="flex-1 overflow-y-auto p-4 md:p-8 bg-lavanda">
        <router-view />
      </div>
    </main>
  </div>
</template>
