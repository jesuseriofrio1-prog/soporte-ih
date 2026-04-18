import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { CreateTemplateDto, UpdateTemplateDto } from './dto/create-template.dto';

export interface WhatsAppTemplate {
  id: string;
  tienda_id: string;
  slug: string;
  nombre: string;
  mensaje: string;
  categoria: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * CRUD + render de plantillas de WhatsApp.
 * El render reemplaza {variables} por sus valores; variables sin valor
 * se dejan visibles en el texto para que el admin vea qué falta.
 */
@Injectable()
export class TemplatesService {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(tiendaId: string, soloActivos = false): Promise<WhatsAppTemplate[]> {
    let q = this.supabase
      .getClient()
      .from('whatsapp_templates')
      .select('*')
      .eq('tienda_id', tiendaId)
      .order('categoria', { ascending: true })
      .order('nombre', { ascending: true });
    if (soloActivos) q = q.eq('activo', true);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []) as WhatsAppTemplate[];
  }

  async obtener(id: string): Promise<WhatsAppTemplate> {
    const { data, error } = await this.supabase
      .getClient()
      .from('whatsapp_templates')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    if (!data) throw new NotFoundException('Plantilla no encontrada');
    return data as WhatsAppTemplate;
  }

  async crear(dto: CreateTemplateDto): Promise<WhatsAppTemplate> {
    const { data, error } = await this.supabase
      .getClient()
      .from('whatsapp_templates')
      .insert({
        tienda_id: dto.tienda_id,
        slug: dto.slug,
        nombre: dto.nombre,
        mensaje: dto.mensaje,
        categoria: dto.categoria ?? 'general',
        activo: dto.activo ?? true,
      })
      .select()
      .single();
    if (error) {
      if (error.code === '23505') {
        throw new BadRequestException(
          `Ya existe una plantilla con slug "${dto.slug}" en esta tienda`,
        );
      }
      throw error;
    }
    return data as WhatsAppTemplate;
  }

  async actualizar(id: string, tiendaId: string, dto: UpdateTemplateDto): Promise<WhatsAppTemplate> {
    // Validamos ownership antes del update para no permitir cross-tienda
    const existente = await this.obtener(id);
    if (existente.tienda_id !== tiendaId) {
      throw new BadRequestException('La plantilla no pertenece a la tienda indicada');
    }

    const patch: Record<string, unknown> = {};
    if (dto.nombre !== undefined) patch.nombre = dto.nombre;
    if (dto.mensaje !== undefined) patch.mensaje = dto.mensaje;
    if (dto.categoria !== undefined) patch.categoria = dto.categoria;
    if (dto.activo !== undefined) patch.activo = dto.activo;

    if (Object.keys(patch).length === 0) return existente;

    const { data, error } = await this.supabase
      .getClient()
      .from('whatsapp_templates')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as WhatsAppTemplate;
  }

  async eliminar(id: string, tiendaId: string): Promise<{ ok: true }> {
    const existente = await this.obtener(id);
    if (existente.tienda_id !== tiendaId) {
      throw new BadRequestException('La plantilla no pertenece a la tienda indicada');
    }
    const { error } = await this.supabase
      .getClient()
      .from('whatsapp_templates')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { ok: true };
  }

  /**
   * Renderiza el mensaje reemplazando {variables}. Variables sin valor
   * se mantienen en el texto para que el admin note qué le falta.
   */
  render(mensaje: string, variables: Record<string, string | number | null | undefined>): string {
    return mensaje.replace(/\{(\w+)\}/g, (match, key: string) => {
      const v = variables[key];
      if (v === undefined || v === null || v === '') return match;
      return String(v);
    });
  }
}
