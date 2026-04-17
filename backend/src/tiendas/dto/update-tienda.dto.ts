import { IsString, IsOptional, IsBoolean } from 'class-validator';

export class UpdateTiendaDto {
  @IsOptional()
  @IsString()
  nombre?: string;

  @IsOptional()
  @IsBoolean()
  estado?: boolean;

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
