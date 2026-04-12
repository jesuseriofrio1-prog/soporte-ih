import { Controller, Post, Body } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RegisterTokenDto } from './dto/register-token.dto';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('register-token')
  registerToken(@Body() dto: RegisterTokenDto) {
    return this.notificationsService.registerToken(dto.token);
  }

  @Post('check-alertas')
  checkAlertas() {
    return this.notificationsService.checkAlertas();
  }
}
