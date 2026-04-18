import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { ReferidosController } from './referidos.controller';
import { ReferidosService } from './referidos.service';

@Module({
  imports: [SupabaseModule],
  controllers: [ReferidosController],
  providers: [ReferidosService],
  exports: [ReferidosService],
})
export class ReferidosModule {}
