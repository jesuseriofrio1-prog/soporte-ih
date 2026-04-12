import { IsString, IsNotEmpty } from 'class-validator';

export class RegisterTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'El token es requerido' })
  token: string;
}
