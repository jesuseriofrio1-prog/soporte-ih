import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { DireccionesService } from './direcciones.service';

@Controller('direcciones')
export class DireccionesController {
  constructor(private readonly service: DireccionesService) {}

  /**
   * Parsea un texto libre de dirección. Rate-limit aplicado (60/min)
   * porque cada request cuesta una llamada a Claude Haiku.
   */
  @Post('parse')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  async parse(@Body() body: { texto?: string }) {
    const texto = typeof body?.texto === 'string' ? body.texto : '';
    if (!texto.trim()) {
      throw new BadRequestException('`texto` es requerido');
    }
    if (texto.length > 500) {
      throw new BadRequestException('Dirección demasiado larga (>500 caracteres)');
    }
    return this.service.parse(texto);
  }
}
