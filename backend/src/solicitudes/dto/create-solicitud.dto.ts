import {
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Body que envía el formulario público. La tienda y el producto van por
 * path (slug), así que aquí sólo llegan los datos del cliente.
 */
export class CreateSolicitudPublicDto {
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  cliente_nombre!: string;

  @IsString()
  @MinLength(7)
  @MaxLength(20)
  cliente_telefono!: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  cliente_email?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  provincia?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  ciudad?: string;

  @IsString()
  @MinLength(5)
  @MaxLength(300)
  direccion!: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(99)
  cantidad?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  notas?: string;

  /** Si el form es catálogo-general, el cliente elige el producto. */
  @IsOptional()
  @Matches(UUID_REGEX, { message: 'producto_id debe ser UUID válido' })
  producto_id?: string;

  /** Código de referido capturado del URL (?ref=XYZ). Opcional. */
  @IsOptional()
  @IsString()
  @MaxLength(30)
  referido_codigo?: string;
}
