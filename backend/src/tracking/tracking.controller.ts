import { Controller, Post, Query } from '@nestjs/common';
import { TrackingService } from './tracking.service';

@Controller('tracking')
export class TrackingController {
  constructor(private readonly trackingService: TrackingService) {}

  @Post('sincronizar')
  sincronizar(@Query('tienda_id') tienda_id: string) {
    return this.trackingService.sincronizarTienda(tienda_id);
  }
}
