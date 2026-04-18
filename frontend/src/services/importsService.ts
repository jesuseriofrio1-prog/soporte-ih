import api from './api'

export interface ImportResult {
  total: number
  creados: number
  actualizados: number
  saltadosPorEstado: number
  erroresValidacion: { fila: number; mensaje: string }[]
  sinMapear: { alias_externo: string; id_pedido: string; fila: number }[]
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
}

export default importsService
