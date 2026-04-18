import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { FirebaseAdminService } from './firebase-admin.service';

@Injectable()
export class NotificationsService {
  constructor(
    private readonly supabase: SupabaseService,
    private readonly firebaseAdmin: FirebaseAdminService,
  ) {}

  /**
   * Registrar un token FCM asociado a una tienda. Upsert por (token):
   * si el mismo navegador se loguea en otra tienda, el token se
   * reasigna a la nueva.
   */
  async registerToken(token: string, tiendaId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('fcm_tokens')
      .upsert({ token, tienda_id: tiendaId }, { onConflict: 'token' })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Obtener tokens registrados. Si viene `tiendaId`, filtra por esa
   * tienda; si no, devuelve todos (fallback para llamadas legacy).
   */
  async getAllTokens(tiendaId?: string): Promise<string[]> {
    let q = this.supabase.getClient().from('fcm_tokens').select('token');
    if (tiendaId) q = q.eq('tienda_id', tiendaId);
    const { data, error } = await q;
    if (error) throw error;
    return (data || []).map((row) => row.token);
  }

  /** Revisa pedidos en riesgo y envía push notification. */
  async checkAlertas(tienda_id?: string) {
    // Buscar pedidos en riesgo de devolución
    let query = this.supabase
      .getClient()
      .from('pedidos')
      .select('id')
      .eq('estado', 'RETIRO_EN_AGENCIA')
      .gte('dias_en_agencia', 6);

    if (tienda_id) {
      query = query.eq('tienda_id', tienda_id);
    }

    const { data: pedidosRiesgo, error } = await query;

    if (error) throw error;

    const cantidad = pedidosRiesgo?.length || 0;

    if (cantidad === 0) {
      return { alertas: 0, notificaciones: { success: 0, failure: 0 } };
    }

    // Solo notifica a los tokens de la misma tienda: admin de Skinna
    // no recibe alertas de MaxiHogar y viceversa.
    const tokens = await this.getAllTokens(tienda_id);

    if (tokens.length === 0) {
      return {
        alertas: cantidad,
        notificaciones: { success: 0, failure: 0, reason: 'Sin tokens registrados' },
      };
    }

    // Enviar push
    const resultado = await this.firebaseAdmin.sendToMultiple(
      tokens,
      '🚨 Alerta Soporte IH',
      `Tienes ${cantidad} pedido(s) en riesgo de devolución`,
    );

    return {
      alertas: cantidad,
      notificaciones: resultado,
    };
  }
}
