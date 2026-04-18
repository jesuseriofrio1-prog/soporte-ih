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
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { Public } from '../auth/public.decorator';
import { SolicitudesService, type EstadoSolicitud } from './solicitudes.service';
import { CreateSolicitudPublicDto } from './dto/create-solicitud.dto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ESTADOS_VALIDOS: EstadoSolicitud[] = [
  'PENDIENTE',
  'ENVIADA_A_ROCKET',
  'ENLAZADA',
  'CANCELADA',
];

/**
 * Controlador dual:
 *  - Rutas /public/* son @Public() (sin JWT) con rate-limit estricto.
 *  - Las demás requieren JWT (guard global) y las usa el admin.
 */
@Controller()
export class SolicitudesController {
  constructor(private readonly service: SolicitudesService) {}

  // ─────────────────── Público ───────────────────

  /** GET /api/public/tiendas/:slug → tienda pública (sin UUID) + catálogo */
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @Get('public/tiendas/:slug')
  tiendaPublica(@Param('slug') slug: string) {
    return this.service.tiendaConCatalogo(slug);
  }

  /** GET /api/public/tiendas/:slug/productos/:productoSlug → tienda + producto */
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 60 } })
  @Get('public/tiendas/:slug/productos/:productoSlug')
  productoPublico(
    @Param('slug') slug: string,
    @Param('productoSlug') productoSlug: string,
  ) {
    return this.service.tiendaConProducto(slug, productoSlug);
  }

  /** POST /api/public/tiendas/:slug/solicitudes[?producto=<slug>] → crea */
  @Public()
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @Post('public/tiendas/:slug/solicitudes')
  async crearDesdePublico(
    @Param('slug') slug: string,
    @Query('producto') productoSlug: string | undefined,
    @Body() body: CreateSolicitudPublicDto,
    @Req() req: Request,
  ) {
    // Normaliza cadena vacía a undefined
    const prodSlug = productoSlug && productoSlug.trim() ? productoSlug.trim() : undefined;

    // Detrás de Vercel el IP real viene en x-forwarded-for.
    const xff = (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim();
    const ip = xff || req.ip || null;
    const ua = (req.headers['user-agent'] as string | undefined) ?? null;

    return this.service.crearDesdePublico({
      tiendaSlug: slug,
      productoSlug: prodSlug,
      body,
      ip,
      userAgent: ua,
    });
  }

  // ─────────────────── Admin ───────────────────

  /** GET /api/solicitudes?tienda_id=...&estado=... */
  @Get('solicitudes')
  listar(
    @Query('tienda_id') tiendaId: string,
    @Query('estado') estado?: string,
  ) {
    if (!tiendaId || !UUID_REGEX.test(tiendaId)) {
      throw new BadRequestException('tienda_id es requerido y debe ser UUID válido');
    }
    if (estado && !ESTADOS_VALIDOS.includes(estado as EstadoSolicitud)) {
      throw new BadRequestException(`estado inválido. Valores: ${ESTADOS_VALIDOS.join(', ')}`);
    }
    return this.service.listar(tiendaId, estado as EstadoSolicitud | undefined);
  }

  /** GET /api/solicitudes/stats?tienda_id=... */
  @Get('solicitudes/stats')
  stats(@Query('tienda_id') tiendaId: string) {
    if (!tiendaId || !UUID_REGEX.test(tiendaId)) {
      throw new BadRequestException('tienda_id es requerido y debe ser UUID válido');
    }
    return this.service.stats(tiendaId);
  }

  /** PATCH /api/solicitudes/:id/vincular-rocket  { rocket_order_id } */
  @Patch('solicitudes/:id/vincular-rocket')
  vincularRocket(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { rocket_order_id: string },
  ) {
    if (!body?.rocket_order_id) {
      throw new BadRequestException('rocket_order_id es requerido');
    }
    return this.service.vincularRocket(id, body.rocket_order_id);
  }

  /** PATCH /api/solicitudes/:id/estado  { estado } */
  @Patch('solicitudes/:id/estado')
  cambiarEstado(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { estado: EstadoSolicitud },
  ) {
    if (!body?.estado || !ESTADOS_VALIDOS.includes(body.estado)) {
      throw new BadRequestException(`estado inválido. Valores: ${ESTADOS_VALIDOS.join(', ')}`);
    }
    return this.service.cambiarEstado(id, body.estado);
  }

  /** DELETE /api/solicitudes/:id */
  @Delete('solicitudes/:id')
  eliminar(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.eliminar(id);
  }
}
