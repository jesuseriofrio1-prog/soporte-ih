import api from './api'

export interface PedidoCliente {
  nombre: string
  telefono: string
  ciudad?: string
}

export interface PedidoProducto {
  nombre: string
  slug: string
  precio?: number
}

export interface Pedido {
  id: string
  cliente_id: string
  producto_id: string
  guia: string
  tipo_entrega: 'DOMICILIO' | 'AGENCIA'
  direccion: string
  estado: EstadoPedido
  fecha_despacho: string
  dias_en_agencia: number
  monto: number
  canal_origen: string | null
  notas: string | null
  created_at: string
  updated_at: string
  clientes?: PedidoCliente
  productos?: PedidoProducto
  historial?: HistorialEstado[]
}

export interface HistorialEstado {
  id: string
  pedido_id: string
  estado_anterior: string | null
  estado_nuevo: string
  nota: string | null
  created_at: string
}

export type EstadoPedido =
  | 'INGRESANDO'
  | 'EN_TRANSITO'
  | 'EN_AGENCIA'
  | 'EN_REPARTO'
  | 'NOVEDAD'
  | 'ENTREGADO'
  | 'DEVUELTO'

export interface FiltrosPedidos {
  estado?: string
  producto_id?: string
  fecha_desde?: string
  fecha_hasta?: string
}

export interface CreatePedidoPayload {
  cliente_nombre: string
  cliente_telefono: string
  producto_id: string
  guia: string
  tipo_entrega: 'DOMICILIO' | 'AGENCIA'
  direccion: string
  monto: number
  canal_origen?: string
  notas?: string
}

export interface UpdatePedidoPayload {
  direccion?: string
  notas?: string
  dias_en_agencia?: number
}

/** Transiciones válidas de estado */
export const TRANSICIONES_VALIDAS: Record<string, EstadoPedido[]> = {
  INGRESANDO: ['EN_TRANSITO'],
  EN_TRANSITO: ['EN_AGENCIA', 'EN_REPARTO', 'NOVEDAD'],
  EN_AGENCIA: ['ENTREGADO', 'DEVUELTO', 'NOVEDAD'],
  EN_REPARTO: ['ENTREGADO', 'NOVEDAD'],
  NOVEDAD: ['EN_TRANSITO', 'EN_AGENCIA', 'EN_REPARTO', 'DEVUELTO', 'ENTREGADO'],
}

const pedidosService = {
  async getAll(filtros?: FiltrosPedidos): Promise<Pedido[]> {
    const params: Record<string, string> = {}
    if (filtros?.estado) params.estado = filtros.estado
    if (filtros?.producto_id) params.producto_id = filtros.producto_id
    if (filtros?.fecha_desde) params.fecha_desde = filtros.fecha_desde
    if (filtros?.fecha_hasta) params.fecha_hasta = filtros.fecha_hasta
    const { data } = await api.get('/pedidos', { params })
    return data
  },

  async getById(id: string): Promise<Pedido> {
    const { data } = await api.get(`/pedidos/${id}`)
    return data
  },

  async create(payload: CreatePedidoPayload): Promise<Pedido> {
    const { data } = await api.post('/pedidos', payload)
    return data
  },

  async update(id: string, payload: UpdatePedidoPayload): Promise<Pedido> {
    const { data } = await api.patch(`/pedidos/${id}`, payload)
    return data
  },

  async cambiarEstado(id: string, nuevo_estado: EstadoPedido, nota?: string): Promise<Pedido> {
    const { data } = await api.patch(`/pedidos/${id}/estado`, { nuevo_estado, nota })
    return data
  },
}

export default pedidosService
