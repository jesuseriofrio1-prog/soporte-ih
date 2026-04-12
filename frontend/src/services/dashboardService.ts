import api from './api'

export interface DashboardStats {
  pedidos_mes: number
  ventas_mes: number
  en_transito: number
  riesgo_devolucion: number
  promedio_pedido: number
}

export interface VentaDia {
  fecha: string
  dia: string
  total: number
}

export interface CanalStat {
  canal: string
  total: number
}

const dashboardService = {
  async getStats(): Promise<DashboardStats> {
    const { data } = await api.get('/dashboard/stats')
    return data
  },

  async getVentasSemana(): Promise<VentaDia[]> {
    const { data } = await api.get('/dashboard/ventas-semana')
    return data
  },

  async getCanalesStats(): Promise<CanalStat[]> {
    const { data } = await api.get('/dashboard/canales')
    return data
  },
}

export default dashboardService
