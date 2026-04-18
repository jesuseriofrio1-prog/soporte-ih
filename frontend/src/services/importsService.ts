import api from './api'

export interface ImportResult {
  total: number
  creados: number
  actualizados: number
  saltadosPorEstado: number
  erroresValidacion: { fila: number; mensaje: string }[]
  sinMapear: {
    alias_externo: string
    id_pedido: string
    fila: number
    sugerencia?: {
      producto_id: string
      producto_nombre: string
      confianza: number
    }
  }[]
  ia?: {
    habilitado: boolean
    llamados: number
    auto_mapeados: number
    sugeridos: number
  }
}

export interface WebhookLog {
  id: string
  external_source: string
  event_type: string | null
  external_order_id: string | null
  status: string
  pedido_id: string | null
  error_mensaje: string | null
  created_at: string
}

export interface ProductoAlias {
  id: string
  alias_externo: string
  producto_id: string
  productos?: { nombre: string }
}

const importsService = {
  async importRocketExcel(tiendaId: string, file: File): Promise<ImportResult> {
    const form = new FormData()
    form.append('file', file)
    const { data } = await api.post(
      `/imports/rocket-excel?tienda_id=${tiendaId}`,
      form,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    )
    return data
  },

  async listAliases(tiendaId: string): Promise<ProductoAlias[]> {
    const { data } = await api.get(`/imports/producto-aliases?tienda_id=${tiendaId}`)
    return data
  },

  async crearAlias(tiendaId: string, aliasExterno: string, productoId: string) {
    const { data } = await api.post(`/imports/producto-aliases`, {
      tienda_id: tiendaId,
      alias_externo: aliasExterno,
      producto_id: productoId,
    })
    return data
  },

  async eliminarAlias(aliasId: string) {
    await api.delete(`/imports/producto-aliases/${aliasId}`)
  },

  async listWebhookLogs(limit = 50): Promise<WebhookLog[]> {
    const { data } = await api.get(`/webhooks/rocket/logs?limit=${limit}`)
    return data
  },
}

export default importsService
