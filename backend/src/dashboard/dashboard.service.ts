import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class DashboardService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Estadísticas generales del mes (enriquecidas desde la migración 013) */
  async getStats(tiendaId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('get_dashboard_stats', { p_tienda_id: tiendaId });

    if (error) throw error;

    const stats = data;
    const pedidosMes = Number(stats.pedidos_mes) || 0;
    const ventasMes = Number(stats.ventas_mes) || 0;

    return {
      // Métricas existentes
      pedidos_mes: pedidosMes,
      ventas_mes: ventasMes,
      en_transito: Number(stats.en_transito) || 0,
      riesgo_devolucion: Number(stats.riesgo_devolucion) || 0,
      promedio_pedido: pedidosMes > 0
        ? Math.round((ventasMes / pedidosMes) * 100) / 100
        : 0,

      // Métricas nuevas (fase 1)
      confirmados_mes: Number(stats.confirmados_mes) || 0,
      entregados_mes: Number(stats.entregados_mes) || 0,
      porcentaje_confirmacion: Number(stats.porcentaje_confirmacion) || 0,
      porcentaje_entrega: Number(stats.porcentaje_entrega) || 0,
      facturacion_en_transito: Number(stats.facturacion_en_transito) || 0,
      facturacion_en_novedad: Number(stats.facturacion_en_novedad) || 0,
      novedades: Number(stats.novedades) || 0,

      // Timestamp para el refresh manual del dashboard
      actualizado_en: new Date().toISOString(),
    };
  }

  /** Ventas agrupadas por día (últimos 7 días) */
  async getVentasSemana(tiendaId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('get_ventas_semana', { p_tienda_id: tiendaId });

    if (error) throw error;
    return data || [];
  }

  /** Serie diaria de pedidos (entrantes/confirmados/entregados) — últimos 7 días */
  async getPedidosSemana(tiendaId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('get_pedidos_semana', { p_tienda_id: tiendaId });

    if (error) throw error;
    return data || [];
  }

  /** Distribución de pedidos por canal de origen (mes actual) */
  async getCanalesStats(tiendaId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('get_canales_stats', { p_tienda_id: tiendaId });

    if (error) throw error;
    return data || [];
  }

  /** Tamaño de la base de datos */
  async getDbSize() {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('get_db_size');

    if (error) throw error;
    return data;
  }
}
