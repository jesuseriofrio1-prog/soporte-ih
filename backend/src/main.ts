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

  // CORS: permitir frontend local y dominio de Vercel
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:5173');
  app.enableCors({
    origin: [frontendUrl, 'http://localhost:5173'],
    credentials: true,
  });

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  console.log(`SKINNA Backend corriendo en puerto ${port}`);
}
bootstrap();
