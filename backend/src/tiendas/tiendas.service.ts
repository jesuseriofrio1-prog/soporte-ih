import { Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateTiendaDto } from './dto/create-tienda.dto';
import { UpdateTiendaDto } from './dto/update-tienda.dto';

@Injectable()
export class TiendasService {
  constructor(private readonly supabase: SupabaseService) {}

  async findAll() {
    const { data, error } = await this.supabase
      .getClient()
      .from('tiendas')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data;
  }

  async findOne(id: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('tiendas')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) {
      throw new NotFoundException(`Tienda con id "${id}" no encontrada`);
    }
    return data;
  }

  async create(dto: CreateTiendaDto) {
    const { data, error } = await this.supabase
      .getClient()
      .from('tiendas')
      .insert(dto)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async update(id: string, dto: UpdateTiendaDto) {
    await this.findOne(id);

    const { data, error } = await this.supabase
      .getClient()
      .from('tiendas')
      .update(dto)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
