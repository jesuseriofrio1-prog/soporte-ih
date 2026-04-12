import { Injectable } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class DashboardService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Estadísticas generales del mes */
  async getStats() {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('get_dashboard_stats');

    if (error) throw error;

    const stats = data;
    const pedidosMes = Number(stats.pedidos_mes) || 0;
    const ventasMes = Number(stats.ventas_mes) || 0;

    return {
      pedidos_mes: pedidosMes,
      ventas_mes: ventasMes,
      en_transito: Number(stats.en_transito) || 0,
      riesgo_devolucion: Number(stats.riesgo_devolucion) || 0,
      promedio_pedido: pedidosMes > 0
        ? Math.round((ventasMes / pedidosMes) * 100) / 100
        : 0,
    };
  }

  /** Ventas agrupadas por día (últimos 7 días) */
  async getVentasSemana() {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('get_ventas_semana');

    if (error) throw error;
    return data || [];
  }

  /** Distribución de pedidos por canal de origen (mes actual) */
  async getCanalesStats() {
    const { data, error } = await this.supabase
      .getClient()
      .rpc('get_canales_stats');

    if (error) throw error;
    return data || [];
  }
}
