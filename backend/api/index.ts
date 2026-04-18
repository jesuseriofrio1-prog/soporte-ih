import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { ExpressAdapter } from '@nestjs/platform-express';
import type { INestApplication } from '@nestjs/common';
import type { Request, Response } from 'express';
import express from 'express';

const server = express();
let app: INestApplication | null = null;

async function bootstrap() {
  if (!app) {
    const nestApp = await NestFactory.create(
      AppModule,
      new ExpressAdapter(server),
    );

    nestApp.setGlobalPrefix('api');

    nestApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );

    // CORS:
    // - En el deploy unificado (frontend + backend en el mismo proyecto Vercel)
    //   no hay cross-origin y CORS no es necesario.
    // - Si FRONTEND_URL está seteada (deploy separado o dominio adicional), la
    //   honramos como origen permitido.
    // - En dev permitimos localhost:5173 para `npm run dev:frontend`.
    const isProd = process.env.NODE_ENV === 'production';
    const origins: string[] = [];

    if (process.env.FRONTEND_URL) origins.push(process.env.FRONTEND_URL);
    if (!isProd) origins.push('http://localhost:5173');

    if (origins.length > 0) {
      nestApp.enableCors({ origin: origins, credentials: true });
    }

    await nestApp.init();
    app = nestApp;
  }

  return server;
}

export default async (req: Request, res: Response) => {
  try {
    const instance = await bootstrap();
    instance(req, res);
  } catch (error) {
    console.error('Soporte IH bootstrap error:', error);
    res.status(500).json({ message: 'Error interno del servidor' });
  }
};
