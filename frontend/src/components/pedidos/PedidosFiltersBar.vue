<script setup lang="ts">
import { computed } from 'vue'
import type { AntiguedadKey } from '../../composables/usePedidosFiltros'
import type { Producto } from '../../services/productosService'
import type { Pedido } from '../../services/pedidosService'
import { ESTADOS_DISPONIBLES } from '../../composables/usePedidoEstado'

/**
 * Barra superior de /pedidos: cards de pipeline como filtros rápidos
 * (Todos / Entregados / Tránsito / Novedad / Pendientes / Devueltos) +
 * filtros secundarios (producto, estado) + botones de acción.
 *
 * Reemplaza los chips de antigüedad anteriores con el nuevo patrón
 * de cards del rediseño.
 */

interface Chip {
  key: AntiguedadKey
  label: string
  count: number
  alerta: boolean
}

const props = defineProps<{
  chips: Chip[]
  filtroAntiguedad: AntiguedadKey
  filtroProducto: string
  filtroEstado: string
  productos: Producto[]
  sincronizando: boolean
  pedidos: Pedido[]
}>()

const emit = defineEmits<{
  'update:filtroAntiguedad': [v: AntiguedadKey]
  'update:filtroProducto': [v: string]
  'update:filtroEstado': [v: string]
  sincronizar: []
  importar: []
  'nuevo-pedido': []
}>()

// Cards de pipeline según estados reales de los pedidos cargados.
const pipelineCards = computed(() => {
  const counts = (estados: string[]) =>
    props.pedidos.filter((p) => estados.includes(p.estado)).length
  return [
    { key: 'todos' as AntiguedadKey,      label: 'Todos',      count: props.pedidos.length,                         dot: '',            amber: false },
    { key: 'hoy' as AntiguedadKey,        label: 'Entregados', count: counts(['ENTREGADO']),                        dot: 'dot-emerald', amber: false },
    { key: '1d' as AntiguedadKey,         label: 'Tránsito',   count: counts(['ENVIADO','EN_RUTA','RETIRO_EN_AGENCIA']), dot: 'dot-blue',  amber: false },
    { key: 'novedades' as AntiguedadKey,  label: 'Novedad',    count: counts(['NOVEDAD','NO_ENTREGADO']),            dot: 'dot-amber', amber: true  },
    { key: 'aplazados' as AntiguedadKey,  label: 'Pendientes', count: counts(['PENDIENTE','CONFIRMADO','EN_PREPARACION']), dot: 'dot-stone', amber: false },
    { key: '3plus' as AntiguedadKey,      label: 'Devueltos',  count: counts(['DEVUELTO']),                          dot: 'dot-rose',  amber: false },
  ]
})

// Mapeo interno: cuando el usuario clickea un card, aplicamos el filtro
// "antigüedad" correspondiente (reusamos las keys existentes en el
// composable sin refactor mayor).
function clickCard(key: AntiguedadKey) {
  emit('update:filtroAntiguedad', key)
  // Resetear filtro de estado cuando el card ya implica un estado.
  if (['hoy','1d','novedades','aplazados','3plus'].includes(key)) {
    emit('update:filtroEstado', '')
  }
}
</script>

<template>
  <div class="space-y-4">
    <!-- Pipeline cards -->
    <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      <button
        v-for="card in pipelineCards"
        :key="card.key"
        @click="clickCard(card.key)"
        class="text-left p-3 rounded-lg transition"
        :class="[
          card.amber ? 'surface-amber' : 'surface',
          filtroAntiguedad === card.key ? '' : 'hover:opacity-90',
        ]"
        :style="
          filtroAntiguedad === card.key
            ? { border: `2px solid ${card.amber ? 'var(--amber-dot)' : 'var(--ink)'}` }
            : (card.amber ? { border: '1px solid var(--amber-dot)' } : {})
        "
      >
        <div class="flex items-center gap-1.5 mb-1">
          <span v-if="card.dot" class="state-dot" :class="card.dot"></span>
          <div
            class="text-[10px] uppercase tracking-[0.1em] font-semibold"
            :style="card.amber ? { color: 'var(--amber-fg)' } : { color: 'var(--ink-faint)' }"
          >
            {{ card.label }}
          </div>
        </div>
        <div
          class="h-display text-[24px] tabular leading-none"
          :style="card.amber ? { color: 'var(--amber-fg)' } : {}"
        >
          {{ card.count }}
        </div>
      </button>
    </div>

    <!-- Filtros secundarios + acciones -->
    <div class="flex flex-wrap items-center gap-3 text-[12px]">
      <!-- Filtro producto -->
      <select
        :value="filtroProducto"
        @change="emit('update:filtroProducto', ($event.target as HTMLSelectElement).value)"
        class="h-8 px-3 rounded-md surface hover:bg-paper-alt text-[12px] text-ink outline-none transition"
      >
        <option value="">Producto: todos</option>
        <option v-for="p in productos" :key="p.id" :value="p.id">{{ p.nombre }}</option>
      </select>

      <!-- Filtro estado -->
      <select
        :value="filtroEstado"
        @change="emit('update:filtroEstado', ($event.target as HTMLSelectElement).value)"
        class="h-8 px-3 rounded-md surface hover:bg-paper-alt text-[12px] text-ink outline-none transition"
      >
        <option v-for="e in ESTADOS_DISPONIBLES" :key="e.value" :value="e.value">
          Estado: {{ e.label }}
        </option>
      </select>

      <!-- Acciones a la derecha -->
      <div class="ml-auto flex items-center gap-2">
        <button
          @click="emit('sincronizar')"
          :disabled="sincronizando"
          class="h-9 px-3 rounded-md border hairline text-[12px] font-medium hover:bg-paper-alt transition flex items-center gap-2 disabled:opacity-50"
        >
          <svg class="w-3.5 h-3.5" :class="{ 'animate-spin': sincronizando }" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 8a5 5 0 019-3M13 3v3h-3M13 8a5 5 0 01-9 3M3 13v-3h3" stroke-linecap="round"/>
          </svg>
          <span class="hidden md:inline">{{ sincronizando ? 'Sincronizando…' : 'Sincronizar' }}</span>
        </button>
        <button
          @click="emit('importar')"
          class="h-9 px-3 rounded-md border hairline text-[12px] font-medium hover:bg-paper-alt transition flex items-center gap-2"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M8 2v8m-3-3l3 3 3-3M3 14h10" stroke-linecap="round"/>
          </svg>
          <span class="hidden md:inline">Importar Rocket</span>
        </button>
        <button
          @click="emit('nuevo-pedido')"
          class="h-9 px-3 rounded-md text-[12px] font-medium hover:opacity-90 transition flex items-center gap-2"
          style="background: var(--ink); color: var(--paper);"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M8 3v10M3 8h10" stroke-linecap="round"/>
          </svg>
          Nuevo pedido
        </button>
      </div>
    </div>
  </div>
</template>
