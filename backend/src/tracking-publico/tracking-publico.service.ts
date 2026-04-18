import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface TrackingPublicoItem {
  estado: string;
  fecha: string;
  nota: string | null;
}

export interface TrackingPublico {
  tracking_code: string;
  estado: string;
  tipo_entrega: 'DOMICILIO' | 'AGENCIA';
  fecha_creado: string;
  fecha_despacho: string | null;
  provincia: string | null;
  dias_en_agencia: number;
  cliente_nombre_masked: string;
  producto: {
    nombre: string;
    slug: string;
    icono: string | null;
  } | null;
  tienda: {
    slug: string;
    nombre: string;
    logo_url: string | null;
    color_primario: string | null;
    color_secundario: string | null;
    color_fondo: string | null;
  };
  historial: TrackingPublicoItem[];
  /** Teléfono del admin/tienda para botón "Contactar" (si se configura). */
  whatsapp_contacto: string | null;
}

/**
 * Servicio público de tracking. Expone sólo información que tiene sentido
 * mostrar al destinatario del paquete. NO revela teléfono del cliente,
 * UUID interno, monto ni guía de Servientrega.
 */
@Injectable()
export class TrackingPublicoService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Enmascara "María Cristina Guacon Lazo" → "María C. G. L." */
  private maskearNombre(nombre: string | null): string {
    if (!nombre) return 'Cliente';
    const parts = nombre.trim().split(/\s+/);
    if (parts.length === 0) return 'Cliente';
    const [first, ...rest] = parts;
    const iniciales = rest.map((w) => `${w.charAt(0).toUpperCase()}.`).join(' ');
    return `${first} ${iniciales}`.trim();
  }

  async obtener(trackingCode: string): Promise<TrackingPublico> {
    const db = this.supabase.getClient();

    const { data: pedido, error } = await db
      .from('pedidos')
      .select(`
        tracking_code,
        estado,
        tipo_entrega,
        created_at,
        fecha_despacho,
        provincia,
        dias_en_agencia,
        cliente_nombre,
        productos(nombre, slug, icono),
        tiendas(slug, nombre, logo_url, color_primario, color_secundario, color_fondo),
        historial_estados(estado_nuevo, nota, created_at)
      `)
      .eq('tracking_code', trackingCode)
      .maybeSingle();

    if (error) throw error;
    if (!pedido) throw new NotFoundException('Código de seguimiento no válido');

    // Tipado de los joins de Supabase (vienen como array o single según la FK).
    const tienda = Array.isArray(pedido.tiendas) ? pedido.tiendas[0] : pedido.tiendas;
    const producto = Array.isArray(pedido.productos) ? pedido.productos[0] : pedido.productos;
    const historial = Array.isArray(pedido.historial_estados) ? pedido.historial_estados : [];

    return {
      tracking_code: pedido.tracking_code as string,
      estado: pedido.estado as string,
      tipo_entrega: pedido.tipo_entrega as 'DOMICILIO' | 'AGENCIA',
      fecha_creado: pedido.created_at as string,
      fecha_despacho: (pedido.fecha_despacho as string) ?? null,
      provincia: (pedido.provincia as string) ?? null,
      dias_en_agencia: (pedido.dias_en_agencia as number) ?? 0,
      cliente_nombre_masked: this.maskearNombre(pedido.cliente_nombre as string | null),
      producto: producto
        ? {
            nombre: producto.nombre as string,
            slug: producto.slug as string,
            icono: (producto.icono as string) ?? null,
          }
        : null,
      tienda: {
        slug: tienda?.slug as string,
        nombre: tienda?.nombre as string,
        logo_url: (tienda?.logo_url as string) ?? null,
        color_primario: (tienda?.color_primario as string) ?? null,
        color_secundario: (tienda?.color_secundario as string) ?? null,
        color_fondo: (tienda?.color_fondo as string) ?? null,
      },
      historial: historial
        .map((h) => ({
          estado: h.estado_nuevo as string,
          fecha: h.created_at as string,
          nota: (h.nota as string) ?? null,
        }))
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
      // Por ahora sin contacto configurable; usamos el env var WHATSAPP_SOPORTE si existe.
      whatsapp_contacto: process.env.WHATSAPP_SOPORTE ?? null,
    };
  }
}
