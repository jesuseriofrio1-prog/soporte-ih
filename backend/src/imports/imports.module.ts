import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { SolicitudesModule } from '../solicitudes/solicitudes.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { ProductoMatcherAI } from './producto-matcher';

@Module({
  imports: [SupabaseModule, SolicitudesModule],
  controllers: [ImportsController],
  providers: [ImportsService, ProductoMatcherAI],
})
export class ImportsModule {}
