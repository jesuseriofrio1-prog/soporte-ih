import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';

export interface Referido {
  id: string;
  tienda_id: string;
  codigo: string;
  cliente_referente_id: string | null;
  cliente_referente_nombre: string;
  cliente_referente_tel: string | null;
  usos_count: number;
  ultimo_uso_en: string | null;
  notas: string | null;
  activo: boolean;
  created_at: string;
}

export interface ReferidoPublico {
  codigo: string;
  referente_nombre: string;
  valido: boolean;
}

const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // sin 0/1/O/I/L

function generarCodigoBase(nombre: string): string {
  // Primeras 4 letras del primer nombre (si hay) + 4 random
  const clean = nombre.trim().replace(/[^A-Za-zÁÉÍÓÚÑáéíóúñ]/g, '').toUpperCase();
  const prefix = clean.slice(0, 4) || 'REF';
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return `${prefix}-${suffix}`;
}

@Injectable()
export class ReferidosService {
  constructor(private readonly supabase: SupabaseService) {}

  async listar(tiendaId: string): Promise<Referido[]> {
    const { data, error } = await this.supabase
      .getClient()
      .from('referidos')
      .select('*')
      .eq('tienda_id', tiendaId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []) as Referido[];
  }

  /**
   * Crea un código para un cliente. Si no se pasa código explícito, lo
   * genera a partir del nombre + 4 chars random. Reintenta hasta 5 veces
   * si colisiona.
   */
  async crear(params: {
    tienda_id: string;
    cliente_id?: string;
    cliente_nombre: string;
    cliente_tel?: string;
    codigo?: string;
    notas?: string;
  }): Promise<Referido> {
    const db = this.supabase.getClient();

    let codigo = params.codigo?.trim().toUpperCase() ||
      generarCodigoBase(params.cliente_nombre);

    for (let i = 0; i < 5; i++) {
      const { data, error } = await db
        .from('referidos')
        .insert({
          tienda_id: params.tienda_id,
          codigo,
          cliente_referente_id: params.cliente_id ?? null,
          cliente_referente_nombre: params.cliente_nombre,
          cliente_referente_tel: params.cliente_tel ?? null,
          notas: params.notas ?? null,
        })
        .select()
        .single();
      if (!error && data) return data as Referido;
      // 23505: unique violation → regenera el sufijo
      if (error?.code === '23505') {
        codigo = generarCodigoBase(params.cliente_nombre);
        continue;
      }
      throw error;
    }
    throw new BadRequestException('No se pudo generar un código único tras 5 intentos');
  }

  async actualizar(
    id: string,
    tiendaId: string,
    patch: { activo?: boolean; notas?: string | null },
  ): Promise<Referido> {
    const { data: existente, error: errF } = await this.supabase
      .getClient()
      .from('referidos')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (errF) throw errF;
    if (!existente) throw new NotFoundException('Referido no encontrado');
    if (existente.tienda_id !== tiendaId) {
      throw new BadRequestException('Referido no pertenece a la tienda');
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('referidos')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data as Referido;
  }

  async eliminar(id: string, tiendaId: string): Promise<{ ok: true }> {
    const { data: existente, error: errF } = await this.supabase
      .getClient()
      .from('referidos')
      .select('tienda_id')
      .eq('id', id)
      .maybeSingle();
    if (errF) throw errF;
    if (!existente) throw new NotFoundException('Referido no encontrado');
    if (existente.tienda_id !== tiendaId) {
      throw new BadRequestException('Referido no pertenece a la tienda');
    }
    const { error } = await this.supabase
      .getClient()
      .from('referidos')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return { ok: true };
  }

  /** Resuelve tienda.id desde un slug. Null si no existe o inactiva. */
  async resolverTiendaPorSlug(slug: string): Promise<string | null> {
    const { data } = await this.supabase
      .getClient()
      .from('tiendas')
      .select('id')
      .eq('slug', slug)
      .eq('estado', true)
      .maybeSingle();
    return (data as { id?: string })?.id ?? null;
  }

  /**
   * Valida un código en el contexto de una tienda. Devuelve datos
   * públicos mínimos (nombre del referente) para mostrar en el form
   * público. Se usa para confirmarle al cliente "Has sido referido por X".
   */
  async validarPublico(tiendaId: string, codigo: string): Promise<ReferidoPublico> {
    const codigoNorm = codigo.trim().toUpperCase();
    const { data, error } = await this.supabase
      .getClient()
      .from('referidos')
      .select('codigo, cliente_referente_nombre, activo')
      .eq('tienda_id', tiendaId)
      .eq('codigo', codigoNorm)
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.activo) {
      return { codigo: codigoNorm, referente_nombre: '', valido: false };
    }
    return {
      codigo: data.codigo,
      referente_nombre: data.cliente_referente_nombre,
      valido: true,
    };
  }

  /**
   * Incrementa el contador de usos cuando entra una solicitud. No falla
   * si el código no existe (se ignora silenciosamente — el código se
   * guarda en la solicitud igual para trazabilidad manual).
   */
  async registrarUso(tiendaId: string, codigo: string): Promise<void> {
    const codigoNorm = codigo.trim().toUpperCase();
    const db = this.supabase.getClient();
    const { data: ref } = await db
      .from('referidos')
      .select('id, usos_count')
      .eq('tienda_id', tiendaId)
      .eq('codigo', codigoNorm)
      .maybeSingle();
    if (!ref) return;
    await db
      .from('referidos')
      .update({
        usos_count: (ref.usos_count as number) + 1,
        ultimo_uso_en: new Date().toISOString(),
      })
      .eq('id', ref.id);
  }
}
