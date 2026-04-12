import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateClienteDto } from './dto/create-cliente.dto';
import { UpdateClienteDto } from './dto/update-cliente.dto';

@Injectable()
export class ClientesService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Normalizar teléfono: quitar espacios/guiones, 0 inicial → 593 */
  private normalizarTelefono(telefono: string): string {
    let limpio = telefono.replace(/[\s\-]/g, '');
    if (limpio.startsWith('0')) {
      limpio = '593' + limpio.slice(1);
    }
    return limpio;
  }

  /** Listar clientes, con búsqueda opcional por nombre o teléfono */
  async findAll(q?: string) {
    let query = this.supabase
      .getClient()
      .from('clientes')
      .select('*');

    if (q) {
      query = query.or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%`);
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

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

    // Obtener pedidos del cliente con datos del producto
    const { data: pedidos } = await this.supabase
      .getClient()
      .from('pedidos')
      .select('*, productos(nombre, slug)')
      .eq('cliente_id', id)
      .order('created_at', { ascending: false });

    return { ...cliente, pedidos: pedidos || [] };
  }

  /** Crear un cliente nuevo */
  async create(dto: CreateClienteDto) {
    dto.telefono = this.normalizarTelefono(dto.telefono);

    // Verificar si el teléfono ya existe
    const { data: existente } = await this.supabase
      .getClient()
      .from('clientes')
      .select('*')
      .eq('telefono', dto.telefono)
      .single();

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
      dto.telefono = this.normalizarTelefono(dto.telefono);
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
}
