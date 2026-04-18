/**
 * Helpers de presentación para pedidos: labels, badges, retención.
 * Son funciones puras y constantes — nada de estado reactivo aquí.
 */

export const ESTADOS_DISPONIBLES: { value: string; label: string }[] = [
  { value: '', label: 'Todos los estados' },
  { value: 'PENDIENTE', label: 'Pendiente' },
  { value: 'CONFIRMADO', label: 'Confirmado' },
  { value: 'EN_PREPARACION', label: 'En Preparación' },
  { value: 'ENVIADO', label: 'Enviado' },
  { value: 'EN_RUTA', label: 'En Ruta' },
  { value: 'NOVEDAD', label: 'Novedad' },
  { value: 'RETIRO_EN_AGENCIA', label: 'Retiro en Agencia' },
  { value: 'ENTREGADO', label: 'Entregado' },
  { value: 'NO_ENTREGADO', label: 'No Entregado' },
  { value: 'DEVUELTO', label: 'Devuelto' },
]

export const ESTADO_LABELS: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Confirmado',
  EN_PREPARACION: 'En Preparación',
  ENVIADO: 'Enviado',
  EN_RUTA: 'En Ruta',
  NOVEDAD: 'Novedad',
  RETIRO_EN_AGENCIA: 'Retiro en Agencia',
  ENTREGADO: 'Entregado',
  NO_ENTREGADO: 'No Entregado',
  DEVUELTO: 'Devuelto',
}

/**
 * Pills para cada estado usando tokens CSS del design system (adaptivos a
 * dark mode). Solo tenemos 4 colores de pill (emerald/amber/blue/rose), así
 * que agrupamos estados por "tono" lógico:
 *  - gris/pendiente: bg neutral
 *  - azul (en progreso): CONFIRMADO, EN_PREPARACION, ENVIADO, EN_RUTA
 *  - amber (requiere atención): NOVEDAD, RETIRO_EN_AGENCIA
 *  - emerald (éxito): ENTREGADO
 *  - rose (fracaso): NO_ENTREGADO, DEVUELTO
 */
export const ESTADO_BADGE: Record<string, string> = {
  PENDIENTE: 'bg-paper-alt text-ink-muted',
  CONFIRMADO: 'pill-blue',
  EN_PREPARACION: 'pill-blue',
  ENVIADO: 'pill-blue',
  EN_RUTA: 'pill-blue',
  NOVEDAD: 'pill-amber',
  RETIRO_EN_AGENCIA: 'pill-amber',
  ENTREGADO: 'pill-emerald',
  NO_ENTREGADO: 'pill-rose',
  DEVUELTO: 'pill-rose',
}

/** Prioridad para ordenar por flujo lógico del pedido (no alfabético). */
export const ESTADO_PRIORIDAD: Record<string, number> = {
  PENDIENTE: 1,
  CONFIRMADO: 2,
  EN_PREPARACION: 3,
  ENVIADO: 4,
  EN_RUTA: 5,
  RETIRO_EN_AGENCIA: 6,
  NOVEDAD: 7,
  NO_ENTREGADO: 8,
  ENTREGADO: 9,
  DEVUELTO: 10,
}

export function getEstadoPrioridad(estado: string): number {
  return ESTADO_PRIORIDAD[estado] ?? 5
}

/** Días transcurridos desde el inicio de la retención. -1 si no aplica. */
export function diasRetencion(retencionInicio: string | null): number {
  if (!retencionInicio) return -1
  const inicio = new Date(retencionInicio).getTime()
  return Math.floor((Date.now() - inicio) / (1000 * 60 * 60 * 24))
}

/** Clases para el pill de retención según días (tokens del design system). */
export function retencionColor(dias: number): string {
  if (dias < 0) return ''
  if (dias <= 4) return 'pill-emerald border hairline'
  if (dias <= 6) return 'pill-amber border hairline'
  return 'pill-rose border hairline'
}

/** Clase del punto indicador (con pulse en estado crítico). */
export function retencionDotColor(dias: number): string {
  if (dias < 0) return ''
  if (dias <= 4) return 'dot-emerald'
  if (dias <= 6) return 'dot-amber'
  return 'dot-rose animate-pulse'
}

/** True si la fila debe resaltarse en rojo en la tabla. */
export function filaAlerta(estado: string, diasEnAgencia: number): boolean {
  return (
    estado === 'NOVEDAD' ||
    estado === 'NO_ENTREGADO' ||
    (estado === 'RETIRO_EN_AGENCIA' && diasEnAgencia >= 6)
  )
}

/** Fecha corta: "15 abr" */
export function formatFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })
}

/** Fecha larga: "15 abr 2026" */
export function formatFechaLarga(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-EC', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}
