import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { SupabaseModule } from './supabase/supabase.module';
import { ProductosModule } from './productos/productos.module';
import { ClientesModule } from './clientes/clientes.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthModule } from './auth/auth.module';
import { NotificationsModule } from './notifications/notifications.module';
import { TiendasModule } from './tiendas/tiendas.module';
import { TrackingModule } from './tracking/tracking.module';
import { ImportsModule } from './imports/imports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 60,
    }]),
    SupabaseModule,
    AuthModule,
    ProductosModule,
    ClientesModule,
    PedidosModule,
    DashboardModule,
    NotificationsModule,
    TiendasModule,
    TrackingModule,
    ImportsModule,
  ],
  controllers: [AppController],
  providers: [],
})
export class AppModule {}
