import api from './api'

export interface DashboardStats {
  // Métricas del mes existentes
  pedidos_mes: number
  ventas_mes: number
  en_transito: number
  riesgo_devolucion: number
  promedio_pedido: number

  // Métricas fase 1
  confirmados_mes: number
  entregados_mes: number
  porcentaje_confirmacion: number
  porcentaje_entrega: number
  facturacion_en_transito: number
  facturacion_en_novedad: number
  novedades: number

  actualizado_en: string
}

export interface VentaDia {
  fecha: string
  dia: string
  total: number
}

export interface PedidoDia {
  fecha: string
  dia: string
  entrantes: number
  confirmados: number
  entregados: number
}

export interface CanalStat {
  canal: string
  total: number
}

export interface StorageInfo {
  size_bytes: number
  size_mb: number
  limit_mb: number
  usage_percent: number
  records: {
    productos: number
    clientes: number
    pedidos: number
    historial: number
    total: number
  }
}

const dashboardService = {
  async getStats(tiendaId: string): Promise<DashboardStats> {
    const { data } = await api.get(`/dashboard/stats?tienda_id=${tiendaId}`)
    return data
  },

  async getVentasSemana(tiendaId: string): Promise<VentaDia[]> {
    const { data } = await api.get(`/dashboard/ventas-semana?tienda_id=${tiendaId}`)
    return data
  },

  async getPedidosSemana(tiendaId: string): Promise<PedidoDia[]> {
    const { data } = await api.get(`/dashboard/pedidos-semana?tienda_id=${tiendaId}`)
    return data
  },

  async getCanalesStats(tiendaId: string): Promise<CanalStat[]> {
    const { data } = await api.get(`/dashboard/canales?tienda_id=${tiendaId}`)
    return data
  },

  async getStorageInfo(): Promise<StorageInfo> {
    const { data } = await api.get('/dashboard/storage')
    return data
  },
}

export default dashboardService
