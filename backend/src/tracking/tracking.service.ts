import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

interface TrackingResult {
  guia: string;
  estado_servientrega: string | null;
  estado_mapeado: string | null;
  fecha_envio: string | null;
  destino: string | null;
  error?: string;
}

/** Mapea el estado de Servientrega a los estados del sistema */
function mapearEstado(estadoSE: string): string | null {
  const lower = estadoSE.toLowerCase();

  if (lower.includes('entregado') || lower.includes('certificacion de prueba de entrega')) {
    return 'ENTREGADO';
  }
  if (lower.includes('devuelto') || lower.includes('devolucion') || lower.includes('devolución')) {
    return 'DEVUELTO';
  }
  if (lower.includes('no entregado') || lower.includes('no se pudo')) {
    return 'NO_ENTREGADO';
  }
  if (lower.includes('reparto') || lower.includes('ruta') || lower.includes('distribución') || lower.includes('distribucion') || lower.includes('mensajero')) {
    return 'EN_RUTA';
  }
  if (lower.includes('ingresando en agencia') || lower.includes('reportado entregado en agencia') || (lower.includes('agencia') && !lower.includes('ingresando a cl'))) {
    return 'RETIRO_EN_AGENCIA';
  }
  if (lower.includes('novedad') || lower.includes('siniestro') || lower.includes('problema')) {
    return 'NOVEDAD';
  }
  if (lower.includes('tránsito') || lower.includes('transito') || lower.includes('trasbordo') || lower.includes('movilización') || lower.includes('movilizacion')) {
    return 'EN_RUTA';
  }
  if (lower.includes('ingresando') || lower.includes('recibido') || lower.includes('recolección') || lower.includes('recoleccion') || lower.includes('generado')) {
    return 'ENVIADO';
  }

  return null;
}

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /** Consultar tracking de una guía en Servientrega */
  async consultarGuia(guia: string): Promise<TrackingResult> {
    try {
      const url = `https://www.servientrega.com.ec/Tracking/?guia=${guia}&tipo=GUIA`;
      const response = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
      });

      if (!response.ok) {
        return { guia, estado_servientrega: null, estado_mapeado: null, fecha_envio: null, destino: null, error: `HTTP ${response.status}` };
      }

      const html = await response.text();

      // Buscar "Estado Actual:" y extraer el siguiente input value
      const estadoMatch = html.match(/Estado Actual[\s\S]*?value="([^"]*)"/);
      const fechaMatch = html.match(/Fecha envío[\s\S]*?value="([^"]*)"/);
      const destinoMatch = html.match(/Destino[\s\S]*?value="([^"]*)"/);

      const estadoSE = estadoMatch?.[1]?.trim() || null;
      const fechaEnvio = fechaMatch?.[1]?.trim() || null;
      const destino = destinoMatch?.[1]?.trim() || null;

      if (!estadoSE) {
        return { guia, estado_servientrega: null, estado_mapeado: null, fecha_envio: null, destino: null, error: 'No se encontró estado' };
      }

      return {
        guia,
        estado_servientrega: estadoSE,
        estado_mapeado: estadoSE ? mapearEstado(estadoSE) : null,
        fecha_envio: fechaEnvio,
        destino,
      };
    } catch (error) {
      this.logger.error(`Error consultando guía ${guia}:`, error);
      return { guia, estado_servientrega: null, estado_mapeado: null, fecha_envio: null, destino: null, error: 'Error de conexión' };
    }
  }

  /** Sincronizar todos los pedidos activos de una tienda con Servientrega */
  async sincronizarTienda(tiendaId: string) {
    const db = this.supabase.getClient();

    // Obtener pedidos con guía que no estén en estado final
    const { data: pedidos, error } = await db
      .from('pedidos')
      .select('id, guia, estado')
      .eq('tienda_id', tiendaId)
      .not('guia', 'eq', '')
      .not('estado', 'ilike', '%entregado%')
      .not('estado', 'ilike', '%devuelto%')
      .not('estado', 'ilike', '%devolucion%')
      .not('estado', 'ilike', '%devolución%');

    if (error) throw error;
    if (!pedidos || pedidos.length === 0) {
      return { total: 0, actualizados: 0, resultados: [] };
    }

    const resultados: Array<{
      guia: string;
      estado_anterior: string;
      estado_nuevo: string | null;
      estado_servientrega: string | null;
    }> = [];

    let actualizados = 0;

    // Consultar cada guía (con delay para no saturar)
    for (const pedido of pedidos) {
      const tracking = await this.consultarGuia(pedido.guia);

      if (tracking.estado_servientrega && tracking.estado_servientrega !== pedido.estado) {
        // Guardar el estado exacto de Servientrega
        await db
          .from('pedidos')
          .update({ estado: tracking.estado_servientrega })
          .eq('id', pedido.id);

        // Registrar en historial
        await db.from('historial_estados').insert({
          pedido_id: pedido.id,
          estado_anterior: pedido.estado,
          estado_nuevo: tracking.estado_servientrega,
          nota: 'Actualizado desde Servientrega',
        });

        actualizados++;
      }

      resultados.push({
        guia: pedido.guia,
        estado_anterior: pedido.estado,
        estado_nuevo: tracking.estado_servientrega,
        estado_servientrega: tracking.estado_servientrega,
      });

      // Delay de 500ms entre consultas para no saturar
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    return {
      total: pedidos.length,
      actualizados,
      resultados,
    };
  }
}
