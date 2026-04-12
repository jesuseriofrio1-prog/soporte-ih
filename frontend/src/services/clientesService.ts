import api from './api'
import type { Pedido } from './pedidosService'

export interface Cliente {
  id: string
  nombre: string
  telefono: string
  ciudad: string | null
  notas: string | null
  created_at: string
}

export interface ClienteDetalle extends Cliente {
  pedidos: Pedido[]
}

export interface CreateClientePayload {
  nombre: string
  telefono: string
  ciudad?: string
  notas?: string
}

export interface UpdateClientePayload {
  nombre?: string
  telefono?: string
  ciudad?: string
  notas?: string
}

const clientesService = {
  async getAll(q?: string): Promise<Cliente[]> {
    const params = q ? { q } : {}
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
}

export default clientesService
