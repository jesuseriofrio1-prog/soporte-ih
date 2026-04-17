import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateTiendaDto {
  @IsString()
  @IsNotEmpty({ message: 'El nombre es requerido' })
  nombre: string;

  @IsOptional()
  @IsString()
  logo_url?: string;

  @IsOptional()
  @IsString()
  color_primario?: string;

  @IsOptional()
  @IsString()
  color_secundario?: string;

  @IsOptional()
  @IsString()
  color_fondo?: string;

  @IsOptional()
  @IsString()
  color_borde?: string;
}
