<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useDashboardStore } from '../stores/dashboard'
import { usePedidosStore } from '../stores/pedidos'

const router = useRouter()
const dashStore = useDashboardStore()
const pedidosStore = usePedidosStore()

// ────────────── Helpers ──────────────

function formatMoney(val: number | null | undefined, decimals = 2): string {
  return (val || 0).toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function formatRelative(iso: string | undefined): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'ahora'
  if (min < 60) return `${min}m`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}

// ────────────── Periodo (por ahora solo Mes — el backend sólo expone
// stats mensuales) ──────────────
const periodoLabel = computed(() =>
  new Date().toLocaleDateString('es-EC', { month: 'long', year: 'numeric' }),
)

// ────────────── KPIs derivados ──────────────
// El backend solo da stats del mes. Para semana/hoy usamos los agregados
// que ya tenemos; si faltan, mostramos "—".

const stats = computed(() => dashStore.stats)

const kpiVentas = computed(() => stats.value?.ventas_mes ?? 0)
const kpiPedidos = computed(() => stats.value?.pedidos_mes ?? 0)
const kpiTicket = computed(() => stats.value?.promedio_pedido ?? 0)
const kpiEntrega = computed(() => stats.value?.porcentaje_entrega ?? 0)
const kpiConfirmacion = computed(() => stats.value?.porcentaje_confirmacion ?? 0)
const kpiTransito = computed(() => stats.value?.facturacion_en_transito ?? 0)
const kpiTransitoCount = computed(() => stats.value?.en_transito ?? 0)
const kpiNovedad = computed(() => stats.value?.facturacion_en_novedad ?? 0)
const kpiNovedadCount = computed(() => stats.value?.novedades ?? 0)
const kpiConfirmadosMes = computed(() => stats.value?.confirmados_mes ?? 0)

// ────────────── Pipeline (breakdown por estado) ──────────────

const pipelineItems = computed(() => {
  const pedidos = pedidosStore.pedidos
  const total = pedidos.length || 1
  const count = (estados: string[]) =>
    pedidos.filter((p) => estados.includes(p.estado)).length

  const entregados = count(['ENTREGADO'])
  const transito = count(['ENVIADO', 'EN_RUTA', 'RETIRO_EN_AGENCIA'])
  const novedad = count(['NOVEDAD', 'NO_ENTREGADO'])
  const pendiente = count(['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION'])
  const devuelto = count(['DEVUELTO'])

  return [
    { key: 'entregado',  label: 'Entregado',   dot: 'dot-emerald', count: entregados, pct: (entregados / total) * 100 },
    { key: 'transito',   label: 'En tránsito', dot: 'dot-blue',    count: transito,   pct: (transito / total) * 100 },
    { key: 'novedad',    label: 'Novedad',     dot: 'dot-amber',   count: novedad,    pct: (novedad / total) * 100 },
    { key: 'pendiente',  label: 'Pendiente',   dot: 'dot-stone',   count: pendiente,  pct: (pendiente / total) * 100 },
    { key: 'devuelto',   label: 'Devuelto',    dot: 'dot-rose',    count: devuelto,   pct: (devuelto / total) * 100 },
  ]
})

// ────────────── Producto estrella ──────────────

const productoEstrella = computed(() => {
  const ranking = new Map<string, { id: string; nombre: string; unidades: number; ventas: number }>()
  for (const p of pedidosStore.pedidos) {
    if (!p.producto_id || !p.productos?.nombre) continue
    const prev = ranking.get(p.producto_id) ?? {
      id: p.producto_id, nombre: p.productos.nombre, unidades: 0, ventas: 0,
    }
    prev.unidades += 1
    prev.ventas += Number(p.monto) || 0
    ranking.set(p.producto_id, prev)
  }
  return Array.from(ranking.values()).sort((a, b) => b.unidades - a.unidades).slice(0, 3)
})

// ────────────── Actividad reciente ──────────────
// Combinamos los últimos cambios de estado (desde pedidos.updated_at) como
// stream. Un futuro backend de activity log reemplazaría esto.

interface ActivityItem {
  /** Clave estable para v-for: combinación de id + updated_at */
  key: string
  ts: string
  dotClass: string
  html: string
}

const actividad = computed<ActivityItem[]>(() => {
  const pedidos = [...pedidosStore.pedidos]
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 6)

  const dotByEstado: Record<string, string> = {
    ENTREGADO: 'dot-emerald',
    NOVEDAD: 'dot-amber',
    NO_ENTREGADO: 'dot-rose',
    DEVUELTO: 'dot-rose',
    ENVIADO: 'dot-blue',
    EN_RUTA: 'dot-blue',
    RETIRO_EN_AGENCIA: 'dot-blue',
    PENDIENTE: 'dot-stone',
    CONFIRMADO: 'dot-stone',
    EN_PREPARACION: 'dot-stone',
  }

  return pedidos.map((p) => ({
    key: `${p.id}-${p.updated_at}`,
    ts: p.updated_at,
    dotClass: dotByEstado[p.estado] || 'dot-stone',
    html: `Pedido de <span class="font-medium">${escapeHtml(p.cliente_nombre || p.clientes?.nombre || '—')}</span> · <span class="font-medium">${p.estado.toLowerCase().replace(/_/g, ' ')}</span>`,
  }))
})

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]!))
}

// ────────────── Auto-refresh ──────────────
const AUTO_REFRESH_MS = 60_000
let intervalId: number | null = null

onMounted(() => {
  intervalId = window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      dashStore.fetchAll()
    }
  }, AUTO_REFRESH_MS)
})

onBeforeUnmount(() => {
  if (intervalId !== null) clearInterval(intervalId)
})

function irAPedidosNovedad() {
  router.push('/pedidos?filtro=novedades')
}
</script>

<template>
  <div class="px-8 py-8 max-w-[1320px]">
    <!-- Heading -->
    <div class="flex items-end justify-between mb-8 flex-wrap gap-4">
      <div>
        <div class="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint mb-2">
          {{ periodoLabel }}
        </div>
        <h1 class="h-display text-[40px] leading-none">
          Panorama <span class="h-display-italic text-ink-muted">del mes</span>
        </h1>
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="dashStore.loading && !stats" class="surface rounded-xl p-16 text-center">
      <div class="inline-block w-5 h-5 border-2 rounded-full animate-spin" style="border-color: var(--line); border-top-color: var(--accent);"></div>
      <p class="text-[13px] text-ink-muted mt-3">Cargando panorama…</p>
    </div>

    <template v-else>
      <!-- KPIs: 6 celdas en grid único con hairlines -->
      <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 surface rounded-xl overflow-hidden mb-10">
        <div class="p-5 border-r border-b lg:border-b-0 hairline">
          <div class="text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-3">Ventas</div>
          <div class="flex items-baseline gap-1.5 mb-3">
            <span class="text-[13px] text-ink-muted tabular">$</span>
            <span class="text-[26px] h-display tabular leading-none">{{ formatMoney(kpiVentas) }}</span>
          </div>
          <div class="text-[11px] text-ink-faint">Total facturado</div>
        </div>

        <div class="p-5 border-r border-b lg:border-b-0 hairline">
          <div class="text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-3">Pedidos</div>
          <div class="flex items-baseline gap-1.5 mb-3">
            <span class="text-[26px] h-display tabular leading-none">{{ kpiPedidos }}</span>
            <span class="text-[11px] text-ink-muted tabular font-mono">/ ${{ formatMoney(kpiTicket) }}</span>
          </div>
          <div class="text-[11px] text-ink-faint">Ticket promedio</div>
        </div>

        <div class="p-5 border-r border-b lg:border-b-0 hairline">
          <div class="text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-3">Entrega</div>
          <div class="flex items-baseline gap-1.5 mb-3">
            <span class="text-[26px] h-display tabular leading-none">{{ kpiEntrega.toFixed(1) }}</span>
            <span class="text-[13px] text-ink-muted">%</span>
          </div>
          <div class="text-[11px] text-ink-faint">Tasa del mes</div>
        </div>

        <div class="p-5 border-r hairline">
          <div class="text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-3">Confirmación</div>
          <div class="flex items-baseline gap-1.5 mb-3">
            <span class="text-[26px] h-display tabular leading-none">{{ kpiConfirmacion.toFixed(0) }}</span>
            <span class="text-[13px] text-ink-muted">%</span>
          </div>
          <div class="text-[11px] text-ink-faint tabular font-mono">{{ kpiConfirmadosMes }} / {{ kpiPedidos }}</div>
        </div>

        <div class="p-5 border-r hairline">
          <div class="text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-3">Tránsito</div>
          <div class="flex items-baseline gap-1.5 mb-3">
            <span class="text-[13px] text-ink-muted tabular">$</span>
            <span class="text-[26px] h-display tabular leading-none">{{ formatMoney(kpiTransito) }}</span>
          </div>
          <div class="text-[11px] text-ink-faint">
            {{ kpiTransitoCount === 0 ? 'Sin envíos activos' : `${kpiTransitoCount} en curso` }}
          </div>
        </div>

        <!-- Novedad (destacado) -->
        <div class="p-5 surface-amber relative">
          <div class="absolute top-0 right-0 w-1 h-full dot-amber"></div>
          <div class="flex items-center justify-between mb-3">
            <span class="text-[10px] uppercase tracking-[0.1em] font-semibold" style="color: var(--amber-fg);">Novedad</span>
            <span class="state-dot dot-amber"></span>
          </div>
          <div class="flex items-baseline gap-1.5 mb-3">
            <span class="text-[13px] tabular" style="color: var(--amber-fg);">$</span>
            <span class="text-[26px] h-display tabular leading-none" style="color: var(--amber-fg);">
              {{ formatMoney(kpiNovedad) }}
            </span>
          </div>
          <button
            v-if="kpiNovedadCount > 0"
            @click="irAPedidosNovedad"
            class="text-[11px] font-medium hover:underline"
            style="color: var(--amber-fg);"
          >
            {{ kpiNovedadCount }} pedido{{ kpiNovedadCount === 1 ? '' : 's' }} · revisar →
          </button>
          <span v-else class="text-[11px]" style="color: var(--amber-fg); opacity: 0.7;">
            Sin novedades
          </span>
        </div>
      </div>

      <!-- Main grid: gráfico + pipeline -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-10">
        <!-- Gráfico 7 días -->
        <div class="lg:col-span-2 surface rounded-xl p-6">
          <div class="flex items-start justify-between mb-6 flex-wrap gap-3">
            <div>
              <h3 class="h-display text-[20px]">Últimos 7 días</h3>
              <p class="text-[12px] text-ink-faint mt-0.5">Facturación diaria</p>
            </div>
            <div class="flex items-center gap-4 text-[11px]">
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-0.5" style="background: var(--ink);"></span>
                <span class="text-ink-muted">Ventas ($)</span>
              </div>
            </div>
          </div>

          <!-- SVG custom minimalista -->
          <div v-if="dashStore.ventasSemana.length === 0" class="h-[220px] grid place-items-center text-[12px] text-ink-faint">
            Sin datos para mostrar
          </div>
          <svg
            v-else
            viewBox="0 0 700 220"
            class="w-full h-[220px] text-ink"
            preserveAspectRatio="none"
          >
            <!-- grid horizontal -->
            <g stroke="var(--line)" stroke-width="1">
              <line x1="40" y1="20" x2="700" y2="20"/>
              <line x1="40" y1="70" x2="700" y2="70"/>
              <line x1="40" y1="120" x2="700" y2="120"/>
              <line x1="40" y1="170" x2="700" y2="170"/>
            </g>

            <!-- datos escalados -->
            <g>
              <template
                v-for="(v, i) in dashStore.ventasSemana"
                :key="i"
              >
                <!-- eje X labels -->
                <text
                  :x="40 + (i * (660 / Math.max(dashStore.ventasSemana.length - 1, 1)))"
                  y="205"
                  text-anchor="middle"
                  font-family="Inter"
                  font-size="11"
                  fill="var(--ink-faint)"
                >{{ v.dia }}</text>
              </template>
            </g>

            <!-- Línea de ventas + área -->
            <path
              :d="(() => {
                const vs = dashStore.ventasSemana
                if (vs.length === 0) return ''
                const max = Math.max(...vs.map(v => Number(v.total)), 1)
                const step = 660 / Math.max(vs.length - 1, 1)
                const points = vs.map((v, i) => {
                  const x = 40 + i * step
                  const y = 180 - (Number(v.total) / max) * 160
                  return `${x},${y}`
                })
                return 'M' + points.join(' L')
              })()"
              fill="none"
              stroke="currentColor"
              stroke-width="1.5"
              stroke-linejoin="round"
            />
            <path
              :d="(() => {
                const vs = dashStore.ventasSemana
                if (vs.length === 0) return ''
                const max = Math.max(...vs.map(v => Number(v.total)), 1)
                const step = 660 / Math.max(vs.length - 1, 1)
                const pts = vs.map((v, i) => {
                  const x = 40 + i * step
                  const y = 180 - (Number(v.total) / max) * 160
                  return `${x},${y}`
                })
                return 'M' + pts.join(' L') + ` L${40 + (vs.length - 1) * step},190 L40,190 Z`
              })()"
              fill="currentColor"
              opacity="0.06"
            />
          </svg>
        </div>

        <!-- Pipeline -->
        <div class="surface rounded-xl p-6">
          <h3 class="h-display text-[20px] mb-1">Pipeline</h3>
          <p class="text-[12px] text-ink-faint mb-5">
            Estado de los {{ pedidosStore.pedidos.length }} pedidos
          </p>
          <div class="space-y-3">
            <div
              v-for="item in pipelineItems"
              :key="item.key"
              :class="item.count === 0 ? 'opacity-50' : ''"
            >
              <div class="flex items-baseline justify-between mb-1.5">
                <div class="flex items-center gap-2">
                  <span class="state-dot" :class="item.dot"></span>
                  <span class="text-[13px] font-medium">{{ item.label }}</span>
                </div>
                <span class="font-mono text-[13px] tabular">{{ item.count }}</span>
              </div>
              <div class="h-1 bg-paper-alt rounded-full overflow-hidden">
                <div class="h-full" :class="item.dot" :style="{ width: item.pct + '%' }"></div>
              </div>
            </div>
          </div>
          <button
            @click="router.push('/pedidos')"
            class="mt-5 w-full text-center text-[12px] font-medium py-2 rounded-md border hairline hover:bg-paper-alt transition"
          >
            Ver todos los pedidos →
          </button>
        </div>
      </div>

      <!-- Bottom row: producto estrella + actividad -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Producto estrella -->
        <div class="surface rounded-xl p-6">
          <h3 class="h-display text-[20px] mb-1">Producto estrella</h3>
          <p class="text-[12px] text-ink-faint mb-5">Ranking del período</p>
          <div v-if="productoEstrella.length === 0" class="text-[12px] text-ink-faint text-center py-6">
            Aún no hay suficiente data
          </div>
          <div v-else class="space-y-4">
            <div
              v-for="(p, i) in productoEstrella"
              :key="p.id"
              class="flex items-center gap-3"
              :style="{ opacity: 1 - i * 0.2 }"
            >
              <span class="h-display-italic text-[22px] text-ink-faint w-6">{{ i + 1 }}</span>
              <div class="flex-1 min-w-0">
                <div class="text-[13px] font-medium truncate">{{ p.nombre }}</div>
                <div class="text-[11px] text-ink-faint tabular font-mono">
                  {{ p.unidades }} unidad{{ p.unidades === 1 ? '' : 'es' }} · ${{ formatMoney(p.ventas) }}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Actividad reciente -->
        <div class="lg:col-span-2 surface rounded-xl p-6">
          <div class="flex items-center justify-between mb-5">
            <div>
              <h3 class="h-display text-[20px]">Actividad</h3>
              <p class="text-[12px] text-ink-faint mt-0.5">Últimos cambios de estado</p>
            </div>
            <span class="text-[11px] text-ink-muted flex items-center gap-1">
              <span class="w-1.5 h-1.5 dot-emerald rounded-full animate-pulse"></span>
              Auto
            </span>
          </div>

          <div v-if="actividad.length === 0" class="text-[12px] text-ink-faint text-center py-6">
            Sin actividad reciente
          </div>
          <ol v-else class="space-y-0 divide-y hairline">
            <li
              v-for="item in actividad"
              :key="item.key"
              class="py-3 flex items-start gap-4"
            >
              <span class="text-[11px] tabular font-mono text-ink-faint w-14 pt-0.5">
                {{ formatRelative(item.ts) }}
              </span>
              <span class="state-dot mt-1.5" :class="item.dotClass"></span>
              <div class="flex-1 text-[13px]" v-html="item.html"></div>
            </li>
          </ol>
        </div>
      </div>
    </template>
  </div>
</template>
