import api from './api'

export interface Producto {
  id: string
  slug: string
  nombre: string
  precio: number
  stock: number
  icono: string | null
  activo: boolean
  /** Costo unitario del producto (fábrica + flete). Null si no se configuró. */
  costo_unitario: number | null
  /** Fee Rocket promedio por unidad. Null si no se configuró. */
  fee_envio: number | null
  created_at: string
  updated_at: string
}

export interface CreateProductoPayload {
  nombre: string
  slug: string
  precio: number
  stock: number
  icono?: string
  costo_unitario?: number
  fee_envio?: number
  tienda_id?: string
}

export interface UpdateProductoPayload {
  nombre?: string
  precio?: number
  stock?: number
  icono?: string
  activo?: boolean
  costo_unitario?: number
  fee_envio?: number
}

const productosService = {
  async getAll(tiendaId: string, activo?: boolean): Promise<Producto[]> {
    const params: Record<string, unknown> = { tienda_id: tiendaId }
    if (activo !== undefined) params.activo = activo
    const { data } = await api.get('/productos', { params })
    return data
  },

  async getById(id: string): Promise<Producto> {
    const { data } = await api.get(`/productos/${id}`)
    return data
  },

  async create(payload: CreateProductoPayload): Promise<Producto> {
    const { data } = await api.post('/productos', payload)
    return data
  },

  async update(id: string, payload: UpdateProductoPayload): Promise<Producto> {
    const { data } = await api.patch(`/productos/${id}`, payload)
    return data
  },

  async remove(id: string): Promise<Producto> {
    const { data } = await api.delete(`/productos/${id}`)
    return data
  },
}

export default productosService
