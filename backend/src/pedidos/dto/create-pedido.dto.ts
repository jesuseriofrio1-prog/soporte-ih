import {
  IsString,
  IsNotEmpty,
  IsUUID,
  IsNumber,
  IsEnum,
  IsOptional,
  Min,
} from 'class-validator';

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

  @IsUUID('4', { message: 'tienda_id debe ser un UUID válido' })
  tienda_id: string;
}
