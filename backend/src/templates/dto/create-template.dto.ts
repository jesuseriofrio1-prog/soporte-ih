import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const CATEGORIAS = [
  'envio',
  'tracking',
  'novedad',
  'alerta',
  'upsell',
  'referido',
  'general',
  'libre',
] as const;
export type CategoriaTemplate = (typeof CATEGORIAS)[number];

export class CreateTemplateDto {
  @IsString()
  @Matches(UUID_REGEX, { message: 'tienda_id debe ser UUID válido' })
  tienda_id!: string;

  /** slug único por tienda, lowercase con guiones. */
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'slug debe ser lowercase separado por guiones',
  })
  slug!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  mensaje!: string;

  @IsOptional()
  @IsEnum(CATEGORIAS)
  categoria?: CategoriaTemplate;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class UpdateTemplateDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  nombre?: string;

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(2000)
  mensaje?: string;

  @IsOptional()
  @IsEnum(CATEGORIAS)
  categoria?: CategoriaTemplate;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}
