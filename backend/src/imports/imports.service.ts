import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { normalizarTelefono } from '../common/utils';
import { parseRocketExcel, type ParsedRow } from './rocket-excel.parser';

/**
 * Resultado de una importación de Excel de Rocket.
 */
export interface ImportResult {
  total: number;
  creados: number;
  actualizados: number;
  saltadosPorEstado: number;
  erroresValidacion: { fila: number; mensaje: string }[];
  sinMapear: {
    alias_externo: string;
    id_pedido: string;
    fila: number;
  }[];
}

export interface AliasPendiente {
  alias_externo: string;
  count: number;
}

@Injectable()
export class ImportsService {
  private readonly log = new Logger(ImportsService.name);

  constructor(private readonly supabase: SupabaseService) {}

  /**
   * Importa el contenido de un Excel de Rocket. Busca cada producto por
   * nombre (case-insensitive) o por alias guardado. Los pedidos sin
   * producto mapeado se reportan en sinMapear y NO se crean.
   */
  async importRocketExcel(tiendaId: string, buffer: Buffer): Promise<ImportResult> {
    const db = this.supabase.getClient();

    // 1) Validar tienda
    const { data: tienda, error: errT } = await db
      .from('tiendas')
      .select('id')
      .eq('id', tiendaId)
      .single();
    if (errT || !tienda) throw new BadRequestException(`Tienda ${tiendaId} no encontrada`);

    // 2) Parsear Excel
    const parsed = await parseRocketExcel(buffer);

    // 3) Cargar productos + aliases para la tienda
    const [{ data: productos, error: errP }, { data: aliases, error: errA }] = await Promise.all([
      db.from('productos').select('id, nombre').eq('tienda_id', tiendaId),
      db
        .from('producto_aliases')
        .select('alias_externo, producto_id')
        .eq('tienda_id', tiendaId)
        .eq('external_source', 'rocket'),
    ]);
    if (errP) throw errP;
    if (errA) throw errA;

    const nombreToId = new Map<string, string>();
    for (const p of productos ?? []) {
      nombreToId.set(p.nombre.trim().toLowerCase(), p.id);
    }
    const aliasToId = new Map<string, string>();
    for (const a of aliases ?? []) {
      aliasToId.set(a.alias_externo.trim().toLowerCase(), a.producto_id);
    }

    // 4) Cargar pedidos ya importados para esta tienda (upsert idempotente)
    const externalIds = parsed.rows.map((r) => r.externalOrderId);
    const existingByExtId = new Map<string, string>(); // external_order_id → pedido.id
    if (externalIds.length > 0) {
      const { data: existentes, error: errE } = await db
        .from('pedidos')
        .select('id, external_order_id')
        .eq('tienda_id', tiendaId)
        .eq('external_source', 'rocket')
        .in('external_order_id', externalIds);
      if (errE) throw errE;
      for (const e of existentes ?? []) {
        if (e.external_order_id) existingByExtId.set(e.external_order_id, e.id);
      }
    }

    // 5) Procesar fila a fila
    const result: ImportResult = {
      total: parsed.rows.length,
      creados: 0,
      actualizados: 0,
      saltadosPorEstado: parsed.skippedByEstado.length,
      erroresValidacion: parsed.errors.map((e) => ({ fila: e.rowNumber, mensaje: e.message })),
      sinMapear: [],
    };

    for (const row of parsed.rows) {
      const productoId = this.resolveProductoId(row.productoNombre, nombreToId, aliasToId);
      if (!productoId) {
        result.sinMapear.push({
          alias_externo: row.productoNombre,
          id_pedido: row.externalOrderId,
          fila: row.rowNumber,
        });
        continue;
      }

      try {
        const existeId = existingByExtId.get(row.externalOrderId);
        if (existeId) {
          await this.actualizarPedidoExistente(existeId, row);
          result.actualizados++;
        } else {
          await this.crearPedidoDesdeRow(tiendaId, productoId, row);
          result.creados++;
        }
      } catch (e) {
        this.log.error(`Error procesando fila ${row.rowNumber} (ID ${row.externalOrderId})`, e);
        result.erroresValidacion.push({
          fila: row.rowNumber,
          mensaje: e instanceof Error ? e.message : 'Error desconocido',
        });
      }
    }

    return result;
  }

  /**
   * Match de producto: primero alias guardado, luego nombre exacto
   * (case-insensitive). Devuelve null si no hay match.
   */
  private resolveProductoId(
    nombreRaw: string,
    nombreToId: Map<string, string>,
    aliasToId: Map<string, string>,
  ): string | null {
    const key = nombreRaw.trim().toLowerCase();
    return aliasToId.get(key) ?? nombreToId.get(key) ?? null;
  }

  /**
   * Crea pedido desde una fila de Rocket. También crea/reusa el cliente
   * correspondiente en la misma tienda, haciendo match por teléfono
   * normalizado.
   */
  private async crearPedidoDesdeRow(tiendaId: string, productoId: string, row: ParsedRow) {
    const db = this.supabase.getClient();
    const telefonoNorm = normalizarTelefono(row.telefono);

    // 1) Cliente: buscar o crear
    const { data: clienteExistente, error: errBusca } = await db
      .from('clientes')
      .select('id')
      .eq('telefono', telefonoNorm)
      .eq('tienda_id', tiendaId)
      .single();
    if (errBusca && errBusca.code !== 'PGRST116') throw errBusca;

    let clienteId: string;
    if (clienteExistente) {
      clienteId = clienteExistente.id;
    } else {
      const { data: nuevoCliente, error: errCli } = await db
        .from('clientes')
        .insert({
          nombre: row.clienteNombre,
          telefono: telefonoNorm,
          ciudad: row.ciudad,
          tienda_id: tiendaId,
        })
        .select('id')
        .single();
      if (errCli || !nuevoCliente) throw errCli ?? new Error('No se pudo crear el cliente');
      clienteId = nuevoCliente.id;
    }

    // 2) Pedido
    const createdAt = this.parseFechaRocket(row.fechaPedido);

    const insertPayload: Record<string, unknown> = {
      cliente_id: clienteId,
      cliente_nombre: row.clienteNombre,
      cliente_telefono: telefonoNorm,
      producto_id: productoId,
      guia: row.tracking ?? `ROCKET-${row.externalOrderId}`,
      tipo_entrega: row.tipoEntrega,
      direccion: row.direccion,
      monto: row.precio,
      cantidad: row.unidades,
      canal_origen: row.transportadora ?? 'Rocket',
      notas: row.observaciones,
      estado: row.estadoMapped,
      tienda_id: tiendaId,
      external_source: 'rocket',
      external_order_id: row.externalOrderId,
    };
    if (createdAt) insertPayload.created_at = createdAt;
    if (row.aplazado) insertPayload.retencion_inicio = new Date().toISOString();

    const { data: pedido, error: errPedido } = await db
      .from('pedidos')
      .insert(insertPayload)
      .select('id')
      .single();
    if (errPedido || !pedido) throw errPedido ?? new Error('No se pudo crear el pedido');

    // 3) Historial inicial
    await db.from('historial_estados').insert({
      pedido_id: pedido.id,
      estado_anterior: null,
      estado_nuevo: row.estadoMapped,
      nota: `Importado desde Rocket (ID ${row.externalOrderId})`,
    });
  }

  /**
   * Si un pedido ya estaba importado, sólo actualizamos el estado y el
   * tracking (pueden haber cambiado). El resto de datos se mantiene para
   * no sobrescribir ediciones manuales del usuario.
   */
  private async actualizarPedidoExistente(pedidoId: string, row: ParsedRow) {
    const db = this.supabase.getClient();

    const { data: actual, error } = await db
      .from('pedidos')
      .select('estado')
      .eq('id', pedidoId)
      .single();
    if (error || !actual) throw error ?? new Error('Pedido no encontrado al actualizar');

    const estadoAnterior = actual.estado as string;
    const patch: Record<string, unknown> = {};
    if (row.estadoMapped && row.estadoMapped !== estadoAnterior) patch.estado = row.estadoMapped;
    if (row.tracking) patch.guia = row.tracking;

    if (Object.keys(patch).length === 0) return;

    const { error: errUp } = await db.from('pedidos').update(patch).eq('id', pedidoId);
    if (errUp) throw errUp;

    if (patch.estado) {
      await db.from('historial_estados').insert({
        pedido_id: pedidoId,
        estado_anterior: estadoAnterior,
        estado_nuevo: patch.estado as string,
        nota: `Actualizado desde Rocket (ID ${row.externalOrderId})`,
      });
    }
  }

  /**
   * Convierte "13-04-2026" → ISO UTC al mediodía local (para evitar
   * problemas de timezone). Si el formato falla, devuelve null.
   */
  private parseFechaRocket(raw: string | null): string | null {
    if (!raw) return null;
    const match = raw.match(/^(\d{2})-(\d{2})-(\d{4})$/);
    if (!match) return null;
    const [, dd, mm, yyyy] = match;
    return `${yyyy}-${mm}-${dd}T12:00:00Z`;
  }

  // ───────────────────────── Aliases ─────────────────────────

  async listAliasesExistentes(tiendaId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('producto_aliases')
      .select('id, alias_externo, producto_id, productos(nombre)')
      .eq('tienda_id', tiendaId)
      .eq('external_source', 'rocket')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  async crearAlias(tiendaId: string, aliasExterno: string, productoId: string) {
    const db = this.supabase.getClient();

    // Verificar que el producto pertenezca a la tienda
    const { data: prod, error: errP } = await db
      .from('productos')
      .select('id, tienda_id')
      .eq('id', productoId)
      .single();
    if (errP || !prod || prod.tienda_id !== tiendaId) {
      throw new BadRequestException('El producto no pertenece a la tienda indicada');
    }

    const { data, error } = await db
      .from('producto_aliases')
      .upsert(
        {
          tienda_id: tiendaId,
          producto_id: productoId,
          external_source: 'rocket',
          alias_externo: aliasExterno.trim(),
        },
        { onConflict: 'tienda_id,external_source,alias_externo' },
      )
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async eliminarAlias(aliasId: string) {
    const { error } = await this.supabase
      .getClient()
      .from('producto_aliases')
      .delete()
      .eq('id', aliasId);
    if (error) throw error;
    return { ok: true };
  }
}
