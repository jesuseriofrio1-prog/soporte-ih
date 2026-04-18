import type { Pedido } from '../services/pedidosService'

/**
 * Score de riesgo pre-envío (heurístico). El score va de 0 a 100;
 * números altos = más riesgo. Los factores se suman con pesos y se
 * acotan a [0, 100].
 *
 * Factores:
 *  - Provincia: % histórico de novedad/devuelto en esa provincia
 *    (calculado sobre todos los pedidos ya cargados de la tienda).
 *  - Dirección: heurísticas sobre completitud (largo, presencia de
 *    números, palabras vagas).
 *  - Hora de compra: madrugada/noche son más riesgosas.
 *  - Historial cliente: si el cliente tiene pedidos previos devueltos
 *    o en novedad, sube el riesgo.
 */

export type NivelRiesgo = 'bajo' | 'medio' | 'alto'

export interface FactorRiesgo {
  nombre: string
  impacto: number // 0-100 (cuánto contribuye al score)
  razon: string
}

export interface AnalisisRiesgo {
  score: number
  nivel: NivelRiesgo
  factores: FactorRiesgo[]
}

const ESTADOS_FAILED = new Set(['NOVEDAD', 'NO_ENTREGADO', 'DEVUELTO'])

/** Palabras típicas de direcciones vagas en Ecuador. */
const PALABRAS_VAGAS = [
  'por la', 'frente', 'cerca', 'detrás', 'detras', 'al lado',
  'por el', 'aproximadamente', 'más o menos', 'mas o menos',
]

/**
 * Calcula stats por provincia sobre la lista completa. Cacheable en
 * el caller si llamás por cada pedido en un render.
 */
export function calcularStatsProvincia(
  pedidos: Pedido[],
): Map<string, { total: number; fallas: number; rate: number }> {
  const map = new Map<string, { total: number; fallas: number; rate: number }>()
  for (const p of pedidos) {
    if (!p.provincia) continue
    const prev = map.get(p.provincia) ?? { total: 0, fallas: 0, rate: 0 }
    prev.total++
    if (ESTADOS_FAILED.has(p.estado)) prev.fallas++
    map.set(p.provincia, prev)
  }
  for (const [k, v] of map) {
    v.rate = v.total > 0 ? v.fallas / v.total : 0
    map.set(k, v)
  }
  return map
}

/**
 * Stats por cliente (teléfono normalizado). Usado para saber si el
 * cliente ya devolvió en el pasado.
 */
export function calcularStatsCliente(
  pedidos: Pedido[],
): Map<string, { total: number; fallas: number; entregados: number }> {
  const map = new Map<string, { total: number; fallas: number; entregados: number }>()
  for (const p of pedidos) {
    const tel = p.cliente_telefono || p.clientes?.telefono
    if (!tel) continue
    const prev = map.get(tel) ?? { total: 0, fallas: 0, entregados: 0 }
    prev.total++
    if (ESTADOS_FAILED.has(p.estado)) prev.fallas++
    if (p.estado === 'ENTREGADO') prev.entregados++
    map.set(tel, prev)
  }
  return map
}

/**
 * Score principal. Recibe el pedido y los maps pre-calculados; en
 * paths críticos (render de tabla) pasás los maps una sola vez.
 */
export function calcularRiesgo(
  p: Pedido,
  provinciaStats: ReturnType<typeof calcularStatsProvincia>,
  clienteStats: ReturnType<typeof calcularStatsCliente>,
): AnalisisRiesgo {
  const factores: FactorRiesgo[] = []
  let score = 0

  // ── 1) Provincia (peso 40 pts) ──
  if (p.provincia) {
    const stats = provinciaStats.get(p.provincia)
    if (stats && stats.total >= 3) {
      const pct = Math.round(stats.rate * 100)
      if (pct >= 25) {
        const impacto = Math.min(40, pct)
        score += impacto
        factores.push({
          nombre: 'Provincia',
          impacto,
          razon: `${p.provincia} tiene ${pct}% de novedad/devolución (${stats.fallas}/${stats.total})`,
        })
      } else if (pct >= 10) {
        const impacto = Math.round(pct * 0.8)
        score += impacto
        factores.push({
          nombre: 'Provincia',
          impacto,
          razon: `${p.provincia}: ${pct}% novedad histórica`,
        })
      }
    }
  } else {
    score += 5
    factores.push({
      nombre: 'Sin provincia',
      impacto: 5,
      razon: 'No se capturó la provincia del destinatario',
    })
  }

  // ── 2) Dirección (peso 30 pts) ──
  const dir = (p.direccion || '').trim()
  if (dir.length < 15) {
    score += 20
    factores.push({
      nombre: 'Dirección corta',
      impacto: 20,
      razon: `Sólo ${dir.length} caracteres (se recomienda >15)`,
    })
  }
  if (!/\d/.test(dir) && p.tipo_entrega === 'DOMICILIO') {
    score += 10
    factores.push({
      nombre: 'Sin número visible',
      impacto: 10,
      razon: 'La dirección no contiene ningún número (casa, torre, mz)',
    })
  }
  const lowerDir = dir.toLowerCase()
  const vagas = PALABRAS_VAGAS.filter((w) => lowerDir.includes(w))
  if (vagas.length > 0 && !/\b(calle|av|avenida|cdla|ciudadela)\b/i.test(dir)) {
    score += 10
    factores.push({
      nombre: 'Referencia vaga',
      impacto: 10,
      razon: `Sólo referencia sin calle/avenida ("${vagas[0]}")`,
    })
  }

  // ── 3) Hora de compra (peso 10 pts) ──
  const hora = new Date(p.created_at).getHours()
  if (hora >= 23 || hora < 6) {
    score += 8
    factores.push({
      nombre: 'Compra nocturna',
      impacto: 8,
      razon: `Creado a las ${hora}h (pedidos nocturnos tienen mayor cancelación)`,
    })
  }

  // ── 4) Historial cliente (peso 25 pts) ──
  const tel = p.cliente_telefono || p.clientes?.telefono
  if (tel) {
    const stats = clienteStats.get(tel)
    if (stats) {
      // Excluir el pedido actual del conteo
      const totalPrev = stats.total - 1
      const entregadosPrev = p.estado === 'ENTREGADO' ? stats.entregados - 1 : stats.entregados
      const fallasPrev = ESTADOS_FAILED.has(p.estado) ? stats.fallas - 1 : stats.fallas

      if (fallasPrev >= 1) {
        const impacto = Math.min(25, fallasPrev * 15)
        score += impacto
        factores.push({
          nombre: 'Cliente problemático',
          impacto,
          razon: `${fallasPrev} pedido(s) previos terminaron en novedad/devolución`,
        })
      } else if (entregadosPrev >= 1) {
        // Cliente recurrente entregado: REDUCE el score
        const descuento = Math.min(15, entregadosPrev * 5)
        score = Math.max(0, score - descuento)
        factores.push({
          nombre: 'Cliente recurrente',
          impacto: -descuento,
          razon: `${entregadosPrev} pedido(s) previos entregados correctamente`,
        })
      }
      void totalPrev
    }
  }

  // Acotar
  score = Math.max(0, Math.min(100, Math.round(score)))

  // Determinar nivel (score alto = más riesgo)
  let nivel: NivelRiesgo = 'bajo'
  if (score >= 50) nivel = 'alto'
  else if (score >= 25) nivel = 'medio'

  return { score, nivel, factores }
}

/** Clases para el pill según nivel. */
export const NIVEL_PILL: Record<NivelRiesgo, string> = {
  bajo: 'pill-emerald',
  medio: 'pill-amber',
  alto: 'pill-rose',
}

export const NIVEL_DOT: Record<NivelRiesgo, string> = {
  bajo: 'dot-emerald',
  medio: 'dot-amber',
  alto: 'dot-rose',
}
