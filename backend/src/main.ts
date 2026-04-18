import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);

  // Global prefix para todas las rutas
  app.setGlobalPrefix('api');

  // Habilitar validación global con class-validator
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS: en deploy unificado no es necesario (same-origin). Sólo se activa
  // si FRONTEND_URL está seteada (deploy separado) o en dev para localhost.
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');
  const frontendUrl = configService.get<string>('FRONTEND_URL');
  const origins: string[] = [];

  if (frontendUrl) origins.push(frontendUrl);
  if (nodeEnv !== 'production') origins.push('http://localhost:5173');

  if (origins.length > 0) {
    app.enableCors({ origin: origins, credentials: true });
  }

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`Soporte IH Backend corriendo en puerto ${port}`);
}
bootstrap();
