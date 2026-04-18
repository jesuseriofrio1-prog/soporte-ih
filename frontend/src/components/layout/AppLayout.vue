<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { requestPermission, onMessageReceived } from '../../composables/useNotifications'
import dashboardService, { type StorageInfo } from '../../services/dashboardService'
import { useTiendaStore } from '../../stores/tienda'
import { useDashboardStore } from '../../stores/dashboard'
import { useProductosStore } from '../../stores/productos'
import { usePedidosStore } from '../../stores/pedidos'
import { useClientesStore } from '../../stores/clientes'

const route = useRoute()
const router = useRouter()
const tiendaStore = useTiendaStore()
const dashStore = useDashboardStore()
const productosStore = useProductosStore()
const pedidosStore = usePedidosStore()
const clientesStore = useClientesStore()

// Almacenamiento
const storage = ref<StorageInfo | null>(null)

async function loadStorage() {
  try {
    storage.value = await dashboardService.getStorageInfo()
  } catch {
    // Silencioso
  }
}

function recargarDatosTienda() {
  dashStore.fetchAll()
  productosStore.fetchProductos(true)
  pedidosStore.fetchPedidos()
  clientesStore.fetchClientes()
  aplicarColoresTienda()
}

onMounted(async () => {
  await tiendaStore.fetchTiendas()
  // Cargar datos iniciales. El watch de abajo sólo se dispara cuando cambia
  // tiendaActivaId, pero si la tienda ya estaba cacheada en localStorage el
  // valor no cambia tras fetchTiendas y el dashboard quedaba en blanco.
  recargarDatosTienda()
  loadStorage()
  requestPermission().catch(() => {})
  onMessageReceived().catch(() => {})
})

// Cuando cambia la tienda activa manualmente, recargar datos y colores
watch(() => tiendaStore.tiendaActivaId, () => {
  recargarDatosTienda()
})

function aplicarColoresTienda() {
  const tienda = tiendaStore.tiendaActiva
  if (!tienda) return
  document.documentElement.style.setProperty('--color-navy', tienda.color_primario || '#030363')
  document.documentElement.style.setProperty('--color-mauve', tienda.color_secundario || '#C49BC2')
  document.documentElement.style.setProperty('--color-lavanda', tienda.color_fondo || '#E6E6FB')
  document.documentElement.style.setProperty('--color-lavanda-medio', tienda.color_borde || '#C8C8E9')
}

function cambiarTienda(event: Event) {
  const id = (event.target as HTMLSelectElement).value
  tiendaStore.setTiendaActiva(id)
}

const pageTitle = computed(() => (route.meta.title as string) || 'Soporte IH')

const navItems = computed(() => [
  { name: 'Dashboard', route: '/dashboard', icon: 'pi pi-chart-line', badge: 0 },
  {
    // El badge combina novedades + riesgo de devolución (todo lo que
    // aparece en el chip "Novedades" dentro de la lista de pedidos)
    name: 'Envíos / Pedidos',
    route: '/pedidos',
    icon: 'pi pi-truck',
    badge: (dashStore.stats?.novedades || 0) + (dashStore.stats?.riesgo_devolucion || 0),
  },
  { name: 'Catálogo', route: '/catalogo', icon: 'pi pi-box', badge: 0 },
  { name: 'Clientes', route: '/clientes', icon: 'pi pi-users', badge: 0 },
  { name: 'Integraciones', route: '/integraciones', icon: 'pi pi-sync', badge: 0 },
])

const sidebarOpen = ref(false)

function isActive(path: string): boolean {
  return route.path === path
}

function navigateTo(path: string) {
  router.push(path)
  sidebarOpen.value = false
}

const storageBarColor = computed(() => {
  if (!storage.value) return 'bg-mauve'
  if (storage.value.usage_percent >= 90) return 'bg-alerta'
  if (storage.value.usage_percent >= 70) return 'bg-yellow-500'
  return 'bg-mauve'
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
      class="fixed md:static inset-y-0 left-0 w-64 text-white flex flex-col shrink-0 shadow-xl z-40 transition-transform duration-300 md:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'"
      :style="{ backgroundColor: tiendaStore.tiendaActiva?.color_primario || '#030363' }"
    >
      <!-- Logo -->
      <div class="p-5 text-center border-b border-lavanda-medio/20">
        <h1 class="text-2xl font-black tracking-tighter">SOPORTE IH</h1>
        <p class="text-[10px] mt-1 uppercase tracking-widest text-lavanda-medio">Centro de gestión</p>
      </div>

      <!-- Selector de tienda -->
      <div class="px-4 py-3 border-b border-lavanda-medio/20">
        <p class="text-[10px] uppercase tracking-wider text-lavanda-medio/60 mb-1.5">Tienda activa</p>
        <select
          :value="tiendaStore.tiendaActivaId"
          @change="cambiarTienda"
          class="w-full px-3 py-2 bg-white/10 border border-lavanda-medio/30 rounded-lg text-white text-sm font-medium focus:outline-none focus:border-mauve transition appearance-none cursor-pointer"
        >
          <option
            v-for="t in tiendaStore.tiendas"
            :key="t.id"
            :value="t.id"
            class="bg-navy text-white"
          >
            {{ t.nombre }}
          </option>
        </select>
      </div>

      <!-- Navegación -->
      <nav class="flex-1 p-4 space-y-1.5">
        <a
          v-for="item in navItems"
          :key="item.route"
          href="#"
          @click.prevent="navigateTo(item.route)"
          class="flex items-center space-x-3 p-3 rounded-lg transition"
          :class="isActive(item.route) ? 'text-white font-medium shadow-md' : 'hover:bg-white/10 text-white/70'"
          :style="isActive(item.route) ? { backgroundColor: tiendaStore.tiendaActiva?.color_secundario || '#C49BC2' } : {}"
        >
          <i :class="item.icon" class="w-5 text-center"></i>
          <span class="flex-1">{{ item.name }}</span>
          <span
            v-if="item.badge > 0"
            class="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-bold rounded-full bg-red-500 text-white"
            :aria-label="`${item.badge} pendientes`"
          >
            {{ item.badge > 99 ? '99+' : item.badge }}
          </span>
        </a>

        <!-- Separador -->
        <div class="border-t border-white/10 my-2"></div>

        <!-- Administrar tiendas -->
        <a
          href="#"
          @click.prevent="navigateTo('/tiendas')"
          class="flex items-center space-x-3 p-3 rounded-lg transition"
          :class="isActive('/tiendas') ? 'text-white font-medium shadow-md' : 'hover:bg-white/10 text-white/70'"
          :style="isActive('/tiendas') ? { backgroundColor: tiendaStore.tiendaActiva?.color_secundario || '#C49BC2' } : {}"
        >
          <i class="pi pi-cog w-5 text-center"></i>
          <span>Administrar Tiendas</span>
        </a>
      </nav>

      <!-- Footer sidebar con almacenamiento -->
      <div class="p-4 border-t border-lavanda-medio/20">
        <div v-if="storage" class="mb-3">
          <div class="flex justify-between text-[10px] text-lavanda-medio mb-1">
            <span><i class="pi pi-database" aria-hidden="true"></i> Almacenamiento</span>
            <span>{{ storage.size_mb }} / {{ storage.limit_mb }} MB</span>
          </div>
          <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="storageBarColor"
              :style="{ width: Math.max(storage.usage_percent, 0.5) + '%' }"
            ></div>
          </div>
          <div class="flex justify-between text-[10px] text-lavanda-medio/50 mt-1.5">
            <span>{{ storage.records.total }} registros</span>
            <span>{{ storage.usage_percent }}%</span>
          </div>
        </div>
        <p class="text-xs text-center text-lavanda-medio">Soporte IH v2.0</p>
      </div>
    </aside>

    <!-- Área principal -->
    <main class="flex-1 flex flex-col h-screen overflow-hidden">
      <!-- Header -->
      <header class="bg-white shadow-sm border-b border-lavanda-medio p-4 flex justify-between items-center z-10 shrink-0">
        <div class="flex items-center gap-3">
          <button
            @click="sidebarOpen = true"
            class="md:hidden w-10 h-10 flex items-center justify-center rounded-lg hover:bg-lavanda transition"
            aria-label="Abrir menú"
          >
            <i class="pi pi-bars text-navy text-lg" aria-hidden="true"></i>
          </button>
          <h2 class="text-xl font-bold text-navy">{{ pageTitle }}</h2>
          <span v-if="tiendaStore.tiendaActiva" class="hidden md:inline text-sm text-navy/40 font-medium">
            — {{ tiendaStore.tiendaActiva.nombre }}
          </span>
        </div>

      </header>

      <!-- Contenido -->
      <div class="flex-1 overflow-y-auto p-4 md:p-8 bg-lavanda">
        <router-view />
      </div>
    </main>
  </div>
</template>
