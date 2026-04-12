import { IsString, IsOptional, IsInt, Min } from 'class-validator';

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
}
