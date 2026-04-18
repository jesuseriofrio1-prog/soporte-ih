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

export const ESTADO_BADGE: Record<string, string> = {
  PENDIENTE: 'bg-gray-100 text-gray-700',
  CONFIRMADO: 'bg-blue-100 text-blue-700',
  EN_PREPARACION: 'bg-indigo-100 text-indigo-700',
  ENVIADO: 'bg-cyan-100 text-cyan-700',
  EN_RUTA: 'bg-yellow-100 text-yellow-700',
  NOVEDAD: 'bg-orange-100 text-orange-700',
  RETIRO_EN_AGENCIA: 'bg-purple-100 text-purple-700',
  ENTREGADO: 'bg-green-100 text-green-700',
  NO_ENTREGADO: 'bg-red-100 text-red-700',
  DEVUELTO: 'bg-red-200 text-red-800',
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

/** Clases Tailwind para el pill de retención según días. */
export function retencionColor(dias: number): string {
  if (dias < 0) return ''
  if (dias <= 4) return 'text-green-600 bg-green-50 border-green-200'
  if (dias <= 6) return 'text-yellow-600 bg-yellow-50 border-yellow-200'
  return 'text-red-600 bg-red-50 border-red-200'
}

/** Clase del punto indicador (con pulse en estado crítico). */
export function retencionDotColor(dias: number): string {
  if (dias < 0) return ''
  if (dias <= 4) return 'bg-green-500'
  if (dias <= 6) return 'bg-yellow-500'
  return 'bg-red-500 animate-pulse'
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
