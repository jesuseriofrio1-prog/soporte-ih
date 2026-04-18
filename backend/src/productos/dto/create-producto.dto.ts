import {
  IsBoolean,
  IsString,
  IsNotEmpty,
  IsNumber,
  IsInt,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class CreateProductoDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  nombre: string;

  @IsString()
  @IsNotEmpty({ message: 'El slug es requerido' })
  @Matches(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, {
    message: 'El slug debe ser lowercase, sin espacios (ej: serum-hidra)',
  })
  slug: string;

  @IsNumber({}, { message: 'El precio debe ser un número' })
  @Min(0, { message: 'El precio no puede ser negativo' })
  precio: number;

  @IsInt({ message: 'El stock debe ser un número entero' })
  @Min(0, { message: 'El stock no puede ser negativo' })
  stock: number;

  @IsOptional()
  @IsString()
  icono?: string;

  /** Costo unitario total (fábrica + flete). Opcional: si está vacío, no se calcula margen. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'costo_unitario debe ser numérico' })
  @Min(0, { message: 'costo_unitario no puede ser negativo' })
  costo_unitario?: number;

  /** Fee Rocket promedio por unidad de este producto. Opcional. */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'fee_envio debe ser numérico' })
  @Min(0, { message: 'fee_envio no puede ser negativo' })
  fee_envio?: number;

  /** Si true, este producto es un bundle (upgrade de otro producto base). */
  @IsOptional()
  @IsBoolean()
  es_bundle?: boolean;

  /** UUID del producto "base" que dispara la sugerencia de este bundle. */
  @IsOptional()
  @Matches(UUID_REGEX, { message: 'bundle_upgrade_desde debe ser UUID' })
  bundle_upgrade_desde?: string;

  @IsString()
  @IsNotEmpty({ message: 'tienda_id es requerido' })
  tienda_id: string;
}
