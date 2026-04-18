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
import { useAuthStore } from '../../stores/auth'
import { useTheme } from '../../composables/useTheme'
import solicitudesService from '../../services/solicitudesService'

const route = useRoute()
const router = useRouter()
const tiendaStore = useTiendaStore()
const dashStore = useDashboardStore()
const productosStore = useProductosStore()
const pedidosStore = usePedidosStore()
const clientesStore = useClientesStore()
const authStore = useAuthStore()
const { theme, toggle: toggleTheme } = useTheme()

const storage = ref<StorageInfo | null>(null)
const solicitudesAbiertas = ref(0)
const sidebarOpen = ref(false)
const tiendaMenuOpen = ref(false)
const now = ref(new Date())

// Reloj del topbar (actualizado cada segundo cuando la pestaña está visible).
let clockTimer: number | null = null
function startClock() {
  stopClock()
  clockTimer = window.setInterval(() => { now.value = new Date() }, 1000)
}
function stopClock() {
  if (clockTimer !== null) { clearInterval(clockTimer); clockTimer = null }
}

async function cerrarSesion() { await authStore.logout() }

async function cargarSolicitudesStats() {
  if (!tiendaStore.tiendaActivaId) return
  try {
    const s = await solicitudesService.stats(tiendaStore.tiendaActivaId)
    solicitudesAbiertas.value = s.total_abiertas
  } catch (err) {
    console.warn('[AppLayout] stats solicitudes:', err)
  }
}

async function loadStorage() {
  try {
    storage.value = await dashboardService.getStorageInfo()
  } catch (err) {
    console.warn('[AppLayout] storage:', err)
  }
}

function recargarDatosTienda() {
  dashStore.fetchAll()
  productosStore.fetchProductos(true)
  pedidosStore.fetchPedidos()
  clientesStore.fetchClientes()
  cargarSolicitudesStats()
  aplicarAccentTienda()
}

onMounted(async () => {
  await tiendaStore.fetchTiendas()
  recargarDatosTienda()
  loadStorage()
  startClock()
  if (tiendaStore.tiendaActivaId) {
    requestPermission(tiendaStore.tiendaActivaId).catch(() => {})
  }
  onMessageReceived().catch(() => {})
})

watch(() => tiendaStore.tiendaActivaId, (tiendaId) => {
  recargarDatosTienda()
  if (tiendaId) requestPermission(tiendaId).catch(() => {})
})

/**
 * Cada tienda puede tener su propio color. Lo mapeamos a --accent
 * para que el acento visual (dots, nav active bar, botones primarios)
 * refleje la identidad de la tienda activa.
 */
function aplicarAccentTienda() {
  const tienda = tiendaStore.tiendaActiva
  if (!tienda) return
  if (tienda.color_primario) {
    document.documentElement.style.setProperty('--accent', tienda.color_primario)
  }
}

function seleccionarTienda(id: string) {
  tiendaStore.setTiendaActiva(id)
  tiendaMenuOpen.value = false
}

const pageTitle = computed(() => (route.meta.title as string) || 'Dashboard')

const navItems = computed(() => [
  { name: 'Dashboard',    route: '/dashboard',    badge: 0, section: 'main' },
  {
    name: 'Pedidos',
    route: '/pedidos',
    badge: (dashStore.stats?.novedades || 0) + (dashStore.stats?.riesgo_devolucion || 0),
    section: 'main',
  },
  { name: 'Catálogo',     route: '/catalogo',     badge: 0, section: 'main' },
  { name: 'Clientes',     route: '/clientes',     badge: 0, section: 'main' },
  { name: 'Solicitudes',  route: '/solicitudes',  badge: solicitudesAbiertas.value, section: 'main' },
  { name: 'Upsell',       route: '/upsell',       badge: 0, section: 'main' },
  { name: 'Economics',    route: '/economics',    badge: 0, section: 'main' },
  { name: 'Plantillas',   route: '/plantillas',   badge: 0, section: 'admin' },
  { name: 'Tiendas',      route: '/tiendas',      badge: 0, section: 'admin' },
  { name: 'Integraciones',route: '/integraciones',badge: 0, section: 'admin' },
])

const navMain = computed(() => navItems.value.filter((n) => n.section === 'main'))
const navAdmin = computed(() => navItems.value.filter((n) => n.section === 'admin'))

function isActive(path: string): boolean { return route.path === path }
function navigateTo(path: string) {
  router.push(path)
  sidebarOpen.value = false
  tiendaMenuOpen.value = false
}

const usuarioInicial = computed(() => {
  const email = authStore.userEmail || ''
  return email.charAt(0).toUpperCase() || 'U'
})

const relojFormateado = computed(() =>
  now.value.toLocaleTimeString('es-EC', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
)

const storagePorcentaje = computed(() => storage.value?.usage_percent ?? 0)
</script>

<template>
  <div class="flex min-h-screen bg-paper text-ink">
    <!-- Backdrop móvil -->
    <div
      v-if="sidebarOpen"
      class="fixed inset-0 z-30 md:hidden"
      style="background: color-mix(in srgb, var(--ink) 30%, transparent);"
      @click="sidebarOpen = false"
    ></div>

    <!-- ═══════════════ SIDEBAR ═══════════════ -->
    <aside
      class="fixed md:static inset-y-0 left-0 w-[220px] shrink-0 flex flex-col surface border-t-0 border-b-0 border-l-0 z-40 transition-transform duration-300 md:translate-x-0"
      :class="sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'"
    >
      <!-- Brand + tienda switcher -->
      <div class="px-5 pt-6 pb-5 border-b hairline relative">
        <div class="flex items-center gap-2 mb-6">
          <div class="w-6 h-6 rounded-md grid place-items-center" style="background: var(--ink);">
            <span class="text-[10px] font-bold tracking-tight" style="color: var(--paper);">ih</span>
          </div>
          <span class="text-[13px] font-semibold tracking-tight">Soporte IH</span>
        </div>

        <button
          @click="tiendaMenuOpen = !tiendaMenuOpen"
          :aria-expanded="tiendaMenuOpen"
          aria-label="Cambiar tienda activa"
          class="w-full group flex items-center justify-between px-2 py-1.5 -mx-2 rounded-md hover:bg-paper-alt transition"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="accent-dot shrink-0"></span>
            <span class="text-[13px] font-medium truncate">
              {{ tiendaStore.tiendaActiva?.nombre || 'Seleccionar tienda' }}
            </span>
          </div>
          <svg class="w-3.5 h-3.5 text-ink-faint shrink-0" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 6l4 4 4-4M4 10l4-4 4 4" stroke-linecap="round"/>
          </svg>
        </button>

        <!-- Popover de selección de tienda -->
        <div
          v-if="tiendaMenuOpen"
          class="absolute left-4 right-4 top-full mt-1 surface rounded-lg p-1 z-20 shadow-md"
        >
          <button
            v-for="t in tiendaStore.tiendas"
            :key="t.id"
            @click="seleccionarTienda(t.id)"
            class="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-paper-alt transition text-left"
          >
            <span
              class="w-2 h-2 rounded-full shrink-0"
              :style="{ background: t.id === tiendaStore.tiendaActivaId ? 'var(--accent)' : 'var(--ink-faint)' }"
            ></span>
            <span class="text-[13px] truncate">{{ t.nombre }}</span>
          </button>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto thin-scroll">
        <a
          v-for="item in navMain"
          :key="item.route"
          href="#"
          @click.prevent="navigateTo(item.route)"
          class="nav-item flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] cursor-pointer"
          :class="{ active: isActive(item.route) }"
        >
          <!-- Iconos SVG inline, estilo trazo fino -->
          <svg v-if="item.name === 'Dashboard'" class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="5" height="5" rx="1"/><rect x="9" y="2" width="5" height="5" rx="1"/><rect x="2" y="9" width="5" height="5" rx="1"/><rect x="9" y="9" width="5" height="5" rx="1"/></svg>
          <svg v-else-if="item.name === 'Pedidos'" class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 5h12M2 8h12M2 11h8" stroke-linecap="round"/></svg>
          <svg v-else-if="item.name === 'Catálogo'" class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="5" height="5" rx="0.5"/><rect x="9" y="2" width="5" height="5" rx="0.5"/><rect x="2" y="9" width="5" height="5" rx="0.5"/><rect x="9" y="9" width="5" height="5" rx="0.5"/></svg>
          <svg v-else-if="item.name === 'Clientes'" class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="5.5" r="2.5"/><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" stroke-linecap="round"/></svg>
          <svg v-else-if="item.name === 'Solicitudes'" class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 3h10v10H3z"/><path d="M6 7h4M6 10h4" stroke-linecap="round"/></svg>
          <svg v-else-if="item.name === 'Upsell'" class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 12l4-4 3 3 4-5" stroke-linecap="round" stroke-linejoin="round"/><path d="M11 6h3v3" stroke-linecap="round"/></svg>
          <svg v-else-if="item.name === 'Economics'" class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 13h12M4 13V9M7 13V7M10 13V5M13 13V3" stroke-linecap="round"/></svg>
          <span class="flex-1">{{ item.name }}</span>
          <span
            v-if="item.badge > 0"
            class="text-[11px] font-semibold pill-amber px-1.5 py-0.5 rounded"
          >
            {{ item.badge > 99 ? '99+' : item.badge }}
          </span>
        </a>

        <div class="pt-5 pb-2 px-3">
          <span class="text-[10px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Administración</span>
        </div>

        <a
          v-for="item in navAdmin"
          :key="item.route"
          href="#"
          @click.prevent="navigateTo(item.route)"
          class="nav-item flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] cursor-pointer"
          :class="{ active: isActive(item.route) }"
        >
          <svg v-if="item.name === 'Tiendas'" class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 6l2-3h8l2 3v7H2V6z"/><path d="M6 13V9h4v4" stroke-linecap="round"/></svg>
          <svg v-else-if="item.name === 'Plantillas'" class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 3h8v10H4z"/><path d="M6 6h4M6 9h4M6 11h2" stroke-linecap="round"/></svg>
          <svg v-else-if="item.name === 'Integraciones'" class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="2"/><path d="M8 2v3M8 11v3M2 8h3M11 8h3" stroke-linecap="round"/></svg>
          <span>{{ item.name }}</span>
        </a>
      </nav>

      <!-- Bottom: storage + user -->
      <div class="px-4 py-3 border-t hairline space-y-3">
        <div v-if="storage">
          <div class="flex justify-between items-center mb-1.5">
            <span class="text-[10px] font-medium text-ink-muted uppercase tracking-wider">Storage</span>
            <span class="text-[10px] tabular font-mono text-ink-faint">
              {{ storage.size_mb }} / {{ storage.limit_mb }} MB
            </span>
          </div>
          <div class="h-1 bg-paper-alt rounded-full overflow-hidden">
            <div
              v-if="storagePorcentaje > 0"
              class="h-full transition-all"
              :class="storagePorcentaje >= 90 ? 'dot-rose' : storagePorcentaje >= 70 ? 'dot-amber' : ''"
              :style="{
                width: storagePorcentaje + '%',
                background: storagePorcentaje >= 70 ? undefined : 'var(--ink)',
              }"
            ></div>
          </div>
        </div>

        <button @click="cerrarSesion" class="flex items-center gap-2 w-full text-left group">
          <div
            class="w-6 h-6 rounded-full grid place-items-center shrink-0"
            style="background: linear-gradient(135deg, var(--ink-soft), var(--ink));"
          >
            <span class="text-[10px] text-white font-semibold">{{ usuarioInicial }}</span>
          </div>
          <div class="min-w-0 flex-1">
            <div class="text-[12px] font-medium truncate">{{ authStore.userEmail || '—' }}</div>
            <div class="text-[10px] text-ink-faint group-hover:text-ink-muted transition">
              Cerrar sesión
            </div>
          </div>
        </button>
      </div>
    </aside>

    <!-- ═══════════════ MAIN ═══════════════ -->
    <main class="flex-1 min-w-0 border-l hairline flex flex-col h-screen overflow-hidden">
      <!-- Topbar -->
      <header
        class="h-14 border-b hairline flex items-center px-6 gap-4 backdrop-blur-sm shrink-0 z-20"
        style="background: color-mix(in srgb, var(--paper) 80%, transparent);"
      >
        <!-- Menú móvil -->
        <button
          class="md:hidden w-8 h-8 rounded-md hover:bg-paper-alt grid place-items-center"
          aria-label="Abrir menú"
          @click="sidebarOpen = true"
        >
          <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M2 4h12M2 8h12M2 12h12" stroke-linecap="round"/>
          </svg>
        </button>

        <!-- Breadcrumb -->
        <div class="flex items-center gap-2 text-[13px] min-w-0">
          <span class="accent-dot shrink-0"></span>
          <span class="text-ink-muted hidden sm:inline">
            {{ tiendaStore.tiendaActiva?.nombre || '—' }}
          </span>
          <span class="text-ink-faint hidden sm:inline">/</span>
          <span class="font-semibold truncate">{{ pageTitle }}</span>
        </div>

        <!-- Reloj con dot vivo -->
        <div class="ml-auto hidden md:flex items-center gap-1.5 text-[11px] text-ink-faint">
          <span class="w-1.5 h-1.5 rounded-full dot-emerald animate-pulse"></span>
          <span class="tabular font-mono">{{ relojFormateado }}</span>
        </div>

        <!-- Theme toggle -->
        <button
          @click="toggleTheme"
          class="w-8 h-8 rounded-md hover:bg-paper-alt grid place-items-center"
          :aria-label="theme === 'light' ? 'Activar tema oscuro' : 'Activar tema claro'"
          :title="theme === 'light' ? 'Modo oscuro' : 'Modo claro'"
        >
          <svg v-if="theme === 'light'" class="w-4 h-4 text-ink-soft" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M13.5 9a5.5 5.5 0 01-6.5-6.5 5.5 5.5 0 106.5 6.5z"/>
          </svg>
          <svg v-else class="w-4 h-4 text-ink-soft" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="8" cy="8" r="3"/>
            <path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.4 1.4M11.1 11.1l1.4 1.4M3.5 12.5l1.4-1.4M11.1 4.9l1.4-1.4" stroke-linecap="round"/>
          </svg>
        </button>
      </header>

      <!-- Contenido -->
      <div class="flex-1 overflow-y-auto thin-scroll">
        <router-view v-slot="{ Component }">
          <transition name="page" mode="out-in">
            <component :is="Component" :key="route.fullPath" class="page-fade" />
          </transition>
        </router-view>
      </div>
    </main>
  </div>
</template>

<style scoped>
.page-enter-active,
.page-leave-active {
  transition: opacity 0.18s ease-out;
}
.page-enter-from,
.page-leave-to {
  opacity: 0;
}
</style>
