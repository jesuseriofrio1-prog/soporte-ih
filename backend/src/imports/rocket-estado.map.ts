/**
 * Mapeo del campo ESTADO del Excel de Rocket hacia los estados internos
 * de Soporte IH. Rocket usa etiquetas humanas y mezcla mayúsculas; la
 * normalización es a minúsculas + trim.
 */

export type EstadoSoporte =
  | 'PENDIENTE'
  | 'CONFIRMADO'
  | 'EN_PREPARACION'
  | 'ENVIADO'
  | 'EN_RUTA'
  | 'NOVEDAD'
  | 'RETIRO_EN_AGENCIA'
  | 'ENTREGADO'
  | 'NO_ENTREGADO'
  | 'DEVUELTO';

interface MappingResult {
  estado: EstadoSoporte;
  /** Si es true, el importador debe saltar esta fila */
  skip?: boolean;
  /** Si es true, el pedido entra con retencion_inicio = now() */
  aplazado?: boolean;
}

const MAPPING: Record<string, MappingResult> = {
  'pedido nuevo':                          { estado: 'PENDIENTE' },
  'nuevo':                                 { estado: 'PENDIENTE' },
  'pendiente de confirmación':             { estado: 'PENDIENTE' },
  'pendiente de confirmacion':             { estado: 'PENDIENTE' },
  'confirmado - pendiente de preparación': { estado: 'CONFIRMADO' },
  'confirmado - pendiente de preparacion': { estado: 'CONFIRMADO' },
  'confirmado':                            { estado: 'CONFIRMADO' },
  'preparado':                             { estado: 'EN_PREPARACION' },
  'enviado':                               { estado: 'ENVIADO' },
  'en ruta':                               { estado: 'EN_RUTA' },
  'novedad':                               { estado: 'NOVEDAD' },
  'recogida en agencia':                   { estado: 'RETIRO_EN_AGENCIA' },
  'entregado':                             { estado: 'ENTREGADO' },
  'rechazado':                             { estado: 'NO_ENTREGADO' },
  'no confirmable':                        { estado: 'NO_ENTREGADO' },
  'devuelto - en tránsito':                { estado: 'DEVUELTO' },
  'devuelto - en transito':                { estado: 'DEVUELTO' },
  'devuelto - recepcionado en almacén':    { estado: 'DEVUELTO' },
  'devuelto - recepcionado en almacen':    { estado: 'DEVUELTO' },
  'devuelto':                              { estado: 'DEVUELTO' },
  'pedido aplazado':                       { estado: 'PENDIENTE', aplazado: true },
  'aplazado':                              { estado: 'PENDIENTE', aplazado: true },
  'carrito abandonado':                    { estado: 'PENDIENTE', skip: true },
  'duplicado':                             { estado: 'PENDIENTE', skip: true },
};

/**
 * Devuelve el mapeo o null si el estado no se reconoce.
 */
export function mapEstadoRocket(raw: string | null | undefined): MappingResult | null {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  return MAPPING[key] ?? null;
}

/**
 * Infer tipo_entrega a partir del estado.
 */
export function inferTipoEntrega(estadoRaw: string | null | undefined): 'DOMICILIO' | 'AGENCIA' {
  if (!estadoRaw) return 'DOMICILIO';
  return estadoRaw.trim().toLowerCase() === 'recogida en agencia'
    ? 'AGENCIA'
    : 'DOMICILIO';
}
