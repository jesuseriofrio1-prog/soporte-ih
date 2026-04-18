import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
  Matches,
} from 'class-validator';

/**
 * Regex para UUID genérico (no exige versión v4). Aceptamos el formato de UUID
 * canónico sin verificar el dígito de versión porque el seed de la tienda por
 * defecto usa `00000000-0000-0000-0000-000000000001` (no es v4).
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export enum TipoEntrega {
  DOMICILIO = 'DOMICILIO',
  AGENCIA = 'AGENCIA',
}

export class CreatePedidoDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre del cliente es requerido' })
  cliente_nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El teléfono del cliente es requerido' })
  cliente_telefono: string;

  @IsString()
  @IsNotEmpty({ message: 'producto_id es requerido' })
  producto_id: string;

  @IsString()
  @IsNotEmpty({ message: 'La guía es requerida' })
  guia: string;

  @IsEnum(TipoEntrega, { message: 'tipo_entrega debe ser DOMICILIO o AGENCIA' })
  tipo_entrega: TipoEntrega;

  @IsString()
  @IsNotEmpty({ message: 'La dirección es requerida' })
  direccion: string;

  @IsNumber({}, { message: 'El monto debe ser un número' })
  @Min(0, { message: 'El monto no puede ser negativo' })
  monto: number;

  @IsOptional()
  @IsString()
  canal_origen?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @Matches(UUID_REGEX, { message: 'tienda_id debe ser un UUID válido' })
  tienda_id: string;
}
