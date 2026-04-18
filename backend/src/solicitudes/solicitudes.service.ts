import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { normalizarTelefono } from '../common/utils';
import type { CreateSolicitudPublicDto } from './dto/create-solicitud.dto';

export type EstadoSolicitud =
  | 'PENDIENTE'
  | 'ENVIADA_A_ROCKET'
  | 'ENLAZADA'
  | 'CANCELADA';

export interface TiendaPublica {
  id: string;
  slug: string;
  nombre: string;
  logo_url: string | null;
  color_primario: string | null;
  color_secundario: string | null;
  color_fondo: string | null;
}

export interface ProductoPublico {
  id: string;
  slug: string;
  nombre: string;
  precio: number | null;
  icono: string | null;
}

@Injectable()
export class SolicitudesService {
  private readonly log = new Logger(SolicitudesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  // ─────────────────────── Público ───────────────────────

  /** Devuelve la tienda pública por slug o 404. */
  async tiendaPublica(slug: string): Promise<TiendaPublica> {
    const { data, error } = await this.supabase
      .getClient()
      .from('tiendas')
      .select('id, slug, nombre, logo_url, color_primario, color_secundario, color_fondo')
      .eq('slug', slug)
      .eq('estado', 'activa')
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException(`Tienda "${slug}" no existe o está inactiva`);
    return data as TiendaPublica;
  }

  /** Catálogo público: sólo productos activos con stock>0, campos mínimos. */
  async catalogoPublico(tiendaId: string): Promise<ProductoPublico[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('productos')
      .select('id, slug, nombre, precio, icono')
      .eq('tienda_id', tiendaId)
      .eq('activo', true)
      .order('nombre', { ascending: true });
    if (error) throw error;
    return (data ?? []) as ProductoPublico[];
  }

  /** Devuelve un producto público por slug o 404 (validando que sea de esa tienda). */
  async productoPublico(tiendaId: string, productoSlug: string): Promise<ProductoPublico> {
    const { data, error } = await this.supabase
      .getClient()
      .from('productos')
      .select('id, slug, nombre, precio, icono')
      .eq('tienda_id', tiendaId)
      .eq('slug', productoSlug)
      .eq('activo', true)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException(`Producto "${productoSlug}" no existe en esta tienda`);
    return data as ProductoPublico;
  }

  /** Crea una solicitud desde el formulario público. */
  async crearDesdePublico(params: {
    tiendaSlug: string;
    productoSlug?: string;
    body: CreateSolicitudPublicDto;
    ip: string | null;
    userAgent: string | null;
  }) {
    const tienda = await this.tiendaPublica(params.tiendaSlug);

    // Resolver producto: por slug (del path) o por body.producto_id (catálogo-general).
    let productoId: string | null = null;
    if (params.productoSlug) {
      const p = await this.productoPublico(tienda.id, params.productoSlug);
      productoId = p.id;
    } else if (params.body.producto_id) {
      // Validar que el producto pertenece a la tienda y está activo.
      const { data, error } = await this.supabase
        .getClient()
        .from('productos')
        .select('id')
        .eq('id', params.body.producto_id)
        .eq('tienda_id', tienda.id)
        .eq('activo', true)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new BadRequestException('Producto no válido para esta tienda');
      productoId = data.id;
    }

    const { data: solicitud, error } = await this.supabase
      .getClient()
      .from('solicitudes')
      .insert({
        tienda_id: tienda.id,
        producto_id: productoId,
        cliente_nombre: params.body.cliente_nombre.trim(),
        cliente_telefono: normalizarTelefono(params.body.cliente_telefono),
        cliente_email: params.body.cliente_email?.trim() || null,
        provincia: params.body.provincia?.trim() || null,
        ciudad: params.body.ciudad?.trim() || null,
        direccion: params.body.direccion.trim(),
        cantidad: params.body.cantidad ?? 1,
        notas: params.body.notas?.trim() || null,
        ip_origen: params.ip,
        user_agent: params.userAgent?.slice(0, 300) ?? null,
      })
      .select('id, created_at')
      .single();
    if (error) throw error;

    return {
      ok: true,
      id: solicitud!.id,
      mensaje: '¡Pedido recibido! Te contactaremos pronto para confirmar.',
    };
  }

  // ─────────────────────── Admin ───────────────────────

  async listar(tiendaId: string, estado?: EstadoSolicitud) {
    let q = this.supabase
      .getClient()
      .from('solicitudes')
      .select(`
        id, estado, cliente_nombre, cliente_telefono, cliente_email,
        provincia, ciudad, direccion, cantidad, notas,
        rocket_order_id, pedido_id, created_at, updated_at,
        productos(id, nombre, slug, precio)
      `)
      .eq('tienda_id', tiendaId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (estado) q = q.eq('estado', estado);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }

  /** Contadores por estado para el badge del sidebar/UI. */
  async stats(tiendaId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('solicitudes')
      .select('estado')
      .eq('tienda_id', tiendaId)
      .in('estado', ['PENDIENTE', 'ENVIADA_A_ROCKET']);
    if (error) throw error;
    const pendientes = (data ?? []).filter((s) => s.estado === 'PENDIENTE').length;
    const enviadas = (data ?? []).filter((s) => s.estado === 'ENVIADA_A_ROCKET').length;
    return { pendientes, enviadas, total_abiertas: pendientes + enviadas };
  }

  /** Marca como ENVIADA_A_ROCKET y guarda el rocket_order_id. */
  async vincularRocket(solicitudId: string, rocketOrderId: string) {
    const idTrim = rocketOrderId.trim();
    if (!idTrim) throw new BadRequestException('rocket_order_id requerido');

    const { data, error } = await this.supabase
      .getClient()
      .from('solicitudes')
      .update({
        rocket_order_id: idTrim,
        estado: 'ENVIADA_A_ROCKET',
      })
      .eq('id', solicitudId)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new NotFoundException('Solicitud no encontrada');

    // Si el pedido ya existe (webhook llegó antes), enlazamos inmediato.
    await this.intentarEnlacePedido(data.tienda_id, idTrim);
    return data;
  }

  async cambiarEstado(solicitudId: string, estado: EstadoSolicitud) {
    const { data, error } = await this.supabase
      .getClient()
      .from('solicitudes')
      .update({ estado })
      .eq('id', solicitudId)
      .select()
      .single();
    if (error) throw error;
    if (!data) throw new NotFoundException('Solicitud no encontrada');
    return data;
  }

  async eliminar(solicitudId: string) {
    const { error } = await this.supabase
      .getClient()
      .from('solicitudes')
      .delete()
      .eq('id', solicitudId);
    if (error) throw error;
    return { ok: true };
  }

  /**
   * Busca un pedido con external_source=rocket + external_order_id y lo
   * enlaza con la solicitud. Si no existe todavía, no pasa nada: cuando
   * llegue el webhook/import, `enlazarDesdePedido` lo hará en la otra
   * dirección.
   */
  private async intentarEnlacePedido(tiendaId: string, rocketOrderId: string) {
    const db = this.supabase.getClient();
    const { data: pedido } = await db
      .from('pedidos')
      .select('id')
      .eq('tienda_id', tiendaId)
      .eq('external_source', 'rocket')
      .eq('external_order_id', rocketOrderId)
      .maybeSingle();

    if (pedido) {
      await db
        .from('solicitudes')
        .update({ pedido_id: pedido.id, estado: 'ENLAZADA' })
        .eq('tienda_id', tiendaId)
        .eq('rocket_order_id', rocketOrderId);
    }
  }

  /**
   * Llamado desde imports.service e webhooks.service cuando se crea o
   * actualiza un pedido Rocket. Si hay una solicitud esperándolo, se
   * enlaza y pasa a ENLAZADA.
   */
  async enlazarDesdePedido(tiendaId: string, rocketOrderId: string, pedidoId: string) {
    try {
      await this.supabase
        .getClient()
        .from('solicitudes')
        .update({ pedido_id: pedidoId, estado: 'ENLAZADA' })
        .eq('tienda_id', tiendaId)
        .eq('rocket_order_id', rocketOrderId)
        .in('estado', ['PENDIENTE', 'ENVIADA_A_ROCKET']);
    } catch (err) {
      this.log.warn(
        `No se pudo enlazar solicitud con rocket_order_id=${rocketOrderId}: ${(err as Error).message}`,
      );
    }
  }
}
