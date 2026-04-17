import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export enum EstadoPedido {
  PENDIENTE = 'PENDIENTE',
  CONFIRMADO = 'CONFIRMADO',
  EN_PREPARACION = 'EN_PREPARACION',
  ENVIADO = 'ENVIADO',
  EN_RUTA = 'EN_RUTA',
  NOVEDAD = 'NOVEDAD',
  RETIRO_EN_AGENCIA = 'RETIRO_EN_AGENCIA',
  ENTREGADO = 'ENTREGADO',
  NO_ENTREGADO = 'NO_ENTREGADO',
  DEVUELTO = 'DEVUELTO',
}

export class CambiarEstadoDto {
  @IsEnum(EstadoPedido, { message: 'Estado inválido' })
  @IsNotEmpty()
  nuevo_estado: EstadoPedido;

  @IsOptional()
  @IsString()
  nota?: string;
}
