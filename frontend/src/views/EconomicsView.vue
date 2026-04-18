<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useTiendaStore } from '../stores/tienda'
import { useProductosStore } from '../stores/productos'
import { usePedidosStore } from '../stores/pedidos'
import type { Producto } from '../services/productosService'

/**
 * Unit economics por producto.
 *
 * Calcula sobre los pedidos cargados:
 *  - unidades_periodo: cuántas unidades entregadas en la ventana
 *  - margen_unitario = precio - costo_unitario - fee_envio
 *  - utilidad_periodo = unidades_periodo * margen_unitario
 *  - margen_pct = margen_unitario / precio
 *
 * Highlight en rojo: margen_pct < 10%.
 */

const router = useRouter()
const tiendaStore = useTiendaStore()
const productosStore = useProductosStore()
const pedidosStore = usePedidosStore()

// Ventana
type Ventana = 30 | 60 | 90
const ventana = ref<Ventana>(30)

function fechaLimite(dias: number): Date {
  const d = new Date()
  d.setDate(d.getDate() - dias)
  return d
}

interface FilaEconomica {
  producto: Producto
  configurado: boolean
  unidades: number
  ventasBrutas: number
  costoTotal: number
  feeTotal: number
  utilidad: number
  margenUnitario: number
  margenPct: number
}

const filas = computed<FilaEconomica[]>(() => {
  const limite = fechaLimite(ventana.value).getTime()

  return productosStore.productos.map((prod) => {
    // Considera unidades ENTREGADAS en la ventana (margen real, no ventas brutas)
    const pedidosEntregados = pedidosStore.pedidos.filter(
      (p) =>
        p.producto_id === prod.id &&
        p.estado === 'ENTREGADO' &&
        new Date(p.created_at).getTime() >= limite,
    )

    const unidades = pedidosEntregados.reduce(
      (sum, p) => sum + ((p as unknown as { cantidad?: number }).cantidad ?? 1),
      0,
    )
    const ventasBrutas = pedidosEntregados.reduce((sum, p) => sum + Number(p.monto), 0)

    const costo = prod.costo_unitario ?? 0
    const fee = prod.fee_envio ?? 0
    const configurado = prod.costo_unitario !== null && prod.fee_envio !== null

    const costoTotal = costo * unidades
    const feeTotal = fee * unidades
    const margenUnitario = configurado ? prod.precio - costo - fee : 0
    const utilidad = configurado ? margenUnitario * unidades : 0
    const margenPct = configurado && prod.precio > 0 ? margenUnitario / prod.precio : 0

    return {
      producto: prod,
      configurado,
      unidades,
      ventasBrutas,
      costoTotal,
      feeTotal,
      utilidad,
      margenUnitario,
      margenPct,
    }
  })
})

const totales = computed(() => {
  let ventas = 0
  let costo = 0
  let fee = 0
  let utilidad = 0
  let unidades = 0
  for (const f of filas.value) {
    ventas += f.ventasBrutas
    costo += f.costoTotal
    fee += f.feeTotal
    utilidad += f.utilidad
    unidades += f.unidades
  }
  const margenPct = ventas > 0 ? utilidad / ventas : 0
  return { ventas, costo, fee, utilidad, unidades, margenPct }
})

const configuradosCount = computed(() =>
  productosStore.productos.filter(
    (p) => p.costo_unitario !== null && p.fee_envio !== null,
  ).length,
)

function fmt(v: number): string {
  return v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function nivelClase(pct: number): { pill: string; dot: string; label: string } {
  if (pct < 0.1) return { pill: 'pill-rose',    dot: 'dot-rose',    label: 'Bajo' }
  if (pct < 0.3) return { pill: 'pill-amber',   dot: 'dot-amber',   label: 'Medio' }
  return { pill: 'pill-emerald', dot: 'dot-emerald', label: 'Sano' }
}

onMounted(() => {
  if (productosStore.productos.length === 0) productosStore.fetchProductos(true)
  if (pedidosStore.pedidos.length === 0) pedidosStore.fetchPedidos()
})

watch(() => tiendaStore.tiendaActivaId, () => {
  productosStore.fetchProductos(true)
  pedidosStore.fetchPedidos()
})
</script>

<template>
  <div class="px-8 py-8">
    <!-- Header -->
    <div class="flex items-end justify-between mb-6 flex-wrap gap-4">
      <div>
        <div class="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint mb-2">
          {{ configuradosCount }} / {{ productosStore.productos.length }} productos con costos configurados
        </div>
        <h1 class="h-display text-[40px] leading-none">
          Unit <span class="h-display-italic text-ink-muted">economics</span>
        </h1>
      </div>
      <div class="flex items-center gap-1 p-1 rounded-lg surface">
        <button
          v-for="v in [30, 60, 90] as Ventana[]"
          :key="v"
          @click="ventana = v"
          class="px-3 py-1 rounded-md text-[12px] transition"
          :class="ventana === v ? 'font-medium' : 'text-ink-muted hover:bg-paper-alt'"
          :style="ventana === v ? { background: 'var(--ink)', color: 'var(--paper)' } : {}"
        >
          {{ v }} días
        </button>
      </div>
    </div>

    <!-- Warning si faltan costos -->
    <div
      v-if="configuradosCount < productosStore.productos.length"
      class="surface-amber rounded-lg p-4 mb-5 flex items-center justify-between gap-3 flex-wrap"
      style="border: 1px solid var(--amber-dot);"
    >
      <div class="flex items-start gap-2 text-[12px]" style="color: var(--amber-fg);">
        <svg class="w-4 h-4 shrink-0 mt-0.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M8 1l7 13H1z"/><path d="M8 6v3M8 11v0.5"/>
        </svg>
        <span>
          Hay {{ productosStore.productos.length - configuradosCount }} producto(s) sin
          <b>costo unitario</b> o <b>fee Rocket</b> configurado. Su margen aparece como
          "No configurado".
        </span>
      </div>
      <button
        @click="router.push('/catalogo')"
        class="h-8 px-3 rounded-md text-[11px] font-medium hover:opacity-90 transition shrink-0"
        style="background: var(--amber-fg); color: var(--paper);"
      >
        Configurar en catálogo →
      </button>
    </div>

    <!-- KPIs totales -->
    <div class="grid grid-cols-2 md:grid-cols-4 surface rounded-xl overflow-hidden mb-6">
      <div class="p-5 border-r hairline">
        <div class="text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-3">
          Ventas {{ ventana }}d
        </div>
        <div class="flex items-baseline gap-1">
          <span class="text-[13px] text-ink-muted">$</span>
          <span class="h-display tabular text-[22px] leading-none">{{ fmt(totales.ventas) }}</span>
        </div>
        <div class="text-[11px] text-ink-faint mt-1">{{ totales.unidades }} unidad(es) entregadas</div>
      </div>
      <div class="p-5 border-r hairline">
        <div class="text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-3">
          Costo total
        </div>
        <div class="flex items-baseline gap-1">
          <span class="text-[13px] text-ink-muted">$</span>
          <span class="h-display tabular text-[22px] leading-none">{{ fmt(totales.costo) }}</span>
        </div>
        <div class="text-[11px] text-ink-faint mt-1">Fábrica + flete</div>
      </div>
      <div class="p-5 border-r hairline">
        <div class="text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-3">
          Fee Rocket
        </div>
        <div class="flex items-baseline gap-1">
          <span class="text-[13px] text-ink-muted">$</span>
          <span class="h-display tabular text-[22px] leading-none">{{ fmt(totales.fee) }}</span>
        </div>
        <div class="text-[11px] text-ink-faint mt-1">Fee por unidad × entregas</div>
      </div>
      <div class="p-5" :style="totales.margenPct < 0.1 ? { background: 'var(--rose-bg)' } : totales.utilidad > 0 ? { background: 'var(--emerald-bg)' } : {}">
        <div
          class="text-[10px] uppercase tracking-[0.1em] font-semibold mb-3"
          :style="totales.margenPct < 0.1
            ? { color: 'var(--rose-fg)' }
            : totales.utilidad > 0
              ? { color: 'var(--emerald-fg)' }
              : { color: 'var(--ink-faint)' }"
        >
          Utilidad neta
        </div>
        <div class="flex items-baseline gap-1">
          <span
            class="text-[13px]"
            :style="totales.margenPct < 0.1
              ? { color: 'var(--rose-fg)' }
              : totales.utilidad > 0
                ? { color: 'var(--emerald-fg)' }
                : { color: 'var(--ink-muted)' }"
          >$</span>
          <span
            class="h-display tabular text-[22px] leading-none"
            :style="totales.margenPct < 0.1
              ? { color: 'var(--rose-fg)' }
              : totales.utilidad > 0
                ? { color: 'var(--emerald-fg)' }
                : {}"
          >{{ fmt(totales.utilidad) }}</span>
        </div>
        <div
          class="text-[11px] tabular font-mono mt-1"
          :style="totales.margenPct < 0.1 ? { color: 'var(--rose-fg)' } : { color: 'var(--ink-muted)' }"
        >
          Margen {{ (totales.margenPct * 100).toFixed(1) }}% promedio
        </div>
      </div>
    </div>

    <!-- Tabla por producto -->
    <div class="surface rounded-xl overflow-hidden">
      <table class="w-full text-[13px]">
        <thead>
          <tr
            class="border-b hairline text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold"
            style="background: var(--paper-alt);"
          >
            <th class="py-2.5 pl-5 pr-2 text-left">Producto</th>
            <th class="py-2.5 px-2 text-right">Precio</th>
            <th class="py-2.5 px-2 text-right">Costo</th>
            <th class="py-2.5 px-2 text-right">Fee</th>
            <th class="py-2.5 px-2 text-right">Margen unit.</th>
            <th class="py-2.5 px-2 text-right">Margen %</th>
            <th class="py-2.5 px-2 text-right">Unid. {{ ventana }}d</th>
            <th class="py-2.5 pl-2 pr-5 text-right">Utilidad {{ ventana }}d</th>
          </tr>
        </thead>
        <tbody class="divide-y hairline">
          <tr v-for="f in filas" :key="f.producto.id" class="hover:bg-paper-alt transition">
            <td class="py-3 pl-5 pr-2">
              <div class="flex items-center gap-2">
                <div
                  class="w-8 h-8 rounded overflow-hidden shrink-0 grid place-items-center text-[10px] font-semibold"
                  :style="f.producto.foto_url
                    ? { background: 'var(--paper-alt)' }
                    : { background: 'linear-gradient(135deg, var(--rose-bg), var(--accent-soft))', color: 'var(--rose-fg)' }"
                >
                  <img
                    v-if="f.producto.foto_url"
                    :src="f.producto.foto_url"
                    :alt="f.producto.nombre"
                    loading="lazy"
                    class="w-full h-full object-cover"
                  />
                  <span v-else>{{ f.producto.nombre.charAt(0).toUpperCase() }}</span>
                </div>
                <div class="min-w-0">
                  <div class="font-medium truncate">{{ f.producto.nombre }}</div>
                  <div class="text-[10px] text-ink-faint tabular font-mono">{{ f.producto.slug }}</div>
                </div>
              </div>
            </td>
            <td class="py-3 px-2 text-right font-mono tabular">${{ fmt(f.producto.precio) }}</td>
            <td class="py-3 px-2 text-right font-mono tabular" :class="f.configurado ? '' : 'text-ink-faint'">
              {{ f.configurado ? `$${fmt(f.producto.costo_unitario!)}` : '—' }}
            </td>
            <td class="py-3 px-2 text-right font-mono tabular" :class="f.configurado ? '' : 'text-ink-faint'">
              {{ f.configurado ? `$${fmt(f.producto.fee_envio!)}` : '—' }}
            </td>
            <td class="py-3 px-2 text-right font-mono tabular">
              <span v-if="!f.configurado" class="text-ink-faint">—</span>
              <span
                v-else
                :style="f.margenUnitario < 0
                  ? { color: 'var(--rose-dot)' }
                  : f.margenPct < 0.1
                    ? { color: 'var(--amber-fg)' }
                    : {}"
              >
                ${{ fmt(f.margenUnitario) }}
              </span>
            </td>
            <td class="py-3 px-2 text-right">
              <span v-if="!f.configurado" class="text-ink-faint">—</span>
              <span
                v-else
                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium"
                :class="nivelClase(f.margenPct).pill"
              >
                <span class="state-dot" :class="nivelClase(f.margenPct).dot"></span>
                {{ (f.margenPct * 100).toFixed(1) }}%
              </span>
            </td>
            <td class="py-3 px-2 text-right font-mono tabular">{{ f.unidades }}</td>
            <td class="py-3 pl-2 pr-5 text-right font-mono tabular font-medium">
              <span v-if="!f.configurado" class="text-ink-faint">—</span>
              <span
                v-else
                :style="f.utilidad < 0 ? { color: 'var(--rose-dot)' } : {}"
              >
                ${{ fmt(f.utilidad) }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="text-[11px] text-ink-faint mt-4">
      💡 Utilidad = (precio − costo − fee) × unidades entregadas en la ventana.
      <span style="color: var(--rose-dot);">Rojo</span> = margen &lt; 10% (señal para subir precio o pausar).
    </p>
  </div>
</template>
