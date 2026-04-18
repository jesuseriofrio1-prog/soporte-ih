import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { timingSafeEqual } from 'crypto';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { IS_PUBLIC_KEY } from './public.decorator';
import { COOKIE_SESSION, COOKIE_CSRF } from './auth.controller';

/**
 * Guard global. Para rutas marcadas @Public() devuelve true sin validar.
 * Para el resto:
 *  1. Lee el JWT de la cookie HttpOnly `sih_session` (con fallback a
 *     Authorization: Bearer para herramientas tipo curl).
 *  2. Valida el JWT contra Supabase.
 *  3. En mutaciones (POST/PUT/PATCH/DELETE) exige doble-submit CSRF: el
 *     header X-CSRF-Token debe coincidir con la cookie `sih_csrf`. Esto
 *     bloquea ataques cross-site porque otro origin no puede leer la
 *     cookie para copiarla al header.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly authService: AuthService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request & {
      user?: unknown;
      cookies?: Record<string, string>;
    }>();

    // 1) Recoger el token desde cookie o Authorization header (fallback).
    const cookieToken = request.cookies?.[COOKIE_SESSION];
    const authHeader = request.headers['authorization'];
    const bearerToken =
      typeof authHeader === 'string' && authHeader.startsWith('Bearer ')
        ? authHeader.slice(7)
        : null;

    const token = cookieToken || bearerToken;
    if (!token) {
      throw new UnauthorizedException('No autenticado');
    }

    // 2) Validar el JWT.
    const user = await this.authService.validateToken(token);
    request.user = user;

    // 3) CSRF double-submit: sólo para operaciones que mutan estado.
    // Bypass si está usando Authorization header en vez de cookies (API
    // clients no necesitan CSRF — el token no se envía automáticamente).
    const method = request.method.toUpperCase();
    const muta = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
    if (muta && cookieToken) {
      this.verificarCsrf(request);
    }

    return true;
  }

  private verificarCsrf(request: Request & { cookies?: Record<string, string> }) {
    const cookieCsrf = request.cookies?.[COOKIE_CSRF];
    const headerCsrf = request.headers['x-csrf-token'];

    if (!cookieCsrf || typeof headerCsrf !== 'string') {
      throw new ForbiddenException('CSRF token faltante');
    }
    const a = Buffer.from(cookieCsrf, 'utf8');
    const b = Buffer.from(headerCsrf, 'utf8');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new ForbiddenException('CSRF token inválido');
    }
  }
}
