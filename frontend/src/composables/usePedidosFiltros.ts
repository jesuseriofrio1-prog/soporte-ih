import { ref, computed, type Ref } from 'vue'
import type { Pedido } from '../services/pedidosService'
import { getEstadoPrioridad } from './usePedidoEstado'

/**
 * Composable de filtros y ordenamiento para la vista de pedidos.
 * Maneja estado reactivo (chips, dropdowns, sort) y expone la lista
 * filtrada + ordenada como computed.
 */

export type AntiguedadKey =
  | 'todos'
  | 'hoy'
  | '1d'
  | '2d'
  | '3plus'
  | 'aplazados'
  | 'novedades'

// Estados "activos" = todavía no cerrados (aún requieren acción).
const ESTADOS_ACTIVOS = ['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION'] as const
// Estados "novedad" — requieren atención del operador.
const ESTADOS_NOVEDAD = ['NOVEDAD', 'NO_ENTREGADO'] as const
// Estados terminales — pedido cerrado, sin acción pendiente.
const ESTADOS_TERMINALES = ['ENTREGADO', 'DEVUELTO', 'NO_ENTREGADO'] as const

function diasDesde(iso: string): number {
  const ms = Date.now() - new Date(iso).getTime()
  return Math.floor(ms / (1000 * 60 * 60 * 24))
}

export function matchesAntiguedad(p: Pedido, filtro: AntiguedadKey): boolean {
  if (filtro === 'todos') return true

  if (filtro === 'aplazados') {
    // Un pedido con retención colgada en estado terminal NO cuenta como aplazado.
    if (ESTADOS_TERMINALES.includes(p.estado as typeof ESTADOS_TERMINALES[number])) return false
    return p.retencion_inicio !== null
  }

  if (filtro === 'novedades') {
    const enNovedad = ESTADOS_NOVEDAD.includes(p.estado as typeof ESTADOS_NOVEDAD[number])
    const enRiesgo =
      p.estado === 'RETIRO_EN_AGENCIA' &&
      (p.retencion_inicio !== null || (p.dias_en_agencia ?? 0) >= 6)
    return enNovedad || enRiesgo
  }

  // Los chips por antigüedad solo aplican a pedidos activos.
  if (!ESTADOS_ACTIVOS.includes(p.estado as typeof ESTADOS_ACTIVOS[number])) return false

  const dias = diasDesde(p.created_at)
  switch (filtro) {
    case 'hoy': return dias === 0
    case '1d': return dias === 1
    case '2d': return dias === 2
    case '3plus': return dias >= 3
    default: return true
  }
}

export const ANTIGUEDAD_KEYS: readonly AntiguedadKey[] = [
  'todos', 'hoy', '1d', '2d', '3plus', 'aplazados', 'novedades',
] as const

export function usePedidosFiltros(pedidos: Ref<Pedido[]>) {
  // Estado reactivo
  const filtroAntiguedad = ref<AntiguedadKey>('todos')
  const filtroEstado = ref('')
  const filtroProducto = ref('')
  const sortKey = ref<string>('fecha')
  const sortDir = ref<'asc' | 'desc'>('desc')

  function toggleSort(key: string) {
    if (sortKey.value === key) {
      sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
    } else {
      sortKey.value = key
      // Defaults razonables por tipo de columna
      sortDir.value = key === 'fecha' || key === 'monto' ? 'desc' : 'asc'
    }
  }

  function sortLabel(key: string): string {
    if (sortKey.value !== key) return '⇅'
    return sortDir.value === 'asc' ? '↑' : '↓'
  }

  /**
   * Contadores de los 4 chips de "vista rápida". Solo muestra los chips
   * que tienen sentido — los de antigüedad por día (1d, 2d, 3plus) se
   * integran cuando son útiles a través del filtro completo.
   */
  const chipsAntiguedad = computed(() => {
    const countFor = (k: AntiguedadKey) =>
      pedidos.value.filter((p) => matchesAntiguedad(p, k)).length

    return [
      { key: 'todos' as const,     label: 'Todos',      count: pedidos.value.length, alerta: false },
      { key: 'novedades' as const, label: 'Novedades',  count: countFor('novedades'), alerta: true },
      { key: 'hoy' as const,       label: 'Nuevos hoy', count: countFor('hoy'),       alerta: false },
      { key: 'aplazados' as const, label: 'Aplazados',  count: countFor('aplazados'), alerta: false },
    ]
  })

  const pedidosOrdenados = computed(() => {
    const lista = pedidos.value.filter((p) => {
      if (!matchesAntiguedad(p, filtroAntiguedad.value)) return false
      if (filtroProducto.value && p.producto_id !== filtroProducto.value) return false
      if (filtroEstado.value && p.estado !== filtroEstado.value) return false
      return true
    })
    if (!sortKey.value) return lista

    return [...lista].sort((a, b) => {
      let cmp = 0
      switch (sortKey.value) {
        case 'cliente':
          cmp = (a.cliente_nombre || a.clientes?.nombre || '').localeCompare(
            b.cliente_nombre || b.clientes?.nombre || '', 'es',
          )
          break
        case 'producto':
          cmp = (a.productos?.nombre || '').localeCompare(b.productos?.nombre || '', 'es')
          break
        case 'destino':
          cmp =
            (a.tipo_entrega || '').localeCompare(b.tipo_entrega || '') ||
            (a.direccion || '').localeCompare(b.direccion || '', 'es')
          break
        case 'estado':
          cmp = getEstadoPrioridad(a.estado) - getEstadoPrioridad(b.estado)
          break
        case 'monto':
          cmp = Number(a.monto) - Number(b.monto)
          break
        case 'fecha':
          cmp = a.created_at.localeCompare(b.created_at)
          break
        default:
          return 0
      }
      return sortDir.value === 'asc' ? cmp : -cmp
    })
  })

  return {
    filtroAntiguedad,
    filtroEstado,
    filtroProducto,
    sortKey,
    sortDir,
    toggleSort,
    sortLabel,
    chipsAntiguedad,
    pedidosOrdenados,
  }
}
