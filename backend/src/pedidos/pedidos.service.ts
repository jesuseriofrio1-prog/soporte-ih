import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { normalizarTelefono } from '../common/utils';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { CambiarEstadoDto, EstadoPedido } from './dto/cambiar-estado.dto';

/** Todos los estados posibles */
const TODOS_LOS_ESTADOS = [
  'PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'ENVIADO',
  'EN_RUTA', 'NOVEDAD', 'RETIRO_EN_AGENCIA',
  'ENTREGADO', 'NO_ENTREGADO', 'DEVUELTO',
];

@Injectable()
export class PedidosService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Listar pedidos con filtros y joins */
  async findAll(filtros: {
    tienda_id?: string;
    estado?: string;
    producto_id?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
    limit?: number;
    offset?: number;
  }) {
    let query = this.supabase
      .getClient()
      .from('pedidos')
      .select('*, clientes(nombre, telefono), productos(nombre, slug)');

    if (filtros.tienda_id) {
      query = query.eq('tienda_id', filtros.tienda_id);
    }
    if (filtros.estado) {
      query = query.eq('estado', filtros.estado);
    }
    if (filtros.producto_id) {
      query = query.eq('producto_id', filtros.producto_id);
    }
    if (filtros.fecha_desde) {
      query = query.gte('created_at', filtros.fecha_desde);
    }
    if (filtros.fecha_hasta) {
      query = query.lte('created_at', filtros.fecha_hasta + 'T23:59:59');
    }

    const limit = filtros.limit || 100;
    const offset = filtros.offset || 0;

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data;
  }

  /** Detalle de un pedido + historial de estados */
  async findOne(id: string) {
    const { data: pedido, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .select('*, clientes(nombre, telefono, ciudad), productos(nombre, slug, precio)')
      .eq('id', id)
      .single();

    if (error || !pedido) {
      throw new NotFoundException(`Pedido con id "${id}" no encontrado`);
    }

    const { data: historial, error: errHist } = await this.supabase
      .getClient()
      .from('historial_estados')
      .select('*')
      .eq('pedido_id', id)
      .order('created_at', { ascending: true });

    if (errHist) throw errHist;

    return { ...pedido, historial: historial || [] };
  }

  /** Crear pedido: busca/crea cliente, descuenta stock atómicamente */
  async create(dto: CreatePedidoDto) {
    const db = this.supabase.getClient();
    const telefonoNorm = normalizarTelefono(dto.cliente_telefono);

    // 1. Verificar que el producto existe
    const { data: producto, error: errProd } = await db
      .from('productos')
      .select('id, activo')
      .eq('id', dto.producto_id)
      .single();

    if (errProd || !producto) {
      throw new NotFoundException(`Producto con id "${dto.producto_id}" no encontrado`);
    }
    if (!producto.activo) {
      throw new BadRequestException('El producto no está activo');
    }

    // 2. Descontar stock atómicamente (evita race conditions)
    const { data: stockOk, error: errStock } = await db.rpc('descontar_stock', {
      p_producto_id: dto.producto_id,
    });

    if (errStock) throw errStock;
    if (!stockOk) {
      throw new BadRequestException('El producto no tiene stock disponible');
    }

    // 3. Buscar o crear cliente
    let clienteId: string;

    const { data: clienteExistente, error: errBusca } = await db
      .from('clientes')
      .select('id')
      .eq('telefono', telefonoNorm)
      .eq('tienda_id', dto.tienda_id)
      .single();

    if (errBusca && errBusca.code !== 'PGRST116') {
      throw new BadRequestException('Error al buscar cliente');
    }

    if (clienteExistente) {
      clienteId = clienteExistente.id;
    } else {
      const { data: nuevoCliente, error: errCli } = await db
        .from('clientes')
        .insert({ nombre: dto.cliente_nombre, telefono: telefonoNorm, tienda_id: dto.tienda_id })
        .select('id')
        .single();

      if (errCli || !nuevoCliente) {
        throw new BadRequestException('Error al crear el cliente');
      }
      clienteId = nuevoCliente.id;
    }

    // 4. Crear el pedido
    const { data: pedido, error: errPedido } = await db
      .from('pedidos')
      .insert({
        cliente_id: clienteId,
        cliente_nombre: dto.cliente_nombre,
        cliente_telefono: telefonoNorm,
        producto_id: dto.producto_id,
        guia: dto.guia,
        tipo_entrega: dto.tipo_entrega,
        direccion: dto.direccion,
        monto: dto.monto,
        canal_origen: dto.canal_origen || null,
        notas: dto.notas || null,
        estado: 'PENDIENTE',
        tienda_id: dto.tienda_id,
      })
      .select('*, clientes(nombre, telefono), productos(nombre, slug)')
      .single();

    if (errPedido) throw errPedido;

    // 5. Registrar en historial
    const { error: errHist } = await db.from('historial_estados').insert({
      pedido_id: pedido.id,
      estado_anterior: null,
      estado_nuevo: 'PENDIENTE',
      nota: 'Pedido creado',
    });

    if (errHist) throw errHist;

    return pedido;
  }

  /** Editar datos del pedido */
  async update(id: string, dto: UpdatePedidoDto) {
    const db = this.supabase.getClient();
    await this.findOne(id);

    // Todos los campos se guardan directo en el pedido
    const pedidoUpdate: Record<string, unknown> = {};
    if (dto.cliente_nombre !== undefined) pedidoUpdate.cliente_nombre = dto.cliente_nombre;
    if (dto.cliente_telefono !== undefined) {
      pedidoUpdate.cliente_telefono = normalizarTelefono(dto.cliente_telefono);
    }
    if (dto.direccion !== undefined) pedidoUpdate.direccion = dto.direccion;
    if (dto.notas !== undefined) pedidoUpdate.notas = dto.notas;
    if (dto.dias_en_agencia !== undefined) pedidoUpdate.dias_en_agencia = dto.dias_en_agencia;
    if (dto.guia !== undefined) pedidoUpdate.guia = dto.guia;
    if (dto.monto !== undefined) pedidoUpdate.monto = dto.monto;

    if (Object.keys(pedidoUpdate).length > 0) {
      const { error } = await db
        .from('pedidos')
        .update(pedidoUpdate)
        .eq('id', id);

      if (error) throw error;
    }

    // Retornar pedido actualizado con joins
    return this.findOne(id);
  }

  /** Activar/desactivar conteo de retención de 8 días */
  async toggleRetencion(id: string) {
    const db = this.supabase.getClient();

    const { data: pedido, error } = await db
      .from('pedidos')
      .select('id, retencion_inicio')
      .eq('id', id)
      .single();

    if (error || !pedido) {
      throw new NotFoundException(`Pedido con id "${id}" no encontrado`);
    }

    // Toggle: si ya tiene fecha la quita, si no la pone
    const nuevoValor = pedido.retencion_inicio ? null : new Date().toISOString();

    const { data, error: errUp } = await db
      .from('pedidos')
      .update({ retencion_inicio: nuevoValor })
      .eq('id', id)
      .select()
      .single();

    if (errUp) throw errUp;
    return data;
  }

  /** Eliminar pedido y su historial */
  async remove(id: string) {
    const db = this.supabase.getClient();

    // Verificar que existe
    const { data: pedido, error } = await db
      .from('pedidos')
      .select('id, producto_id')
      .eq('id', id)
      .single();

    if (error || !pedido) {
      throw new NotFoundException(`Pedido con id "${id}" no encontrado`);
    }

    // Eliminar historial primero (FK cascade lo haría pero lo hacemos explícito)
    await db.from('historial_estados').delete().eq('pedido_id', id);

    // Eliminar pedido
    const { error: errDel } = await db.from('pedidos').delete().eq('id', id);
    if (errDel) throw errDel;

    return { message: 'Pedido eliminado' };
  }

  /** Cambiar estado del pedido con validación de transiciones */
  async cambiarEstado(id: string, dto: CambiarEstadoDto) {
    const db = this.supabase.getClient();

    const { data: pedido, error } = await db
      .from('pedidos')
      .select('*, productos(id)')
      .eq('id', id)
      .single();

    if (error || !pedido) {
      throw new NotFoundException(`Pedido con id "${id}" no encontrado`);
    }

    const estadoActual = pedido.estado as string;
    const nuevoEstado = dto.nuevo_estado;

    // Validar que sea un estado válido
    if (!TODOS_LOS_ESTADOS.includes(nuevoEstado)) {
      throw new BadRequestException(`Estado "${nuevoEstado}" no es válido`);
    }

    // No permitir cambiar al mismo estado
    if (estadoActual === nuevoEstado) {
      throw new BadRequestException(`El pedido ya está en estado ${nuevoEstado}`);
    }

    const { data: pedidoActualizado, error: errUpdate } = await db
      .from('pedidos')
      .update({ estado: nuevoEstado })
      .eq('id', id)
      .select()
      .single();

    if (errUpdate) throw errUpdate;

    const { error: errHist } = await db.from('historial_estados').insert({
      pedido_id: id,
      estado_anterior: estadoActual,
      estado_nuevo: nuevoEstado,
      nota: dto.nota || null,
    });

    if (errHist) throw errHist;

    // Si es DEVUELTO → devolver stock atómicamente
    if (nuevoEstado === EstadoPedido.DEVUELTO && pedido.productos) {
      const { error: errDev } = await db.rpc('devolver_stock', {
        p_producto_id: pedido.productos.id,
      });
      if (errDev) throw errDev;
    }

    return pedidoActualizado;
  }
}
