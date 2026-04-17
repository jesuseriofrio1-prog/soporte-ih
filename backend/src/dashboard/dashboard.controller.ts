import { Controller, Get, Query } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getStats(@Query('tienda_id') tienda_id: string) {
    return this.dashboardService.getStats(tienda_id);
  }

  @Get('ventas-semana')
  getVentasSemana(@Query('tienda_id') tienda_id: string) {
    return this.dashboardService.getVentasSemana(tienda_id);
  }

  @Get('canales')
  getCanalesStats(@Query('tienda_id') tienda_id: string) {
    return this.dashboardService.getCanalesStats(tienda_id);
  }

  @Get('storage')
  getDbSize() {
    return this.dashboardService.getDbSize();
  }
}
