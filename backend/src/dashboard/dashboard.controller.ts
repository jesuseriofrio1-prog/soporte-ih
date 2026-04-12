import { Controller, Get } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('stats')
  getStats() {
    return this.dashboardService.getStats();
  }

  @Get('ventas-semana')
  getVentasSemana() {
    return this.dashboardService.getVentasSemana();
  }

  @Get('canales')
  getCanalesStats() {
    return this.dashboardService.getCanalesStats();
  }
}
