import api from './api'

export interface Tienda {
  id: string
  nombre: string
  estado: boolean
  logo_url: string | null
  color_primario: string
  color_secundario: string
  color_fondo: string
  color_borde: string
  created_at: string
}

export interface CreateTiendaPayload {
  nombre: string
  logo_url?: string
  color_primario?: string
  color_secundario?: string
  color_fondo?: string
  color_borde?: string
}

export interface UpdateTiendaPayload {
  nombre?: string
  estado?: boolean
  logo_url?: string
  color_primario?: string
  color_secundario?: string
  color_fondo?: string
  color_borde?: string
}

const tiendasService = {
  async getAll(): Promise<Tienda[]> {
    const { data } = await api.get('/tiendas')
    return data
  },

  async getById(id: string): Promise<Tienda> {
    const { data } = await api.get(`/tiendas/${id}`)
    return data
  },

  async create(payload: CreateTiendaPayload): Promise<Tienda> {
    const { data } = await api.post('/tiendas', payload)
    return data
  },

  async update(id: string, payload: UpdateTiendaPayload): Promise<Tienda> {
    const { data } = await api.patch(`/tiendas/${id}`, payload)
    return data
  },
}

export default tiendasService
