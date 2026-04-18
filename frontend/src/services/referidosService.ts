import api from './api'

export interface Referido {
  id: string
  tienda_id: string
  codigo: string
  cliente_referente_id: string | null
  cliente_referente_nombre: string
  cliente_referente_tel: string | null
  usos_count: number
  ultimo_uso_en: string | null
  notas: string | null
  activo: boolean
  created_at: string
}

export interface CrearReferidoPayload {
  tienda_id: string
  cliente_id?: string
  cliente_nombre: string
  cliente_tel?: string
  codigo?: string
  notas?: string
}

export interface ValidacionReferidoPublica {
  codigo: string
  referente_nombre: string
  valido: boolean
}

const referidosService = {
  async list(tiendaId: string): Promise<Referido[]> {
    const { data } = await api.get('/referidos', { params: { tienda_id: tiendaId } })
    return data
  },

  async create(payload: CrearReferidoPayload): Promise<Referido> {
    const { data } = await api.post('/referidos', payload)
    return data
  },

  async update(
    id: string,
    tiendaId: string,
    patch: { activo?: boolean; notas?: string | null },
  ): Promise<Referido> {
    const { data } = await api.patch(`/referidos/${id}`, patch, {
      params: { tienda_id: tiendaId },
    })
    return data
  },

  async remove(id: string, tiendaId: string): Promise<void> {
    await api.delete(`/referidos/${id}`, { params: { tienda_id: tiendaId } })
  },

  /** Público (sin auth) — valida un código de referido para una tienda. */
  async validarPublico(slug: string, codigo: string): Promise<ValidacionReferidoPublica> {
    const { data } = await api.get(
      `/public/tiendas/${encodeURIComponent(slug)}/referidos/${encodeURIComponent(codigo)}`,
    )
    return data
  },
}

export default referidosService
