import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { normalizarTelefono } from '../common/utils';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Listar clientes con stats de pedidos, búsqueda opcional */
  async findAll(tiendaId: string, q?: string, limit = 100, offset = 0) {
    let query = this.supabase
      .getClient()
      .from('clientes_con_stats')
      .select('*')
      .eq('tienda_id', tiendaId);

    if (q) {
      const sanitized = q.replace(/[%_]/g, '');
      query = query.or(`nombre.ilike.%${sanitized}%,telefono.ilike.%${sanitized}%`);
    }

    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) throw error;
    return data;
  }

  /** Obtener un cliente por ID + sus pedidos */
  async findOne(id: string) {
    const { data: cliente, error } = await this.supabase
      .getClient()
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !cliente) {
      throw new NotFoundException(`Cliente con id "${id}" no encontrado`);
    }

    const { data: pedidos, error: errPedidos } = await this.supabase
      .getClient()
      .from('pedidos')
      .select('*, productos(nombre, slug)')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false });

    if (errPedidos) throw errPedidos;

    return { ...cliente, pedidos: pedidos || [] };
  }

  /** Crear un cliente nuevo */
  async create(dto: CreateClienteDto) {
    dto.telefono = normalizarTelefono(dto.telefono);

    const { data: existente, error: errBusca } = await this.supabase
      .getClient()
      .from('clientes')
      .select('*')
      .eq('telefono', dto.telefono)
      .eq('tienda_id', dto.tienda_id)
      .single();

    if (errBusca && errBusca.code !== 'PGRST116') {
      throw errBusca;
    }

    if (existente) {
      throw new ConflictException({
        message: `Ya existe un cliente con teléfono "${dto.telefono}"`,
        cliente: existente,
      });
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('clientes')
      .insert(dto)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /** Actualizar parcialmente un cliente */
  async update(id: string, dto: UpdateClienteDto) {
    await this.findOne(id);

    if (dto.telefono) {
      dto.telefono = normalizarTelefono(dto.telefono);
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('clientes')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /** Eliminar un cliente */
  async remove(id: string) {
    await this.findOne(id);

    const { error } = await this.supabase
      .getClient()
      .from('clientes')
      .delete()
      .eq('id', id);

    if (error) {
      if (error.code === '23503') {
        throw new ConflictException('No se puede eliminar: el cliente tiene pedidos asociados');
      }
      throw error;
    }

    return { message: 'Cliente eliminado' };
  }
}
