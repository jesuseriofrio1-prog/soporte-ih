import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';

@Injectable()
export class ProductosService {
  constructor(private readonly supabase: SupabaseService) {}

  /** Listar productos, filtrado por tienda y activo (default true) */
  async findAll(tiendaId: string, activo?: boolean) {
    let query = this.supabase.getClient().from('productos').select('*').eq('tienda_id', tiendaId);

    if (activo !== undefined) {
      query = query.eq('activo', activo);
    }

    const { data, error } = await query.order('created_at', {
      ascending: false,
    });

    if (error) throw error;
    return data;
  }

  /** Obtener un producto por ID */
  async findOne(id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('productos')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Producto con id "${id}" no encontrado`);
    }

    return data;
  }

  /** Crear un producto nuevo */
  async create(dto: CreateProductoDto) {
    // Verificar que el slug no exista en la misma tienda
    const { data: existente, error: errBusca } = await this.supabase
      .getClient()
      .from('productos')
      .select('id')
      .eq('slug', dto.slug)
      .eq('tienda_id', dto.tienda_id)
      .single();

    if (errBusca && errBusca.code !== 'PGRST116') {
      throw errBusca;
    }

    if (existente) {
      throw new ConflictException(`Ya existe un producto con slug "${dto.slug}"`);
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('productos')
      .insert(dto)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /** Actualizar parcialmente un producto */
  async update(id: string, dto: UpdateProductoDto) {
    // Verificar que existe
    await this.findOne(id);

    const { data, error } = await this.supabase
      .getClient()
      .from('productos')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /** Soft delete: poner activo=false */
  async remove(id: string) {
    // Verificar que existe
    await this.findOne(id);

    const { data, error } = await this.supabase
      .getClient()
      .from('productos')
      .update({ activo: false })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
