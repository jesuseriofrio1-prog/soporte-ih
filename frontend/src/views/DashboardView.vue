<script setup lang="ts">
import { computed, onMounted } from 'vue'
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

// Producto con menor stock
const productoMenorStock = computed(() => {
  if (productosStore.productos.length === 0) return null
  return [...productosStore.productos].sort((a, b) => a.stock - b.stock)[0]
})

// Días estimados de stock
const diasEstimados = computed(() => {
  if (!productoMenorStock.value || !dashStore.stats) return 0
  const pedidosMes = dashStore.stats.pedidos_mes || 1
  const promedioDiario = pedidosMes / 30
  if (promedioDiario === 0) return 99
  return Math.round(productoMenorStock.value.stock / promedioDiario)
})

// Datos del chart
const chartData = computed(() => {
  const labels = dashStore.ventasSemana.map((v) => v.dia)
  const data = dashStore.ventasSemana.map((v) => Number(v.total))

  return {
    labels,
    datasets: [
      {
        label: 'Ventas ($)',
        data,
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
  }
})

const chartOptions = {
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
        label: (ctx: any) => `$${ctx.parsed.y.toFixed(2)}`,
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
        callback: (value: any) => `$${value}`,
      },
    },
  },
}

// Colores para canales
const CANAL_COLORES = [
  '#C49BC2', // mauve
  '#030363', // navy
  '#25D366', // wa-green
  '#C8C8E9', // lavanda-medio
  '#EF4444', // alerta
  '#3B82F6', // blue
  '#F59E0B', // amber
]

// Datos del donut de canales
const canalesChartData = computed(() => {
  const canales = dashStore.canalesStats
  return {
    labels: canales.map((c) => c.canal),
    datasets: [
      {
        data: canales.map((c) => Number(c.total)),
        backgroundColor: CANAL_COLORES.slice(0, canales.length),
        borderWidth: 2,
        borderColor: '#FFFFFF',
      },
    ],
  }
})

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

// Formatear número a moneda
function formatMoney(val: number): string {
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

onMounted(() => {
  dashStore.fetchAll()
  productosStore.fetchProductos(true)
})
</script>

<template>
  <div class="space-y-6">
    <!-- Loading -->
    <div v-if="dashStore.loading" class="text-center py-20">
      <i class="pi pi-spin pi-spinner text-4xl text-mauve"></i>
      <p class="text-navy/60 mt-2">Cargando dashboard...</p>
    </div>

    <template v-else-if="dashStore.stats">
      <!-- Stat Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
        <!-- Ventas Mes -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-lavanda-medio relative overflow-hidden">
          <div class="absolute right-0 top-0 h-full w-2 bg-mauve"></div>
          <p class="text-sm font-bold uppercase text-navy/60 mb-1">Ventas Mes</p>
          <p class="text-3xl font-black text-navy">${{ formatMoney(dashStore.stats.ventas_mes) }}</p>
          <p class="text-xs font-bold text-green-500 mt-2">
            <i class="pi pi-arrow-up"></i> 12% vs mes anterior
          </p>
        </div>

        <!-- Pedidos Mes -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-lavanda-medio">
          <p class="text-sm font-bold uppercase text-navy/60 mb-1">Pedidos Mes</p>
          <p class="text-3xl font-black text-navy">{{ dashStore.stats.pedidos_mes }}</p>
          <p class="text-xs font-bold text-navy/50 mt-2">
            Promedio: ${{ formatMoney(dashStore.stats.promedio_pedido) }} / pedido
          </p>
        </div>

        <!-- En Tránsito -->
        <div class="bg-white p-6 rounded-xl shadow-sm border border-lavanda-medio">
          <p class="text-sm font-bold uppercase text-navy/60 mb-1">En Tránsito / Agencia</p>
          <p class="text-3xl font-black text-navy">{{ dashStore.stats.en_transito }}</p>
          <p class="text-xs font-bold text-blue-500 mt-2">
            <i class="pi pi-truck"></i> Operando normal
          </p>
        </div>

        <!-- Riesgo Devolución -->
        <div class="bg-red-50 p-6 rounded-xl shadow-sm border border-red-200 relative overflow-hidden">
          <div class="absolute right-0 top-0 h-full w-2 bg-alerta animate-pulse"></div>
          <p class="text-sm font-bold uppercase text-alerta mb-1">Riesgo de Devolución</p>
          <p class="text-3xl font-black text-red-600">{{ dashStore.stats.riesgo_devolucion }}</p>
          <p
            class="text-xs font-bold text-red-600 mt-2 cursor-pointer hover:underline"
            @click="router.push('/pedidos')"
          >
            <i class="pi pi-exclamation-circle"></i> Requieren atención hoy
          </p>
        </div>
      </div>

      <!-- Chart + Insights -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Chart ventas semana -->
        <div class="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-lavanda-medio">
          <div class="flex justify-between items-center mb-4">
            <h3 class="text-lg font-bold text-navy">Tendencia de Ventas (Últimos 7 días)</h3>
            <button class="text-xs bg-lavanda text-navy px-3 py-1 rounded font-bold hover:bg-lavanda-medio transition">
              Descargar
            </button>
          </div>
          <div class="relative h-64 w-full">
            <Line
              v-if="dashStore.ventasSemana.length > 0"
              :data="chartData"
              :options="chartOptions"
            />
            <div v-else class="flex items-center justify-center h-full">
              <p class="text-navy/40">Sin datos de ventas esta semana</p>
            </div>
          </div>
        </div>

        <!-- Panel Insights -->
        <div class="bg-navy p-6 rounded-xl shadow-md text-white flex flex-col justify-between relative overflow-hidden">
          <i class="pi pi-sparkles absolute top-4 right-4 text-mauve text-4xl opacity-20"></i>

          <div>
            <h3 class="text-lg font-black text-mauve flex items-center gap-2 mb-4">
              ✨ Insights
            </h3>

            <div class="space-y-4">
              <!-- Alerta inventario -->
              <div class="bg-white/10 p-3 rounded-lg border border-lavanda-medio/20 backdrop-blur-sm">
                <p class="text-xs font-bold text-lavanda-medio mb-1">
                  <i class="pi pi-box"></i> Alerta de Inventario
                </p>
                <p v-if="productoMenorStock" class="text-sm font-medium">
                  El <span class="italic">{{ productoMenorStock.nombre }}</span> tiene stock bajo.
                  Quedan <span class="font-bold text-mauve">{{ productoMenorStock.stock }} uds</span>,
                  suficiente para ~{{ diasEstimados }} días.
                </p>
                <p v-else class="text-sm font-medium text-lavanda-medio">
                  Sin datos de inventario
                </p>
              </div>

              <!-- Optimización -->
              <div class="bg-white/10 p-3 rounded-lg border border-lavanda-medio/20 backdrop-blur-sm">
                <p class="text-xs font-bold text-lavanda-medio mb-1">
                  <i class="pi pi-map-marker"></i> Optimización
                </p>
                <p class="text-sm font-medium">
                  Aumento de ventas en <span class="italic">Guayaquil</span>.
                  Podrías lanzar una campaña Ads dirigida a esa zona.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Canales de origen -->
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
