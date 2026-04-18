import { defineStore } from 'pinia'
import { ref } from 'vue'
import dashboardService, {
  type DashboardStats,
  type VentaDia,
  type PedidoDia,
  type CanalStat,
} from '../services/dashboardService'
import { useTiendaStore } from './tienda'

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref<DashboardStats | null>(null)
  const ventasSemana = ref<VentaDia[]>([])
  const pedidosSemana = ref<PedidoDia[]>([])
  const canalesStats = ref<CanalStat[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll() {
    const tiendaStore = useTiendaStore()
    const tiendaId = tiendaStore.tiendaActiva?.id
    if (!tiendaId) return

    loading.value = true
    error.value = null
    try {
      const [s, v, p, c] = await Promise.all([
        dashboardService.getStats(tiendaId),
        dashboardService.getVentasSemana(tiendaId),
        dashboardService.getPedidosSemana(tiendaId),
        dashboardService.getCanalesStats(tiendaId),
      ])
      stats.value = s
      ventasSemana.value = v
      pedidosSemana.value = p
      canalesStats.value = c
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message || 'Error al cargar dashboard'
    } finally {
      loading.value = false
    }
  }

  return { stats, ventasSemana, pedidosSemana, canalesStats, loading, error, fetchAll }
})
