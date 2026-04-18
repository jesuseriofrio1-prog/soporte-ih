<script setup lang="ts">
import { computed } from 'vue'
import type { EstadoPedido, Pedido } from '../../services/pedidosService'
import { TODOS_LOS_ESTADOS } from '../../services/pedidosService'
import { ESTADO_LABELS } from '../../composables/usePedidoEstado'

/**
 * Barra flotante que aparece cuando hay pedidos seleccionados en la
 * tabla. Permite: cambiar estado en lote, exportar CSV, generar una
 * serie de enlaces wa.me para contactar a todos (cada uno en tab nueva).
 */

defineProps<{
  seleccionados: Pedido[]
}>()

const emit = defineEmits<{
  'cambiar-estado': [nuevo: EstadoPedido]
  'exportar-csv': []
  'abrir-todos-wa': []
  limpiar: []
}>()

// Sólo estados realmente útiles para bulk change; evitamos ENTREGADO y
// DEVUELTO que son terminales y no tiene sentido aplicar a muchos a la vez.
const estadosBulk = computed(() =>
  TODOS_LOS_ESTADOS.filter((e) =>
    ['CONFIRMADO', 'EN_PREPARACION', 'ENVIADO', 'NOVEDAD'].includes(e),
  ),
)
</script>

<template>
  <div
    v-if="seleccionados.length > 0"
    class="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 surface rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap"
    style="box-shadow: var(--shadow-md); max-width: calc(100vw - 32px);"
  >
    <div class="flex items-center gap-2">
      <span class="text-[13px] font-medium">
        {{ seleccionados.length }} pedido{{ seleccionados.length === 1 ? '' : 's' }} seleccionado{{ seleccionados.length === 1 ? '' : 's' }}
      </span>
      <button
        @click="emit('limpiar')"
        class="text-[11px] text-ink-faint hover:text-ink"
      >Limpiar</button>
    </div>

    <div class="w-px h-5 hairline border-l"></div>

    <!-- Cambio de estado -->
    <div class="flex items-center gap-1.5">
      <span class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold">
        Estado →
      </span>
      <select
        @change="(e) => { const v = (e.target as HTMLSelectElement).value; if (v) emit('cambiar-estado', v as EstadoPedido); (e.target as HTMLSelectElement).value = ''; }"
        class="h-7 px-2 rounded border hairline text-[11px] text-ink bg-paper-alt outline-none"
      >
        <option value="">— Cambiar a —</option>
        <option v-for="e in estadosBulk" :key="e" :value="e">
          {{ ESTADO_LABELS[e] }}
        </option>
      </select>
    </div>

    <div class="w-px h-5 hairline border-l"></div>

    <!-- Acciones -->
    <div class="flex items-center gap-2">
      <button
        @click="emit('abrir-todos-wa')"
        class="h-7 px-2.5 rounded-md border hairline text-[11px] font-medium hover:bg-paper-alt transition flex items-center gap-1.5"
        :title="`Abrir ${seleccionados.length} conversaciones WhatsApp (abre ${seleccionados.length} tabs)`"
      >
        <svg class="w-3 h-3" style="color: var(--emerald-dot);" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 00-6.06 10.5L1 15l3.6-.94A7 7 0 108 1z"/>
        </svg>
        Abrir WA
      </button>
      <button
        @click="emit('exportar-csv')"
        class="h-7 px-2.5 rounded-md border hairline text-[11px] font-medium hover:bg-paper-alt transition"
      >
        Exportar CSV
      </button>
    </div>
  </div>
</template>
