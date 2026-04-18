import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TrackingPublicoController } from './tracking-publico.controller';
import { TrackingPublicoService } from './tracking-publico.service';

@Module({
  imports: [SupabaseModule],
  controllers: [TrackingPublicoController],
  providers: [TrackingPublicoService],
})
export class TrackingPublicoModule {}
