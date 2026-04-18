import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { SupabaseModule } from './supabase/supabase.module';
import { ProductosModule } from './productos/productos.module';
import { ClientesModule } from './clientes/clientes.module';
import { PedidosModule } from './pedidos/pedidos.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/auth.guard';
import { NotificationsModule } from './notifications/notifications.module';
import { TiendasModule } from './tiendas/tiendas.module';
import { TrackingModule } from './tracking/tracking.module';
import { ImportsModule } from './imports/imports.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { SolicitudesModule } from './solicitudes/solicitudes.module';

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
    WebhooksModule,
    SolicitudesModule,
  ],
  controllers: [AppController],
  providers: [
    // Guard global: todas las rutas requieren JWT salvo las marcadas @Public()
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
