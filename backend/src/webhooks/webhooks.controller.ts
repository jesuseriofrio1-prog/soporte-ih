import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WebhooksService, type RocketWebhookPayload } from './webhooks.service';

/**
 * Endpoints públicos (sin auth JWT) para recibir webhooks y consultar su
 * historial. La autenticación es por secreto-en-URL: Rocket pega en
 *   /api/webhooks/rocket/:secret
 * y comparamos contra ROCKET_WEBHOOK_SECRET. Simple y suficiente para un
 * endpoint write-only que no expone datos sensibles.
 */
@Controller('webhooks')
export class WebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  /** Rocket hace POST aquí cuando cambia el estado de un pedido. */
  @Post('rocket/:secret')
  @Throttle({ default: { ttl: 60000, limit: 120 } })
  async recibirRocket(
    @Param('secret') secret: string,
    @Body() payload: RocketWebhookPayload,
  ) {
    this.verificarSecret(secret);
    const result = await this.webhooks.procesarRocket(payload ?? {});
    // Siempre 200: el service maneja errores internamente para que Rocket
    // no reintente por casos esperados (pedido no encontrado, estado no
    // reconocido).
    return { ok: true, ...result };
  }

  /** Listar últimos N eventos (para la UI de integraciones). */
  @Get('rocket/logs')
  async listarLogs(@Query('limit') limit?: string) {
    const n = limit ? parseInt(limit, 10) : 50;
    return this.webhooks.listarLogs(Number.isFinite(n) ? n : 50);
  }

  private verificarSecret(secret: string) {
    const esperado = process.env.ROCKET_WEBHOOK_SECRET;
    if (!esperado) {
      // Fail-closed: si no configuraron el secreto, rechazamos todo.
      throw new ForbiddenException('Webhook no configurado (falta ROCKET_WEBHOOK_SECRET)');
    }
    if (!secret || secret !== esperado) {
      throw new ForbiddenException('Secreto inválido');
    }
  }
}
