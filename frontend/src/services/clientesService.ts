import api from './api'
import type { Pedido } from './pedidosService'

export interface Cliente {
  id: string
  nombre: string
  telefono: string
  ciudad: string | null
  notas: string | null
  created_at: string
  pedidos_total: number
  monto_total: number
}

export interface ClienteDetalle extends Cliente {
  pedidos: Pedido[]
}

export interface CreateClientePayload {
  nombre: string
  telefono: string
  ciudad?: string
  notas?: string
  tienda_id?: string
}

export interface UpdateClientePayload {
  nombre?: string
  telefono?: string
  ciudad?: string
  notas?: string
}

const clientesService = {
  async getAll(tiendaId: string, q?: string): Promise<Cliente[]> {
    const params: Record<string, string> = { tienda_id: tiendaId }
    if (q) params.q = q
    const { data } = await api.get('/clientes', { params })
    return data
  },

  async getById(id: string): Promise<ClienteDetalle> {
    const { data } = await api.get(`/clientes/${id}`)
    return data
  },

  async create(payload: CreateClientePayload): Promise<Cliente> {
    const { data } = await api.post('/clientes', payload)
    return data
  },

  async update(id: string, payload: UpdateClientePayload): Promise<Cliente> {
    const { data } = await api.patch(`/clientes/${id}`, payload)
    return data
  },

  async remove(id: string): Promise<void> {
    await api.delete(`/clientes/${id}`)
  },
}

export default clientesService
