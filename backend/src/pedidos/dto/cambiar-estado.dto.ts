import { IsString, IsNotEmpty, IsEnum, IsOptional } from 'class-validator';

export enum EstadoPedido {
  INGRESANDO = 'INGRESANDO',
  EN_TRANSITO = 'EN_TRANSITO',
  EN_AGENCIA = 'EN_AGENCIA',
  EN_REPARTO = 'EN_REPARTO',
  NOVEDAD = 'NOVEDAD',
  ENTREGADO = 'ENTREGADO',
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
