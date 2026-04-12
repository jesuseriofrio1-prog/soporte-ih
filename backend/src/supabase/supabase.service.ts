import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private client: SupabaseClient;

  constructor(private configService: ConfigService) {
    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceKey = this.configService.get<string>('SUPABASE_SERVICE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Faltan las variables SUPABASE_URL o SUPABASE_SERVICE_KEY en .env');
    }

    this.client = createClient(supabaseUrl, supabaseServiceKey);
  }

  /** Retorna el cliente de Supabase con permisos de service_role */
  getClient(): SupabaseClient {
    return this.client;
  }
}
