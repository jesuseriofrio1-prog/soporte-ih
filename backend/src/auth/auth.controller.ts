import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { randomBytes } from 'crypto';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Public } from './public.decorator';

/**
 * Nombres de cookies centralizados. Mismos valores usa el guard para leer.
 *   - SESSION: HttpOnly; guarda el JWT de Supabase.
 *   - CSRF:    NO HttpOnly; el frontend lo lee y lo reenvía en X-CSRF-Token.
 */
export const COOKIE_SESSION = 'sih_session';
export const COOKIE_CSRF = 'sih_csrf';

/** Opciones base para cookies de sesión (HttpOnly). */
function sessionCookieOpts(maxAgeSeconds: number) {
  const prod = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true as const,
    secure: prod,         // en dev (http://localhost) las cookies "secure" no llegan
    sameSite: 'lax' as const, // suficiente contra CSRF con doble submit + same-origin
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  };
}

/** Opciones para la cookie de CSRF (legible por JS). */
function csrfCookieOpts(maxAgeSeconds: number) {
  const prod = process.env.NODE_ENV === 'production';
  return {
    httpOnly: false as const,
    secure: prod,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  };
}

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/login
   * Devuelve 200 + usuario y setea dos cookies:
   *   sih_session (HttpOnly, contiene el JWT) y sih_csrf (token para doble submit).
   * Rate-limit: 20 intentos / 5 min por IP (anti fuerza bruta, tolerante a typos).
   */
  @Public()
  @Throttle({ default: { ttl: 5 * 60_000, limit: 20 } })
  @Post('login')
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto.email, dto.password);
    const maxAge = result.expires_in ?? 60 * 60; // fallback 1h

    const csrf = randomBytes(32).toString('hex');

    res.cookie(COOKIE_SESSION, result.access_token, sessionCookieOpts(maxAge));
    res.cookie(COOKIE_CSRF, csrf, csrfCookieOpts(maxAge));

    return { user: result.user };
  }

  /**
   * GET /auth/me — valida la cookie de sesión. Responde 200 con el user si
   * el guard la aceptó, o 401 si no. El frontend la usa para saber si el
   * usuario sigue logueado sin guardar nada en localStorage.
   */
  @Get('me')
  me(@Req() req: Request & { user?: { id: string; email?: string } }) {
    if (!req.user) throw new UnauthorizedException();
    return { id: req.user.id, email: req.user.email ?? null };
  }

  /** POST /auth/logout — limpia las cookies, siempre 200. */
  @Public()
  @Post('logout')
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_SESSION, { path: '/' });
    res.clearCookie(COOKIE_CSRF, { path: '/' });
    return { ok: true };
  }
}
