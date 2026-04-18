import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { ImportsController } from './imports.controller';
import { ImportsService } from './imports.service';
import { ProductoMatcherAI } from './producto-matcher';

@Module({
  imports: [SupabaseModule],
  controllers: [ImportsController],
  providers: [ImportsService, ProductoMatcherAI],
})
export class ImportsModule {}
