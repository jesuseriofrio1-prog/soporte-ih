import { IsString, IsOptional, IsInt, IsNumber, Min } from 'class-validator';

export class UpdatePedidoDto {
  @IsOptional()
  @IsString()
  direccion?: string;

  @IsOptional()
  @IsString()
  notas?: string;

  @IsOptional()
  @IsInt({ message: 'dias_en_agencia debe ser un número entero' })
  @Min(0)
  dias_en_agencia?: number;

  @IsOptional()
  @IsString()
  guia?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  monto?: number;

  @IsOptional()
  @IsString()
  cliente_nombre?: string;

  @IsOptional()
  @IsString()
  cliente_telefono?: string;
}
