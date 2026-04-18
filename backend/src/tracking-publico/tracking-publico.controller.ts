import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../auth/public.decorator';
import { TrackingPublicoService } from './tracking-publico.service';

@Controller()
export class TrackingPublicoController {
  constructor(private readonly service: TrackingPublicoService) {}

  /**
   * GET /api/public/tracking/:code
   * Endpoint público (sin auth). Rate-limit 120/min para prevenir
   * enumeración, aunque el espacio de códigos es de 32^8 (~1T).
   */
  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @Get('public/tracking/:code')
  obtener(@Param('code') code: string) {
    const norm = (code ?? '').trim().toLowerCase();
    if (!/^[a-z0-9]{6,12}$/.test(norm)) {
      throw new BadRequestException('Código de seguimiento inválido');
    }
    return this.service.obtener(norm);
  }
}
