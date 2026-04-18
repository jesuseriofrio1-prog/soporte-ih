<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Line, Doughnut } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'
import { useDashboardStore } from '../stores/dashboard'
import { useProductosStore } from '../stores/productos'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, ArcElement, Title, Tooltip, Legend, Filler)

const router = useRouter()
const dashStore = useDashboardStore()
const productosStore = useProductosStore()

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

function formatMoney(val: number | null | undefined): string {
  return (val || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function formatTimestamp(iso: string | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// ─────────────────────────────────────────────
// Producto con menor stock
// ─────────────────────────────────────────────

const productoMenorStock = computed(() => {
  if (productosStore.productos.length === 0) return null
  return [...productosStore.productos].sort((a, b) => a.stock - b.stock)[0]
})

const transitoTexto = computed(() => {
  const n = dashStore.stats?.en_transito || 0
  if (n === 0) return 'Sin envíos activos'
  return `${n} envío${n > 1 ? 's' : ''} en curso`
})

// ─────────────────────────────────────────────
// Chart 1: Facturación últimos 7 días
// ─────────────────────────────────────────────

const ventasChartData = computed(() => ({
  labels: dashStore.ventasSemana.map((v) => v.dia),
  datasets: [
    {
      label: 'Ventas ($)',
      data: dashStore.ventasSemana.map((v) => Number(v.total)),
      borderColor: '#C49BC2',
      backgroundColor: 'rgba(196, 155, 194, 0.15)',
      pointBackgroundColor: '#030363',
      pointBorderColor: '#030363',
      pointRadius: 5,
      pointHoverRadius: 7,
      tension: 0.3,
      fill: true,
    },
  ],
}))

const ventasChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: '#030363',
      titleColor: '#FFFFFF',
      bodyColor: '#FFFFFF',
      padding: 10,
      cornerRadius: 8,
      callbacks: {
        label: (ctx: { parsed: { y: number | null } }) =>
          `$${(ctx.parsed.y ?? 0).toFixed(2)}`,
      },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#030363', font: { weight: 'bold' as const } },
    },
    y: {
      grid: { color: '#E6E6FB' },
      ticks: {
        color: '#030363',
        callback: (value: string | number) => `$${value}`,
      },
    },
  },
}

// ─────────────────────────────────────────────
// Chart 2: Pedidos últimos 7 días (3 series)
// ─────────────────────────────────────────────

const pedidosChartData = computed(() => ({
  labels: dashStore.pedidosSemana.map((p) => p.dia),
  datasets: [
    {
      label: 'Entrantes',
      data: dashStore.pedidosSemana.map((p) => Number(p.entrantes)),
      borderColor: '#3B82F6',
      backgroundColor: 'rgba(59, 130, 246, 0.1)',
      pointBackgroundColor: '#3B82F6',
      pointRadius: 4,
      tension: 0.3,
      fill: false,
    },
    {
      label: 'Confirmados',
      data: dashStore.pedidosSemana.map((p) => Number(p.confirmados)),
      borderColor: '#C49BC2',
      backgroundColor: 'rgba(196, 155, 194, 0.1)',
      pointBackgroundColor: '#C49BC2',
      pointRadius: 4,
      tension: 0.3,
      fill: false,
    },
    {
      label: 'Entregados',
      data: dashStore.pedidosSemana.map((p) => Number(p.entregados)),
      borderColor: '#22C55E',
      backgroundColor: 'rgba(34, 197, 94, 0.1)',
      pointBackgroundColor: '#22C55E',
      pointRadius: 4,
      tension: 0.3,
      fill: false,
    },
  ],
}))

const pedidosChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'bottom' as const,
      labels: {
        color: '#030363',
        font: { size: 11, weight: 'bold' as const },
        padding: 12,
        usePointStyle: true,
        pointStyleWidth: 10,
      },
    },
    tooltip: {
      backgroundColor: '#030363',
      titleColor: '#FFFFFF',
      bodyColor: '#FFFFFF',
      padding: 10,
      cornerRadius: 8,
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { color: '#030363', font: { weight: 'bold' as const } },
    },
    y: {
      grid: { color: '#E6E6FB' },
      ticks: {
        color: '#030363',
        stepSize: 1,
        precision: 0,
      },
      beginAtZero: true,
    },
  },
}

// ─────────────────────────────────────────────
// Chart canales (doughnut)
// ─────────────────────────────────────────────

const CANAL_COLORES = ['#C49BC2', '#030363', '#25D366', '#C8C8E9', '#EF4444', '#3B82F6', '#F59E0B']

const canalesChartData = computed(() => ({
  labels: dashStore.canalesStats.map((c) => c.canal),
  datasets: [
    {
      data: dashStore.canalesStats.map((c) => Number(c.total)),
      backgroundColor: CANAL_COLORES.slice(0, dashStore.canalesStats.length),
      borderWidth: 2,
      borderColor: '#FFFFFF',
    },
  ],
}))

const canalesChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '65%',
  plugins: {
    legend: {
      position: 'bottom' as const,
      labels: {
        color: '#030363',
        font: { size: 11, weight: 'bold' as const },
        padding: 12,
        usePointStyle: true,
        pointStyleWidth: 10,
      },
    },
    tooltip: {
      backgroundColor: '#030363',
      titleColor: '#FFFFFF',
      bodyColor: '#FFFFFF',
      padding: 10,
      cornerRadius: 8,
    },
  },
}

// ─────────────────────────────────────────────
// Lifecycle
// ─────────────────────────────────────────────

// Auto-refresh: cada 60 segundos revalida los datos del dashboard en
// background. El usuario puede pausarlo con el toggle del header.
const autoRefreshMs = 60_000
const autoRefreshOn = ref(true)
let pollTimer: ReturnType<typeof setInterval> | null = null

function refrescar() {
  dashStore.fetchAll()
  productosStore.fetchProductos(true)
}

function toggleAutoRefresh() {
  autoRefreshOn.value = !autoRefreshOn.value
  if (autoRefreshOn.value) startPolling()
  else stopPolling()
}

function startPolling() {
  stopPolling()
  pollTimer = setInterval(() => {
    if (document.visibilityState === 'visible') refrescar()
  }, autoRefreshMs)
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
  }
}

onMounted(() => {
  dashStore.fetchAll()
  productosStore.fetchProductos(true)
  startPolling()
})

onBeforeUnmount(() => {
  stopPolling()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Timestamp + refresh + auto-refresh toggle -->
    <div class="flex items-center gap-3 text-xs text-navy/60 flex-wrap">
      <span>
        Actualizado:
        <b v-if="dashStore.stats">{{ formatTimestamp(dashStore.stats.actualizado_en) }}</b>
        <span v-else>—</span>
      </span>

      <button
        @click="refrescar"
        :disabled="dashStore.loading"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-lavanda-medio hover:bg-lavanda/50 transition text-navy/80 disabled:opacity-50"
        aria-label="Refrescar dashboard"
      >
        <i class="pi pi-refresh" :class="{ 'pi-spin': dashStore.loading }" aria-hidden="true"></i>
        <span>Refrescar</span>
      </button>

      <button
        @click="toggleAutoRefresh"
        class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition"
        :class="autoRefreshOn
          ? 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
          : 'border-lavanda-medio text-navy/60 hover:bg-lavanda/50'"
        :aria-label="autoRefreshOn ? 'Pausar auto-refresh' : 'Activar auto-refresh'"
        :title="autoRefreshOn ? 'Auto-refresh activo cada 60s — click para pausar' : 'Auto-refresh pausado — click para reactivar'"
      >
        <span class="inline-block w-1.5 h-1.5 rounded-full" :class="autoRefreshOn ? 'bg-green-500 animate-pulse' : 'bg-navy/30'"></span>
        <span>Auto {{ autoRefreshOn ? 'ON' : 'OFF' }}</span>
      </button>
    </div>

    <!-- Loading state (solo si no hay stats cacheado — refresh manual deja KPIs visibles) -->
    <div v-if="dashStore.loading && !dashStore.stats" class="text-center py-20">
      <i class="pi pi-spin pi-spinner text-4xl text-mauve" aria-hidden="true"></i>
      <p class="text-navy/60 mt-2">Cargando dashboard...</p>
    </div>

    <template v-else-if="dashStore.stats">
      <!-- ================== Stat Cards principales ================== -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <!-- Ventas Mes -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-lavanda-medio relative overflow-hidden group">
          <div class="absolute right-0 top-0 h-full w-2 bg-mauve"></div>
          <div class="flex items-start justify-between mb-1">
            <p class="text-sm font-bold uppercase text-navy/60">Ventas Mes</p>
            <i
              class="pi pi-info-circle text-navy/40 text-xs cursor-help"
              title="Suma de montos de TODOS los pedidos creados en el mes actual (sin filtrar por estado)."
              aria-hidden="true"
            ></i>
          </div>
          <p class="text-3xl font-black text-navy">${{ formatMoney(dashStore.stats.ventas_mes) }}</p>
        </div>

        <!-- Pedidos Mes -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-lavanda-medio">
          <div class="flex items-start justify-between mb-1">
            <p class="text-sm font-bold uppercase text-navy/60">Pedidos Mes</p>
            <i
              class="pi pi-info-circle text-navy/40 text-xs cursor-help"
              title="Número de pedidos creados este mes, en cualquier estado."
              aria-hidden="true"
            ></i>
          </div>
          <p class="text-3xl font-black text-navy">{{ dashStore.stats.pedidos_mes }}</p>
          <p v-if="dashStore.stats.pedidos_mes > 0" class="text-xs font-bold text-navy/50 mt-2">
            Promedio: ${{ formatMoney(dashStore.stats.promedio_pedido) }} / pedido
          </p>
        </div>

        <!-- En Tránsito -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-lavanda-medio">
          <div class="flex items-start justify-between mb-1">
            <p class="text-sm font-bold uppercase text-navy/60">En Tránsito / Agencia</p>
            <i
              class="pi pi-info-circle text-navy/40 text-xs cursor-help"
              title="Pedidos con estado ENVIADO, EN_RUTA o RETIRO_EN_AGENCIA."
              aria-hidden="true"
            ></i>
          </div>
          <p class="text-3xl font-black text-navy">{{ dashStore.stats.en_transito }}</p>
          <p class="text-xs font-bold text-blue-500 mt-2">
            <i class="pi pi-truck" aria-hidden="true"></i> {{ transitoTexto }}
          </p>
        </div>

        <!-- Riesgo Devolución -->
        <div
          class="p-6 rounded-xl shadow-sm relative overflow-hidden"
          :class="dashStore.stats.riesgo_devolucion > 0
            ? 'bg-red-50 border border-red-200'
            : 'bg-white border border-lavanda-medio'"
        >
          <div
            v-if="dashStore.stats.riesgo_devolucion > 0"
            class="absolute right-0 top-0 h-full w-2 bg-alerta animate-pulse"
          ></div>
          <div class="flex items-start justify-between mb-1">
            <p class="text-sm font-bold uppercase" :class="dashStore.stats.riesgo_devolucion > 0 ? 'text-alerta' : 'text-navy/60'">
              Riesgo Devolución
            </p>
            <i
              class="pi pi-info-circle text-navy/40 text-xs cursor-help"
              title="Pedidos esperando en agencia desde hace 6+ días. Servientrega los devuelve después de 8."
              aria-hidden="true"
            ></i>
          </div>
          <p class="text-3xl font-black" :class="dashStore.stats.riesgo_devolucion > 0 ? 'text-red-600' : 'text-navy'">
            {{ dashStore.stats.riesgo_devolucion }}
          </p>
          <p
            v-if="dashStore.stats.riesgo_devolucion > 0"
            class="text-xs font-bold text-red-600 mt-2 cursor-pointer hover:underline"
            @click="router.push({ path: '/pedidos', query: { filtro: 'novedades' } })"
          >
            <i class="pi pi-exclamation-circle" aria-hidden="true"></i> Requieren atención hoy
          </p>
          <p v-else class="text-xs font-bold text-green-500 mt-2">
            <i class="pi pi-check-circle" aria-hidden="true"></i> Sin riesgos
          </p>
        </div>
      </div>

      <!-- ================== KPIs fase 1 ================== -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <!-- % Confirmación -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-lavanda-medio">
          <div class="flex items-start justify-between mb-1">
            <p class="text-sm font-bold uppercase text-navy/60">% Confirmación</p>
            <i
              class="pi pi-info-circle text-navy/40 text-xs cursor-help"
              title="Porcentaje de pedidos del mes que ya salieron del estado PENDIENTE (fueron confirmados o avanzaron en el flujo)."
              aria-hidden="true"
            ></i>
          </div>
          <p class="text-3xl font-black text-navy">
            {{ dashStore.stats.porcentaje_confirmacion }}<span class="text-xl">%</span>
          </p>
          <p class="text-xs font-bold text-navy/50 mt-2">
            {{ dashStore.stats.confirmados_mes }} / {{ dashStore.stats.pedidos_mes }} del mes
          </p>
        </div>

        <!-- % Entrega -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-lavanda-medio">
          <div class="flex items-start justify-between mb-1">
            <p class="text-sm font-bold uppercase text-navy/60">% Entrega</p>
            <i
              class="pi pi-info-circle text-navy/40 text-xs cursor-help"
              title="Entregados / (entregados + no entregados + devueltos) del mes. Solo cuenta pedidos ya cerrados, no los que siguen en tránsito."
              aria-hidden="true"
            ></i>
          </div>
          <p class="text-3xl font-black text-navy">
            {{ dashStore.stats.porcentaje_entrega }}<span class="text-xl">%</span>
          </p>
          <p class="text-xs font-bold text-navy/50 mt-2">
            {{ dashStore.stats.entregados_mes }} entregados del mes
          </p>
        </div>

        <!-- Facturación en tránsito -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-lavanda-medio">
          <div class="flex items-start justify-between mb-1">
            <p class="text-sm font-bold uppercase text-navy/60">Fact. en Tránsito</p>
            <i
              class="pi pi-info-circle text-navy/40 text-xs cursor-help"
              title="Monto total de los pedidos en estado ENVIADO, EN_RUTA o RETIRO_EN_AGENCIA. Aún pueden caerse o devolverse."
              aria-hidden="true"
            ></i>
          </div>
          <p class="text-3xl font-black text-navy">${{ formatMoney(dashStore.stats.facturacion_en_transito) }}</p>
          <p class="text-xs font-bold text-blue-500 mt-2">
            <i class="pi pi-send" aria-hidden="true"></i> En circulación
          </p>
        </div>

        <!-- Facturación en novedad -->
        <div
          class="p-6 rounded-xl shadow-sm border"
          :class="dashStore.stats.novedades > 0 ? 'bg-orange-50 border-orange-200' : 'bg-white border-lavanda-medio'"
        >
          <div class="flex items-start justify-between mb-1">
            <p class="text-sm font-bold uppercase" :class="dashStore.stats.novedades > 0 ? 'text-orange-700' : 'text-navy/60'">
              Fact. en Novedad
            </p>
            <i
              class="pi pi-info-circle text-navy/40 text-xs cursor-help"
              title="Monto total de los pedidos con estado NOVEDAD o NO_ENTREGADO. Revísalos en la sección Novedades."
              aria-hidden="true"
            ></i>
          </div>
          <p class="text-3xl font-black" :class="dashStore.stats.novedades > 0 ? 'text-orange-700' : 'text-navy'">
            ${{ formatMoney(dashStore.stats.facturacion_en_novedad) }}
          </p>
          <p
            v-if="dashStore.stats.novedades > 0"
            class="text-xs font-bold text-orange-700 mt-2 cursor-pointer hover:underline"
            @click="router.push({ path: '/pedidos', query: { filtro: 'novedades' } })"
          >
            <i class="pi pi-exclamation-triangle" aria-hidden="true"></i>
            {{ dashStore.stats.novedades }} novedad{{ dashStore.stats.novedades > 1 ? 'es' : '' }}
          </p>
          <p v-else class="text-xs font-bold text-green-500 mt-2">
            <i class="pi pi-check-circle" aria-hidden="true"></i> Sin novedades
          </p>
        </div>
      </div>

      <!-- ================== Charts (dos columnas en lg) ================== -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Chart pedidos semana -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-lavanda-medio">
          <h3 class="text-lg font-bold text-navy mb-4">Pedidos últimos 7 días</h3>
          <div class="relative h-64 w-full">
            <Line
              v-if="dashStore.pedidosSemana.length > 0"
              :data="pedidosChartData"
              :options="pedidosChartOptions"
            />
            <div v-else class="flex items-center justify-center h-full">
              <p class="text-navy/40">Sin datos de pedidos esta semana</p>
            </div>
          </div>
        </div>

        <!-- Chart ventas semana -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-lavanda-medio">
          <h3 class="text-lg font-bold text-navy mb-4">Facturación últimos 7 días</h3>
          <div class="relative h-64 w-full">
            <Line
              v-if="dashStore.ventasSemana.length > 0"
              :data="ventasChartData"
              :options="ventasChartOptions"
            />
            <div v-else class="flex items-center justify-center h-full">
              <p class="text-navy/40">Sin datos de ventas esta semana</p>
            </div>
          </div>
        </div>
      </div>

      <!-- ================== Resumen compacto ================== -->
      <div class="bg-navy/95 rounded-lg text-white flex flex-col sm:flex-row gap-0 divide-y sm:divide-y-0 sm:divide-x divide-white/10">
        <div class="flex-1 flex items-center gap-2 px-4 py-2.5">
          <i class="pi pi-box text-mauve text-sm" aria-hidden="true"></i>
          <span class="text-[11px] uppercase tracking-wide text-lavanda-medio">Inventario:</span>
          <span v-if="productoMenorStock" class="text-xs font-medium">
            {{ productoMenorStock.nombre }} —
            <span class="font-bold text-mauve">{{ productoMenorStock.stock }} uds</span>
          </span>
          <span v-else class="text-xs text-lavanda-medio/70">Agrega productos</span>
        </div>
        <div class="flex-1 flex items-center gap-2 px-4 py-2.5">
          <i class="pi pi-chart-bar text-mauve text-sm" aria-hidden="true"></i>
          <span class="text-[11px] uppercase tracking-wide text-lavanda-medio">Actividad:</span>
          <span v-if="dashStore.stats.pedidos_mes > 0" class="text-xs font-medium">
            {{ dashStore.stats.pedidos_mes }} pedidos · <span class="font-bold text-mauve">${{ formatMoney(dashStore.stats.ventas_mes) }}</span>
          </span>
          <span v-else class="text-xs text-lavanda-medio/70">Sin pedidos este mes</span>
        </div>
      </div>

      <!-- ================== Canales ================== -->
      <div v-if="dashStore.canalesStats.length > 0" class="bg-white p-6 rounded-xl shadow-sm border border-lavanda-medio">
        <h3 class="text-lg font-bold text-navy mb-4">Pedidos por Canal de Origen</h3>
        <div class="flex flex-col md:flex-row items-center gap-6">
          <div class="relative h-56 w-56 shrink-0">
            <Doughnut :data="canalesChartData" :options="canalesChartOptions" />
          </div>
          <div class="flex-1 grid grid-cols-2 gap-3 w-full">
            <div
              v-for="(canal, idx) in dashStore.canalesStats"
              :key="canal.canal"
              class="flex items-center gap-2 bg-lavanda/30 p-2 rounded-lg"
            >
              <span
                class="w-3 h-3 rounded-full shrink-0"
                :style="{ backgroundColor: CANAL_COLORES[idx] || '#C8C8E9' }"
              ></span>
              <span class="text-sm text-navy font-medium truncate">{{ canal.canal }}</span>
              <span class="text-sm font-bold text-mauve ml-auto">{{ canal.total }}</span>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
