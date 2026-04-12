import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Decorador para marcar rutas que no requieren autenticación */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
