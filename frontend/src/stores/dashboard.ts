import { defineStore } from 'pinia'
import { ref } from 'vue'
import dashboardService, {
  type DashboardStats,
  type VentaDia,
  type CanalStat,
} from '../services/dashboardService'

export const useDashboardStore = defineStore('dashboard', () => {
  const stats = ref<DashboardStats | null>(null)
  const ventasSemana = ref<VentaDia[]>([])
  const canalesStats = ref<CanalStat[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchAll() {
    loading.value = true
    error.value = null
    try {
      const [s, v, c] = await Promise.all([
        dashboardService.getStats(),
        dashboardService.getVentasSemana(),
        dashboardService.getCanalesStats(),
      ])
      stats.value = s
      ventasSemana.value = v
      canalesStats.value = c
    } catch (e: any) {
      error.value = e.response?.data?.message || 'Error al cargar dashboard'
    } finally {
      loading.value = false
    }
  }

  return { stats, ventasSemana, canalesStats, loading, error, fetchAll }
})
