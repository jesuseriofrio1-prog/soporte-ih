import api from './api'

export type EstadoSolicitud =
  | 'PENDIENTE'
  | 'ENVIADA_A_ROCKET'
  | 'ENLAZADA'
  | 'CANCELADA'

export interface ProductoPublico {
  id: string
  slug: string
  nombre: string
  precio: number | null
  icono: string | null
}

export interface TiendaPublica {
  id: string
  slug: string
  nombre: string
  logo_url: string | null
  color_primario: string | null
  color_secundario: string | null
  color_fondo: string | null
}

export interface CrearSolicitudBody {
  cliente_nombre: string
  cliente_telefono: string
  cliente_email?: string
  provincia?: string
  ciudad?: string
  direccion: string
  cantidad?: number
  notas?: string
  producto_id?: string
}

export interface Solicitud {
  id: string
  estado: EstadoSolicitud
  cliente_nombre: string
  cliente_telefono: string
  cliente_email: string | null
  provincia: string | null
  ciudad: string | null
  direccion: string
  cantidad: number
  notas: string | null
  rocket_order_id: string | null
  pedido_id: string | null
  created_at: string
  updated_at: string
  productos?: { id: string; nombre: string; slug: string; precio: number | null } | null
}

export interface SolicitudStats {
  pendientes: number
  enviadas: number
  total_abiertas: number
}

const solicitudesService = {
  // Admin
  async list(tiendaId: string, estado?: EstadoSolicitud): Promise<Solicitud[]> {
    const params: Record<string, string> = { tienda_id: tiendaId }
    if (estado) params.estado = estado
    const { data } = await api.get('/solicitudes', { params })
    return data
  },

  async stats(tiendaId: string): Promise<SolicitudStats> {
    const { data } = await api.get('/solicitudes/stats', { params: { tienda_id: tiendaId } })
    return data
  },

  async vincularRocket(id: string, rocketOrderId: string): Promise<Solicitud> {
    const { data } = await api.patch(`/solicitudes/${id}/vincular-rocket`, {
      rocket_order_id: rocketOrderId,
    })
    return data
  },

  async cambiarEstado(id: string, estado: EstadoSolicitud): Promise<Solicitud> {
    const { data } = await api.patch(`/solicitudes/${id}/estado`, { estado })
    return data
  },

  async eliminar(id: string): Promise<void> {
    await api.delete(`/solicitudes/${id}`)
  },

  // Público (sin auth)
  async tiendaPublica(slug: string): Promise<{ tienda: TiendaPublica; catalogo: ProductoPublico[] }> {
    const { data } = await api.get(`/public/tiendas/${slug}`)
    return data
  },

  async productoPublico(
    slug: string,
    productoSlug: string,
  ): Promise<{ tienda: TiendaPublica; producto: ProductoPublico }> {
    const { data } = await api.get(`/public/tiendas/${slug}/productos/${productoSlug}`)
    return data
  },

  async crearDesdePublico(
    tiendaSlug: string,
    body: CrearSolicitudBody,
    productoSlug?: string,
  ): Promise<{ ok: boolean; id: string; mensaje: string }> {
    const params = productoSlug ? `?producto=${encodeURIComponent(productoSlug)}` : ''
    const { data } = await api.post(`/public/tiendas/${tiendaSlug}/solicitudes${params}`, body)
    return data
  },
}

export default solicitudesService
