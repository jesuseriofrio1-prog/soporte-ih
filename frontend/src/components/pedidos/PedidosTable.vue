<script setup lang="ts">
import type { EstadoPedido, Pedido } from '../../services/pedidosService'
import { computed } from 'vue'
import {
  ESTADO_LABELS,
  filaAlerta,
  formatFecha,
} from '../../composables/usePedidoEstado'
import {
  calcularStatsProvincia,
  calcularStatsCliente,
  calcularRiesgo,
  NIVEL_PILL,
  NIVEL_DOT,
} from '../../composables/usePedidoRiesgo'

/**
 * Tabla de pedidos con look minimal estilo rediseño v2:
 *  - Hairlines, tipografía 13px, tabular nums para montos y teléfonos.
 *  - Fila completa tintada ámbar si el pedido requiere atención.
 *  - Acciones WA/eliminar aparecen en hover (row-actions).
 */

const props = defineProps<{
  pedidos: Pedido[]
  sortKey: string
  loading: boolean
  empty: boolean
  sortLabel: (key: string) => string
  /** IDs de pedidos seleccionados (v-model desde el padre). */
  seleccionados?: string[]
}>()

const emit = defineEmits<{
  sort: [key: string]
  'abrir-detalle': [p: Pedido]
  'cambiar-estado': [id: string, nuevo: EstadoPedido]
  'toggle-retencion': [p: Pedido]
  'abrir-wa': [p: Pedido]
  'abrir-tracking': [guia: string]
  'update:seleccionados': [ids: string[]]
}>()

/** Toggle individual de un pedido. */
function toggleSeleccion(id: string, checked: boolean) {
  const actual = props.seleccionados ?? []
  const nuevos = checked
    ? Array.from(new Set([...actual, id]))
    : actual.filter((x) => x !== id)
  emit('update:seleccionados', nuevos)
}

/** Toggle del header: selecciona todos los visibles o limpia. */
function toggleTodos(checked: boolean) {
  emit(
    'update:seleccionados',
    checked ? props.pedidos.map((p) => p.id) : [],
  )
}

/** True si todos los visibles están seleccionados. */
function todosMarcados(): boolean {
  if (props.pedidos.length === 0) return false
  const set = new Set(props.seleccionados ?? [])
  return props.pedidos.every((p) => set.has(p.id))
}

// Mapeo de estado → clase pill para el badge inline.
const ESTADO_PILL: Record<string, string> = {
  PENDIENTE: 'pill-amber',
  CONFIRMADO: 'pill-blue',
  EN_PREPARACION: 'pill-blue',
  ENVIADO: 'pill-blue',
  EN_RUTA: 'pill-blue',
  RETIRO_EN_AGENCIA: 'pill-blue',
  NOVEDAD: 'pill-amber',
  NO_ENTREGADO: 'pill-rose',
  ENTREGADO: 'pill-emerald',
  DEVUELTO: 'pill-rose',
}

const ESTADO_DOT: Record<string, string> = {
  PENDIENTE: 'dot-amber',
  CONFIRMADO: 'dot-blue',
  EN_PREPARACION: 'dot-blue',
  ENVIADO: 'dot-blue',
  EN_RUTA: 'dot-blue',
  RETIRO_EN_AGENCIA: 'dot-blue',
  NOVEDAD: 'dot-amber',
  NO_ENTREGADO: 'dot-rose',
  ENTREGADO: 'dot-emerald',
  DEVUELTO: 'dot-rose',
}

function diasDesde(iso: string): string {
  const dias = Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
  return dias === 0 ? 'hoy' : `${dias}d`
}

function inicialesProducto(nombre: string | undefined): string {
  if (!nombre) return '??'
  const words = nombre.trim().split(/\s+/).slice(0, 2)
  return words.map((w) => w[0]).join('').toUpperCase()
}

// Stats pre-calculadas una sola vez por render de la tabla.
const statsProvincia = computed(() => calcularStatsProvincia(props.pedidos))
const statsCliente = computed(() => calcularStatsCliente(props.pedidos))

function riesgoDe(p: Pedido) {
  return calcularRiesgo(p, statsProvincia.value, statsCliente.value)
}
</script>

<template>
  <div v-if="loading" class="surface rounded-xl p-16 text-center">
    <div class="inline-block w-5 h-5 border-2 rounded-full animate-spin" style="border-color: var(--line); border-top-color: var(--accent);"></div>
    <p class="text-[13px] text-ink-muted mt-3">Cargando pedidos…</p>
  </div>

  <div v-else class="surface rounded-xl overflow-hidden">
    <div v-if="empty" class="empty-pattern py-16 text-center">
      <p class="text-[13px] text-ink-muted">No hay pedidos con estos filtros</p>
    </div>

    <table v-else class="w-full text-[13px]">
      <thead>
        <tr
          class="border-b hairline text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold"
          style="background: var(--paper-alt);"
        >
          <th class="py-2.5 pl-5 pr-2 text-left w-7">
            <input
              type="checkbox"
              :checked="todosMarcados()"
              @change="toggleTodos(($event.target as HTMLInputElement).checked)"
              @click.stop
              class="rounded cursor-pointer"
              aria-label="Seleccionar todos los pedidos visibles"
            />
          </th>
          <th class="py-2.5 px-2 text-left cursor-pointer hover:text-ink transition" @click="emit('sort', 'cliente')">
            <span class="flex items-center gap-1">
              Cliente / Fecha
              <span class="text-base" :class="sortKey === 'fecha' ? 'opacity-100' : 'opacity-30'">
                {{ sortLabel('fecha') }}
              </span>
            </span>
          </th>
          <th class="py-2.5 px-2 text-left cursor-pointer hover:text-ink transition" @click="emit('sort', 'producto')">
            <span class="flex items-center gap-1">
              Producto
              <span class="text-base" :class="sortKey === 'producto' ? 'opacity-100' : 'opacity-30'">
                {{ sortLabel('producto') }}
              </span>
            </span>
          </th>
          <th class="py-2.5 px-2 text-left cursor-pointer hover:text-ink transition" @click="emit('sort', 'destino')">Destino</th>
          <th class="py-2.5 px-2 text-left cursor-pointer hover:text-ink transition" @click="emit('sort', 'estado')">Estado</th>
          <th class="py-2.5 px-2 text-right cursor-pointer hover:text-ink transition" @click="emit('sort', 'monto')">
            <span class="flex items-center justify-end gap-1">
              Monto
              <span class="text-base" :class="sortKey === 'monto' ? 'opacity-100' : 'opacity-30'">
                {{ sortLabel('monto') }}
              </span>
            </span>
          </th>
          <th class="py-2.5 pl-2 pr-5 text-right w-24">Días</th>
        </tr>
      </thead>
      <tbody class="divide-y hairline">
        <tr
          v-for="pedido in pedidos"
          :key="pedido.id"
          class="cursor-pointer transition"
          :class="filaAlerta(pedido.estado, pedido.dias_en_agencia) ? 'surface-amber hover:opacity-90' : 'hover:bg-paper-alt'"
          @click="emit('abrir-detalle', pedido)"
        >
          <!-- Checkbox -->
          <td class="py-3 pl-5 pr-2" @click.stop>
            <input
              type="checkbox"
              :checked="(seleccionados ?? []).includes(pedido.id)"
              @change="toggleSeleccion(pedido.id, ($event.target as HTMLInputElement).checked)"
              class="rounded cursor-pointer"
              :aria-label="`Seleccionar pedido ${pedido.guia}`"
            />
          </td>

          <!-- Cliente + fecha + guía -->
          <td class="py-3 px-2">
            <div class="font-medium">
              {{ pedido.cliente_nombre || pedido.clientes?.nombre || '—' }}
            </div>
            <div class="text-[11px] text-ink-faint tabular font-mono">
              {{ pedido.cliente_telefono || pedido.clientes?.telefono || '—' }} · {{ formatFecha(pedido.created_at) }}
            </div>
            <button
              @click.stop="emit('abrir-tracking', pedido.guia)"
              class="text-[10px] font-mono mt-0.5 hover:underline"
              style="color: var(--accent);"
            >
              {{ pedido.guia }}
            </button>
          </td>

          <!-- Producto -->
          <td class="py-3 px-2">
            <div class="flex items-center gap-2">
              <div
                class="w-6 h-6 rounded overflow-hidden shrink-0 grid place-items-center text-[9px] font-semibold"
                :style="pedido.productos?.foto_url
                  ? { background: 'var(--paper-alt)' }
                  : { background: 'linear-gradient(135deg, var(--rose-bg), var(--accent-soft))', color: 'var(--rose-fg)' }"
              >
                <img
                  v-if="pedido.productos?.foto_url"
                  :src="pedido.productos.foto_url"
                  :alt="pedido.productos.nombre"
                  loading="lazy"
                  class="w-full h-full object-cover"
                />
                <span v-else>{{ inicialesProducto(pedido.productos?.nombre) }}</span>
              </div>
              <div class="min-w-0">
                <div class="truncate">{{ pedido.productos?.nombre || '—' }}</div>
                <div class="text-[11px] tabular font-mono text-ink-faint">
                  ${{ Number(pedido.monto).toFixed(2) }}
                </div>
              </div>
            </div>
          </td>

          <!-- Destino -->
          <td class="py-3 px-2">
            <div class="text-[12px]">
              {{ pedido.provincia || pedido.clientes?.ciudad || '—' }}
            </div>
            <div class="text-[11px] text-ink-faint truncate max-w-[180px]">
              {{ pedido.direccion || '' }}
            </div>
          </td>

          <!-- Estado + riesgo pre-envío -->
          <td class="py-3 px-2" @click.stop>
            <span
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium"
              :class="ESTADO_PILL[pedido.estado] || 'pill-blue'"
            >
              <span class="state-dot" :class="ESTADO_DOT[pedido.estado] || 'dot-blue'"></span>
              {{ ESTADO_LABELS[pedido.estado] || pedido.estado }}
            </span>
            <!-- Pill de riesgo sólo para pedidos "activos" (aún podés accionar) -->
            <template v-if="['PENDIENTE','CONFIRMADO','EN_PREPARACION','NOVEDAD'].includes(pedido.estado)">
              <div class="mt-1 flex items-center gap-1">
                <span
                  class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium"
                  :class="NIVEL_PILL[riesgoDe(pedido).nivel]"
                  :title="riesgoDe(pedido).factores.map((f) => f.razon).join(' · ') || 'Sin factores destacados'"
                >
                  <span class="state-dot" :class="NIVEL_DOT[riesgoDe(pedido).nivel]"></span>
                  Riesgo {{ riesgoDe(pedido).nivel }} · {{ riesgoDe(pedido).score }}
                </span>
              </div>
            </template>
            <div v-else class="text-[10px] text-ink-faint mt-1">{{ pedido.tipo_entrega }}</div>
          </td>

          <!-- Monto -->
          <td class="py-3 px-2 text-right font-mono tabular">
            ${{ Number(pedido.monto).toFixed(2) }}
          </td>

          <!-- Días + row actions -->
          <td class="py-3 pl-2 pr-5 text-right">
            <div class="flex items-center justify-end gap-2">
              <span class="row-actions flex items-center gap-1">
                <button
                  v-if="pedido.cliente_telefono || pedido.clientes?.telefono"
                  @click.stop="emit('abrir-wa', pedido)"
                  class="w-6 h-6 grid place-items-center rounded hover:bg-paper-alt"
                  title="WhatsApp"
                >
                  <svg class="w-3.5 h-3.5" style="color: var(--emerald-dot);" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M8 1a7 7 0 00-6.06 10.5L1 15l3.6-.94A7 7 0 108 1z"/>
                  </svg>
                </button>
                <button
                  @click.stop="emit('toggle-retencion', pedido)"
                  class="w-6 h-6 grid place-items-center rounded hover:bg-paper-alt"
                  title="Retención"
                >
                  <svg class="w-3.5 h-3.5" :class="pedido.retencion_inicio ? '' : 'text-ink-muted'" :style="pedido.retencion_inicio ? { color: 'var(--amber-dot)' } : {}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <circle cx="8" cy="8" r="6"/>
                    <path d="M8 4v4l3 2" stroke-linecap="round"/>
                  </svg>
                </button>
              </span>
              <span class="text-[11px] text-ink-muted tabular font-mono">
                {{ diasDesde(pedido.created_at) }}
              </span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
