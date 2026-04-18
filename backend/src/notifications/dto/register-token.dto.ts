import { IsString, IsNotEmpty, Matches } from 'class-validator';

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class RegisterTokenDto {
  @IsString()
  @IsNotEmpty({ message: 'El token es requerido' })
  token: string;

  /**
   * Tienda con la que se asocia este token. Así las alertas de la tienda
   * A no notifican a un admin mirando la tienda B.
   */
  @IsString()
  @Matches(UUID_REGEX, { message: 'tienda_id debe ser UUID válido' })
  tienda_id: string;
}
