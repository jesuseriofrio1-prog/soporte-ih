import {
  IsString,
  IsNumber,
  IsInt,
  IsOptional,
  IsBoolean,
  Min,
} from 'class-validator';

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
}
