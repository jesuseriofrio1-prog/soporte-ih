import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreatePedidoDto } from './dto/create-pedido.dto';
import { UpdatePedidoDto } from './dto/update-pedido.dto';
import { CambiarEstadoDto, EstadoPedido } from './dto/cambiar-estado.dto';

/** Mapa de transiciones válidas de estado */
const TRANSICIONES_VALIDAS: Record<string, string[]> = {
  INGRESANDO: ['EN_TRANSITO'],
  EN_TRANSITO: ['EN_AGENCIA', 'EN_REPARTO', 'NOVEDAD'],
  EN_AGENCIA: ['ENTREGADO', 'DEVUELTO', 'NOVEDAD'],
  EN_REPARTO: ['ENTREGADO', 'NOVEDAD'],
  NOVEDAD: ['EN_TRANSITO', 'EN_AGENCIA', 'EN_REPARTO', 'DEVUELTO', 'ENTREGADO'],
};

@Injectable()
export class PedidosService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Normalizar teléfono: quitar espacios/guiones, 0 inicial → 593 */
  private normalizarTelefono(telefono: string): string {
    let limpio = telefono.replace(/[\s\-]/g, '');
    if (limpio.startsWith('0')) {
      limpio = '593' + limpio.slice(1);
    }
    return limpio;
  }

  /** Listar pedidos con filtros y joins */
  async findAll(filtros: {
    estado?: string;
    producto_id?: string;
    fecha_desde?: string;
    fecha_hasta?: string;
  }) {
    let query = this.supabase
      .getClient()
      .from('pedidos')
      .select('*, clientes(nombre, telefono), productos(nombre, slug)');

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

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

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

    const { data: historial } = await this.supabase
      .getClient()
      .from('historial_estados')
      .select('*')
      .eq('pedido_id', id)
      .order('created_at', { ascending: true });

    return { ...pedido, historial: historial || [] };
  }

  /** Crear pedido: busca/crea cliente, descuenta stock */
  async create(dto: CreatePedidoDto) {
    const db = this.supabase.getClient();
    const telefonoNorm = this.normalizarTelefono(dto.cliente_telefono);

    // 1. Verificar que el producto existe y tiene stock
    const { data: producto, error: errProd } = await db
      .from('productos')
      .select('id, stock, activo')
      .eq('id', dto.producto_id)
      .single();

    if (errProd || !producto) {
      throw new NotFoundException(`Producto con id "${dto.producto_id}" no encontrado`);
    }
    if (!producto.activo) {
      throw new BadRequestException('El producto no está activo');
    }
    if (producto.stock <= 0) {
      throw new BadRequestException('El producto no tiene stock disponible');
    }

    // 2. Buscar o crear cliente
    let clienteId: string;

    const { data: clienteExistente } = await db
      .from('clientes')
      .select('id')
      .eq('telefono', telefonoNorm)
      .single();

    if (clienteExistente) {
      clienteId = clienteExistente.id;
    } else {
      const { data: nuevoCliente, error: errCli } = await db
        .from('clientes')
        .insert({ nombre: dto.cliente_nombre, telefono: telefonoNorm })
        .select('id')
        .single();

      if (errCli || !nuevoCliente) {
        throw new BadRequestException('Error al crear el cliente');
      }
      clienteId = nuevoCliente.id;
    }

    // 3. Crear el pedido
    const { data: pedido, error: errPedido } = await db
      .from('pedidos')
      .insert({
        cliente_id: clienteId,
        producto_id: dto.producto_id,
        guia: dto.guia,
        tipo_entrega: dto.tipo_entrega,
        direccion: dto.direccion,
        monto: dto.monto,
        canal_origen: dto.canal_origen || null,
        notas: dto.notas || null,
        estado: 'INGRESANDO',
      })
      .select('*, clientes(nombre, telefono), productos(nombre, slug)')
      .single();

    if (errPedido) throw errPedido;

    // 4. Descontar 1 del stock
    await db
      .from('productos')
      .update({ stock: producto.stock - 1 })
      .eq('id', dto.producto_id);

    // 5. Registrar en historial
    await db.from('historial_estados').insert({
      pedido_id: pedido.id,
      estado_anterior: null,
      estado_nuevo: 'INGRESANDO',
      nota: 'Pedido creado',
    });

    return pedido;
  }

  /** Editar datos generales del pedido */
  async update(id: string, dto: UpdatePedidoDto) {
    await this.findOne(id);

    const { data, error } = await this.supabase
      .getClient()
      .from('pedidos')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /** Cambiar estado del pedido con validación de transiciones */
  async cambiarEstado(id: string, dto: CambiarEstadoDto) {
    const db = this.supabase.getClient();

    // Obtener pedido actual
    const { data: pedido, error } = await db
      .from('pedidos')
      .select('*, productos(id, stock)')
      .eq('id', id)
      .single();

    if (error || !pedido) {
      throw new NotFoundException(`Pedido con id "${id}" no encontrado`);
    }

    const estadoActual = pedido.estado as string;
    const nuevoEstado = dto.nuevo_estado;

    // Validar transición
    const permitidas = TRANSICIONES_VALIDAS[estadoActual];
    if (!permitidas || !permitidas.includes(nuevoEstado)) {
      throw new BadRequestException(
        `Transición inválida: ${estadoActual} → ${nuevoEstado}. ` +
        `Transiciones permitidas desde ${estadoActual}: ${(permitidas || []).join(', ') || 'ninguna (estado final)'}`,
      );
    }

    // Actualizar estado del pedido
    const { data: pedidoActualizado, error: errUpdate } = await db
      .from('pedidos')
      .update({ estado: nuevoEstado })
      .eq('id', id)
      .select()
      .single();

    if (errUpdate) throw errUpdate;

    // Registrar en historial
    await db.from('historial_estados').insert({
      pedido_id: id,
      estado_anterior: estadoActual,
      estado_nuevo: nuevoEstado,
      nota: dto.nota || null,
    });

    // Si es DEVUELTO → devolver 1 al stock
    if (nuevoEstado === EstadoPedido.DEVUELTO && pedido.productos) {
      await db
        .from('productos')
        .update({ stock: pedido.productos.stock + 1 })
        .eq('id', pedido.productos.id);
    }

    return pedidoActualizado;
  }
}
