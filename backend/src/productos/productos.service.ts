import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import { CreateProductoDto } from './dto/create-producto.dto';
import { UpdateProductoDto } from './dto/update-producto.dto';

const FOTOS_BUCKET = 'producto-fotos';
const MIME_ALLOWED = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);
const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

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
      .maybeSingle();

    if (errBusca) {
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

  /**
   * Sube una foto del producto al bucket `producto-fotos` y guarda la
   * URL pública en la columna. Reemplaza cualquier foto previa (borra
   * el archivo viejo si existía).
   */
  async subirFoto(
    productoId: string,
    file: { buffer: Buffer; mimetype: string; size: number },
  ): Promise<{ foto_url: string }> {
    if (!file?.buffer) {
      throw new BadRequestException('Archivo no provisto');
    }
    if (!MIME_ALLOWED.has(file.mimetype)) {
      throw new BadRequestException(
        `Formato no permitido (${file.mimetype}). Sólo JPG, PNG, WebP o GIF.`,
      );
    }
    if (file.size > MAX_SIZE) {
      throw new BadRequestException('La imagen supera 5 MB');
    }

    const producto = await this.findOne(productoId);
    const ext = EXT_BY_MIME[file.mimetype];
    // Path estable por producto: cache-buster con timestamp en query.
    const path = `${producto.tienda_id}/${productoId}.${ext}`;

    const storage = this.supabase.getClient().storage.from(FOTOS_BUCKET);

    // Borra fotos previas de otras extensiones (jpg vs png).
    if (producto.foto_url) {
      const oldPaths = Object.values(EXT_BY_MIME)
        .map((e) => `${producto.tienda_id}/${productoId}.${e}`)
        .filter((p) => p !== path);
      await storage.remove(oldPaths).catch(() => {
        /* silencioso — si no existía no pasa nada */
      });
    }

    const { error: upErr } = await storage.upload(path, file.buffer, {
      contentType: file.mimetype,
      upsert: true,
      cacheControl: '3600',
    });
    if (upErr) throw new BadRequestException(`Error subiendo: ${upErr.message}`);

    const { data: pub } = storage.getPublicUrl(path);
    // Cache-buster para forzar refresh en navegadores tras reemplazar.
    const foto_url = `${pub.publicUrl}?v=${Date.now()}`;

    const { error } = await this.supabase
      .getClient()
      .from('productos')
      .update({ foto_url })
      .eq('id', productoId);
    if (error) throw error;

    return { foto_url };
  }

  /** Borra la foto del producto (storage + DB). */
  async borrarFoto(productoId: string): Promise<{ ok: true }> {
    const producto = await this.findOne(productoId);
    if (!producto.foto_url) return { ok: true };

    const storage = this.supabase.getClient().storage.from(FOTOS_BUCKET);
    const paths = Object.values(EXT_BY_MIME).map(
      (e) => `${producto.tienda_id}/${productoId}.${e}`,
    );
    await storage.remove(paths).catch(() => {
      /* silencioso */
    });

    const { error } = await this.supabase
      .getClient()
      .from('productos')
      .update({ foto_url: null })
      .eq('id', productoId);
    if (error) throw error;
    return { ok: true };
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
