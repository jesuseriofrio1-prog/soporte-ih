import {
  IsString,
  IsNumber,
  IsInt,
  IsOptional,
  IsBoolean,
  Matches,
  Min,
  ValidateIf,
} from 'class-validator';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class UpdateProductoDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsNumber({}, { message: 'El precio debe ser un número' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  precio?: number;

  @IsOptional()
  @IsInt({ message: 'El stock debe ser un número entero' })
  @Min(0, { message: 'El stock no puede ser negativo' })
  stock?: number;

  @IsOptional()
  @IsString()
  icono?: string;

  @IsOptional()
  @IsBoolean()
  activo?: boolean;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'costo_unitario debe ser numérico' })
  @Min(0)
  costo_unitario?: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'fee_envio debe ser numérico' })
  @Min(0)
  fee_envio?: number;

  @IsOptional()
  @IsBoolean()
  es_bundle?: boolean;

  /** Nullable explícito: enviar null para desvincular el bundle del base. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @Matches(UUID_REGEX, { message: 'bundle_upgrade_desde debe ser UUID o null' })
  bundle_upgrade_desde?: string | null;
}
