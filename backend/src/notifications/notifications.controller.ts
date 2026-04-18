import { BadRequestException, Body, Controller, Post, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RegisterTokenDto } from './dto/register-token.dto';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register-token')
  registerToken(@Body() dto: RegisterTokenDto) {
    return this.notificationsService.registerToken(dto.token, dto.tienda_id);
  }

  /**
   * Verifica pedidos en riesgo de devolución para `tienda_id` y envía
   * push notifications SÓLO a los tokens asociados a esa tienda. El
   * tienda_id es requerido para evitar notificaciones cruzadas.
   */
  @Post('check-alertas')
  checkAlertas(@Query('tienda_id') tiendaId: string) {
    if (!tiendaId || !UUID_REGEX.test(tiendaId)) {
      throw new BadRequestException('tienda_id es requerido y debe ser UUID válido');
    }
    return this.notificationsService.checkAlertas(tiendaId);
  }
}
