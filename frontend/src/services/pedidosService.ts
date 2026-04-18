import api from './api'

export interface PedidoCliente {
  nombre: string
  telefono: string
  ciudad?: string
  provincia?: string
}

export interface PedidoProducto {
  nombre: string
  slug: string
  precio?: number
  foto_url?: string | null
}

export interface Pedido {
  id: string
  cliente_id: string
  producto_id: string
  cliente_nombre: string | null
  cliente_telefono: string | null
  guia: string
  tipo_entrega: 'DOMICILIO' | 'AGENCIA'
  direccion: string
  estado: EstadoPedido
  fecha_despacho: string
  dias_en_agencia: number
  monto: number
  canal_origen: string | null
  notas: string | null
  provincia: string | null
  tracking_code?: string
  retencion_inicio: string | null
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
  | 'PENDIENTE'
  | 'CONFIRMADO'
  | 'EN_PREPARACION'
  | 'ENVIADO'
  | 'EN_RUTA'
  | 'NOVEDAD'
  | 'RETIRO_EN_AGENCIA'
  | 'ENTREGADO'
  | 'NO_ENTREGADO'
  | 'DEVUELTO'

export interface FiltrosPedidos {
  estado?: string
  producto_id?: string
  fecha_desde?: string
  fecha_hasta?: string
  tienda_id?: string
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
  tienda_id?: string
}

export interface UpdatePedidoPayload {
  direccion?: string
  notas?: string
  dias_en_agencia?: number
  guia?: string
  monto?: number
  cliente_nombre?: string
  cliente_telefono?: string
}

/** Todos los estados posibles */
export const TODOS_LOS_ESTADOS: EstadoPedido[] = [
  'PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'ENVIADO',
  'EN_RUTA', 'NOVEDAD', 'RETIRO_EN_AGENCIA',
  'ENTREGADO', 'NO_ENTREGADO', 'DEVUELTO',
]

const pedidosService = {
  async getAll(filtros?: FiltrosPedidos): Promise<Pedido[]> {
    const params: Record<string, string> = {}
    if (filtros?.tienda_id) params.tienda_id = filtros.tienda_id
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

  async remove(id: string): Promise<void> {
    await api.delete(`/pedidos/${id}`)
  },

  async toggleRetencion(id: string): Promise<Pedido> {
    const { data } = await api.patch(`/pedidos/${id}/retencion`)
    return data
  },
}

export default pedidosService
