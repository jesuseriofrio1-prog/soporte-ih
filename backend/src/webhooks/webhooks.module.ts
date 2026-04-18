import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { SolicitudesModule } from '../solicitudes/solicitudes.module';
import { WebhooksController } from './webhooks.controller';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [SupabaseModule, SolicitudesModule],
  controllers: [WebhooksController],
  providers: [WebhooksService],
})
export class WebhooksModule {}
