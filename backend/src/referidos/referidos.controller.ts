import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { ReferidosService } from './referidos.service';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller()
export class ReferidosController {
  constructor(private readonly service: ReferidosService) {}

  // ─────────── Admin ───────────

  @Get('referidos')
  listar(@Query('tienda_id') tiendaId: string) {
    if (!tiendaId || !UUID_REGEX.test(tiendaId)) {
      throw new BadRequestException('tienda_id es requerido y debe ser UUID válido');
    }
    return this.service.listar(tiendaId);
  }

  @Post('referidos')
  crear(
    @Body()
    body: {
      tienda_id: string;
      cliente_id?: string;
      cliente_nombre: string;
      cliente_tel?: string;
      codigo?: string;
      notas?: string;
    },
  ) {
    if (!body?.tienda_id || !UUID_REGEX.test(body.tienda_id)) {
      throw new BadRequestException('tienda_id es requerido y debe ser UUID válido');
    }
    if (!body.cliente_nombre || body.cliente_nombre.trim().length < 2) {
      throw new BadRequestException('cliente_nombre es requerido (≥2 chars)');
    }
    if (body.cliente_id && !UUID_REGEX.test(body.cliente_id)) {
      throw new BadRequestException('cliente_id debe ser UUID válido');
    }
    return this.service.crear({
      tienda_id: body.tienda_id,
      cliente_id: body.cliente_id,
      cliente_nombre: body.cliente_nombre,
      cliente_tel: body.cliente_tel,
      codigo: body.codigo,
      notas: body.notas,
    });
  }

  @Patch('referidos/:id')
  actualizar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tienda_id') tiendaId: string,
    @Body() body: { activo?: boolean; notas?: string | null },
  ) {
    if (!tiendaId || !UUID_REGEX.test(tiendaId)) {
      throw new BadRequestException('tienda_id es requerido y debe ser UUID válido');
    }
    return this.service.actualizar(id, tiendaId, body);
  }

  @Delete('referidos/:id')
  eliminar(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tienda_id') tiendaId: string,
  ) {
    if (!tiendaId || !UUID_REGEX.test(tiendaId)) {
      throw new BadRequestException('tienda_id es requerido y debe ser UUID válido');
    }
    return this.service.eliminar(id, tiendaId);
  }

  // ─────────── Público ───────────

  /**
   * Valida un código de referido público. Sólo expone el nombre del
   * referente — para mostrar "Has sido referido por X" en el form.
   */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @Get('public/tiendas/:slug/referidos/:codigo')
  async validarPublico(
    @Param('slug') slug: string,
    @Param('codigo') codigo: string,
  ) {
    const tiendaId = await this.service.resolverTiendaPorSlug(slug);
    if (!tiendaId) {
      return { codigo, referente_nombre: '', valido: false };
    }
    return this.service.validarPublico(tiendaId, codigo);
  }
}
