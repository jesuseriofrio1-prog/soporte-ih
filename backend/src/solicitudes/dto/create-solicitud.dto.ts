import {
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
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

  @IsOptional()
  @IsString()
  @MinLength(5)
  @MaxLength(300)
  direccion?: string;

  /** 'DOMICILIO' (default) o 'AGENCIA' (retira en oficina Servientrega). */
  @IsOptional()
  @IsIn(['DOMICILIO', 'AGENCIA'])
  tipo_entrega?: 'DOMICILIO' | 'AGENCIA';

  /** Nombre corto de la agencia elegida (solo si tipo_entrega === 'AGENCIA'). */
  @IsOptional()
  @IsString()
  @MaxLength(120)
  agencia_nombre?: string;

  /** Dirección completa de la agencia Servientrega. */
  @IsOptional()
  @IsString()
  @MaxLength(300)
  agencia_direccion?: string;

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

  /** Latitud WGS84 del punto elegido en el map picker. Opcional. */
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  /** Longitud WGS84 del punto elegido en el map picker. Opcional. */
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  /** Pistas libres para el mensajero ("portón azul, timbre del medio"). */
  @IsOptional()
  @IsString()
  @MaxLength(200)
  direccion_referencia?: string;
}
