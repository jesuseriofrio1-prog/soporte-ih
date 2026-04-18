import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { mapEstadoRocket } from '../imports/rocket-estado.map';
import { SolicitudesService } from '../solicitudes/solicitudes.service';

/**
 * Payload típico del webhook de Rocket Ecuador para cambios de estado.
 * Estructura tolerante — Rocket no publica un schema formal, así que
 * aceptamos varias variantes de nombres de campos.
 */
export interface RocketWebhookPayload {
  event?: string;
  event_type?: string;
  order_id?: string | number;
  external_order_id?: string | number;
  id_pedido?: string | number;
  tracking?: string | null;
  guia?: string | null;
  estado?: string;
  status?: string;
  nuevo_estado?: string;
  observaciones?: string | null;
  nota?: string | null;
  [k: string]: unknown;
}

export interface WebhookProcessResult {
  status: 'ok' | 'pedido_no_encontrado' | 'estado_no_reconocido' | 'ignorado' | 'error';
  pedido_id?: string;
  estado_anterior?: string;
  estado_nuevo?: string;
  mensaje?: string;
}

@Injectable()
export class WebhooksService {
  private readonly log = new Logger(WebhooksService.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly solicitudes: SolicitudesService,
  ) {}

  /**
   * Procesa un webhook de Rocket. No lanza — registra el resultado en
   * webhook_logs y devuelve un resultado estructurado para que el
   * controller pueda siempre responder 200 (Rocket reintenta en 4xx/5xx
   * y no queremos loops si hay datos inesperados).
   */
  async procesarRocket(payload: RocketWebhookPayload): Promise<WebhookProcessResult> {
    const externalOrderId = this.extractExternalId(payload);
    const estadoRaw = this.extractEstado(payload);
    const eventType =
      (payload.event_type as string | undefined) ||
      (payload.event as string | undefined) ||
      'order_status_update';

    let result: WebhookProcessResult;
    let pedidoIdLog: string | null = null;
    let tiendaIdLog: string | null = null;
    let errorMensaje: string | null = null;

    try {
      if (!externalOrderId) {
        result = {
          status: 'ignorado',
          mensaje: 'Payload sin ID de pedido (order_id/external_order_id/id_pedido)',
        };
      } else if (!estadoRaw) {
        result = {
          status: 'ignorado',
          mensaje: 'Payload sin estado (estado/status/nuevo_estado)',
        };
      } else {
        const procesado = await this.aplicarCambioEstado(externalOrderId, estadoRaw, payload);
        result = procesado.result;
        pedidoIdLog = procesado.result.pedido_id ?? null;
        tiendaIdLog = procesado.tiendaId;
      }
    } catch (err) {
      errorMensaje = err instanceof Error ? err.message : 'Error desconocido';
      this.log.error(`Webhook Rocket falló (ID ${externalOrderId})`, err as Error);
      result = { status: 'error', mensaje: errorMensaje };
    }

    // Siempre logueamos (ok, no encontrado, ignorado, error).
    await this.logWebhook({
      eventType,
      externalOrderId: externalOrderId ?? null,
      status: result.status,
      payload,
      pedidoId: pedidoIdLog,
      tiendaId: tiendaIdLog,
      errorMensaje,
    });

    return result;
  }

  private extractExternalId(payload: RocketWebhookPayload): string | null {
    const raw =
      payload.external_order_id ?? payload.order_id ?? payload.id_pedido ?? null;
    if (raw === null || raw === undefined || raw === '') return null;
    return String(raw).trim();
  }

  private extractEstado(payload: RocketWebhookPayload): string | null {
    const raw = payload.nuevo_estado ?? payload.estado ?? payload.status ?? null;
    if (!raw) return null;
    return String(raw).trim();
  }

  private async aplicarCambioEstado(
    externalOrderId: string,
    estadoRaw: string,
    payload: RocketWebhookPayload,
  ): Promise<{ result: WebhookProcessResult; tiendaId: string | null }> {
    const db = this.supabase.getClient();

    const { data: pedido, error } = await db
      .from('pedidos')
      .select('id, tienda_id, estado, retencion_inicio')
      .eq('external_source', 'rocket')
      .eq('external_order_id', externalOrderId)
      .maybeSingle();

    if (error) throw error;
    if (!pedido) {
      return {
        result: {
          status: 'pedido_no_encontrado',
          mensaje: `No hay pedido con external_order_id=${externalOrderId}. Debe importarse el Excel de Rocket primero.`,
        },
        tiendaId: null,
      };
    }

    const tiendaId = pedido.tienda_id as string;

    const mapping = mapEstadoRocket(estadoRaw);
    if (!mapping) {
      return {
        result: {
          status: 'estado_no_reconocido',
          pedido_id: pedido.id,
          mensaje: `Estado "${estadoRaw}" no está en el mapeo de Rocket→Soporte IH`,
        },
        tiendaId,
      };
    }

    const nuevoEstado = mapping.estado;
    const estadoAnterior = pedido.estado as string;

    const patch: Record<string, unknown> = {};
    if (nuevoEstado !== estadoAnterior) patch.estado = nuevoEstado;

    const tracking =
      (payload.tracking as string | undefined) ?? (payload.guia as string | undefined);
    if (tracking && typeof tracking === 'string') patch.guia = tracking.trim();

    // Si llega estado terminal, limpiamos retencion_inicio (igual que
    // cambiarEstado del service de pedidos).
    const TERMINAL = new Set(['ENTREGADO', 'NO_ENTREGADO', 'DEVUELTO']);
    if (TERMINAL.has(nuevoEstado) && pedido.retencion_inicio) {
      patch.retencion_inicio = null;
    }

    // Enlace oportunista: si existe solicitud esperando este rocket_order_id
    // la vinculamos al pedido, incluso si no hubo cambios de estado esta vez.
    await this.solicitudes.enlazarDesdePedido(tiendaId, externalOrderId, pedido.id);

    if (Object.keys(patch).length === 0) {
      return {
        result: {
          status: 'ok',
          pedido_id: pedido.id,
          estado_anterior: estadoAnterior,
          estado_nuevo: nuevoEstado,
          mensaje: 'Sin cambios',
        },
        tiendaId,
      };
    }

    const { error: errUp } = await db.from('pedidos').update(patch).eq('id', pedido.id);
    if (errUp) throw errUp;

    if (patch.estado) {
      const nota = (payload.observaciones ?? payload.nota ?? null) as string | null;
      await db.from('historial_estados').insert({
        pedido_id: pedido.id,
        estado_anterior: estadoAnterior,
        estado_nuevo: patch.estado as string,
        nota: `Webhook Rocket${nota ? ` · ${nota}` : ''}`,
      });
    }

    return {
      result: {
        status: 'ok',
        pedido_id: pedido.id,
        estado_anterior: estadoAnterior,
        estado_nuevo: nuevoEstado,
      },
      tiendaId,
    };
  }

  private async logWebhook(params: {
    eventType: string;
    externalOrderId: string | null;
    status: string;
    payload: unknown;
    pedidoId: string | null;
    tiendaId: string | null;
    errorMensaje: string | null;
  }) {
    try {
      await this.supabase.getClient().from('webhook_logs').insert({
        external_source: 'rocket',
        event_type: params.eventType,
        external_order_id: params.externalOrderId,
        status: params.status,
        payload: params.payload as object,
        pedido_id: params.pedidoId,
        tienda_id: params.tiendaId,
        error_mensaje: params.errorMensaje,
      });
    } catch (err) {
      // El log no debe romper el flujo. Sólo warn.
      this.log.warn(`No se pudo guardar webhook_log: ${(err as Error).message}`);
    }
  }

  /**
   * Lista los últimos eventos recibidos. Si `tiendaId` viene, filtra por
   * esa tienda. Si no, devuelve todo (útil para debug/admin global).
   */
  async listarLogs(limit = 50, tiendaId?: string) {
    let q = this.supabase
      .getClient()
      .from('webhook_logs')
      .select('id, external_source, event_type, external_order_id, status, pedido_id, tienda_id, error_mensaje, created_at')
      .eq('external_source', 'rocket')
      .order('created_at', { ascending: false })
      .limit(Math.min(Math.max(limit, 1), 200));
    if (tiendaId) q = q.eq('tienda_id', tiendaId);
    const { data, error } = await q;
    if (error) throw error;
    return data ?? [];
  }
}
