<script setup lang="ts">
import { ref, watch } from 'vue'
import Drawer from 'primevue/drawer'
import PedidoTimeline from './PedidoTimeline.vue'
import type { EstadoPedido, Pedido } from '../../services/pedidosService'
import { TODOS_LOS_ESTADOS } from '../../services/pedidosService'
import {
  ESTADO_LABELS,
  ESTADO_BADGE,
  diasRetencion,
  retencionColor,
  retencionDotColor,
  formatFechaLarga,
} from '../../composables/usePedidoEstado'

/**
 * Drawer lateral con el detalle de un pedido. Incluye edición inline,
 * transiciones de estado, toggle de retención, WA, eliminar, historial.
 *
 * El padre controla visibilidad con v-model:visible y recibe eventos
 * para las acciones. La edición inline vive local al drawer (no tiene
 * sentido sacarla al padre).
 */
const props = defineProps<{
  visible: boolean
  pedido: Pedido | null
  loading: boolean
}>()

const emit = defineEmits<{
  'update:visible': [v: boolean]
  'cambiar-estado': [nuevo: EstadoPedido]
  'toggle-retencion': [p: Pedido]
  editar: [payload: {
    cliente_nombre: string
    cliente_telefono: string
    direccion: string
    notas: string
    dias_en_agencia: number
    monto: number
    guia: string
  }]
  'abrir-wa': [p: Pedido]
  'abrir-tracking': [guia: string]
  eliminar: [p: Pedido]
}>()

// Edición inline
const editando = ref(false)
const editForm = ref({
  cliente_nombre: '',
  cliente_telefono: '',
  direccion: '',
  notas: '',
  dias_en_agencia: 0,
  monto: 0,
  guia: '',
})

function iniciarEdicion() {
  if (!props.pedido) return
  editForm.value = {
    cliente_nombre: props.pedido.cliente_nombre || props.pedido.clientes?.nombre || '',
    cliente_telefono: props.pedido.cliente_telefono || props.pedido.clientes?.telefono || '',
    direccion: props.pedido.direccion,
    notas: props.pedido.notas || '',
    dias_en_agencia: props.pedido.dias_en_agencia,
    monto: Number(props.pedido.monto),
    guia: props.pedido.guia,
  }
  editando.value = true
}

function guardar() {
  emit('editar', { ...editForm.value })
}

// Si cambia el pedido cargado, salimos del modo edición.
watch(() => props.pedido?.id, () => {
  editando.value = false
})
</script>

<template>
  <Drawer
    :visible="visible"
    @update:visible="(v) => emit('update:visible', v)"
    position="right"
    :style="{ width: '460px' }"
    :pt="{
      root: { class: 'border-l border-lavanda-medio' },
      header: { class: 'bg-navy text-white p-4' },
      title: { class: 'font-bold text-lg' },
      content: { class: 'p-0' },
      headerActions: { class: 'text-white' },
    }"
  >
    <template #header>
      <span class="font-bold text-lg">Detalle del Pedido</span>
    </template>

    <div v-if="loading" class="flex items-center justify-center py-20">
      <i class="pi pi-spin pi-spinner text-3xl text-mauve"></i>
    </div>

    <div v-else-if="pedido" class="flex flex-col h-full overflow-y-auto">
      <!-- Cabecera: estado + guía + cliente -->
      <div class="bg-lavanda/50 p-5 border-b border-lavanda-medio">
        <div class="flex items-center justify-between mb-3">
          <span
            class="px-3 py-1 rounded-full text-xs font-bold"
            :class="ESTADO_BADGE[pedido.estado] || 'bg-gray-100 text-gray-700'"
          >
            {{ ESTADO_LABELS[pedido.estado] || pedido.estado }}
          </span>
          <button
            @click="emit('abrir-tracking', pedido.guia)"
            class="text-sm text-mauve font-bold hover:underline"
          >
            {{ pedido.guia }} <i class="pi pi-copy text-xs" aria-hidden="true"></i>
          </button>
        </div>

        <div class="flex items-center gap-3">
          <div class="w-10 h-10 bg-navy rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
            {{ (pedido.cliente_nombre || pedido.clientes?.nombre || '?').charAt(0).toUpperCase() }}
          </div>
          <div>
            <p class="font-bold text-navy">{{ pedido.cliente_nombre || pedido.clientes?.nombre }}</p>
            <p class="text-xs text-navy/60">{{ pedido.cliente_telefono || pedido.clientes?.telefono }}</p>
          </div>
        </div>
      </div>

      <!-- Datos del pedido / Form edición -->
      <div class="p-5 border-b border-lavanda-medio space-y-3">
        <template v-if="!editando">
          <div class="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p class="text-xs text-navy/50 font-bold">Producto</p>
              <p class="text-navy font-medium">{{ pedido.productos?.nombre }}</p>
            </div>
            <div>
              <p class="text-xs text-navy/50 font-bold">Monto</p>
              <p class="text-navy font-medium">${{ Number(pedido.monto).toFixed(2) }}</p>
            </div>
            <div>
              <p class="text-xs text-navy/50 font-bold">Tipo entrega</p>
              <p class="text-navy font-medium">{{ pedido.tipo_entrega }}</p>
            </div>
            <div>
              <p class="text-xs text-navy/50 font-bold">Fecha despacho</p>
              <p class="text-navy font-medium">{{ formatFechaLarga(pedido.fecha_despacho) }}</p>
            </div>
            <div class="col-span-2">
              <p class="text-xs text-navy/50 font-bold">Dirección</p>
              <p class="text-navy font-medium">{{ pedido.direccion }}</p>
              <p v-if="pedido.provincia" class="text-xs text-navy/50 mt-0.5">
                <i class="pi pi-map-marker mr-1" aria-hidden="true"></i>{{ pedido.provincia }}
              </p>
            </div>
            <div v-if="pedido.dias_en_agencia > 0" class="col-span-2">
              <p class="text-xs text-navy/50 font-bold">Días en agencia</p>
              <p class="font-medium" :class="pedido.dias_en_agencia >= 6 ? 'text-alerta' : 'text-navy'">
                {{ pedido.dias_en_agencia }} de 8
              </p>
            </div>
            <div v-if="pedido.notas" class="col-span-2">
              <p class="text-xs text-navy/50 font-bold">Notas</p>
              <p class="text-navy font-medium">{{ pedido.notas }}</p>
            </div>
            <div v-if="pedido.canal_origen" class="col-span-2">
              <p class="text-xs text-navy/50 font-bold">Canal origen</p>
              <p class="text-navy font-medium">{{ pedido.canal_origen }}</p>
            </div>
          </div>
        </template>

        <template v-else>
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-navy mb-1">Nombre cliente</label>
                <input v-model="editForm.cliente_nombre" type="text" class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-sm focus:outline-none focus:border-mauve" />
              </div>
              <div>
                <label class="block text-xs font-bold text-navy mb-1">WhatsApp</label>
                <input v-model="editForm.cliente_telefono" type="text" class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-sm focus:outline-none focus:border-mauve" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-bold text-navy mb-1">Guía</label>
                <input v-model="editForm.guia" type="text" class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-sm focus:outline-none focus:border-mauve" />
              </div>
              <div>
                <label class="block text-xs font-bold text-navy mb-1">Monto ($)</label>
                <input v-model.number="editForm.monto" type="number" step="0.01" min="0" class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-sm focus:outline-none focus:border-mauve" />
              </div>
            </div>
            <div>
              <label class="block text-xs font-bold text-navy mb-1">Dirección</label>
              <input v-model="editForm.direccion" type="text" class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-sm focus:outline-none focus:border-mauve" />
            </div>
            <div>
              <label class="block text-xs font-bold text-navy mb-1">Notas</label>
              <textarea v-model="editForm.notas" rows="2" class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-sm focus:outline-none focus:border-mauve resize-none"></textarea>
            </div>
            <div>
              <label class="block text-xs font-bold text-navy mb-1">Días en agencia</label>
              <input v-model.number="editForm.dias_en_agencia" type="number" min="0" class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-sm focus:outline-none focus:border-mauve" />
            </div>
            <div class="flex gap-2">
              <button @click="editando = false" class="px-3 py-1.5 text-xs font-bold border border-lavanda-medio rounded-lg text-navy hover:bg-lavanda transition">
                Cancelar
              </button>
              <button @click="guardar" class="px-3 py-1.5 text-xs font-bold bg-mauve text-white rounded-lg hover:opacity-90 transition">
                Guardar
              </button>
            </div>
          </div>
        </template>
      </div>

      <!-- Retención 8 días -->
      <div class="px-5 py-3 border-b border-lavanda-medio">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <i class="pi pi-clock text-navy/50" aria-hidden="true"></i>
            <span class="text-xs font-bold text-navy/60">Retención 8 días</span>
          </div>
          <button
            @click="emit('toggle-retencion', pedido)"
            class="px-3 py-1.5 text-xs font-bold rounded-lg transition"
            :class="pedido.retencion_inicio
              ? 'bg-navy text-white hover:opacity-80'
              : 'border border-lavanda-medio text-navy hover:bg-lavanda'"
          >
            {{ pedido.retencion_inicio ? 'Desactivar' : 'Activar' }}
          </button>
        </div>
        <div
          v-if="pedido.retencion_inicio"
          class="mt-2 flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-bold"
          :class="retencionColor(diasRetencion(pedido.retencion_inicio))"
        >
          <span class="w-2 h-2 rounded-full" :class="retencionDotColor(diasRetencion(pedido.retencion_inicio))"></span>
          Día {{ diasRetencion(pedido.retencion_inicio) }} de 8
          <span v-if="diasRetencion(pedido.retencion_inicio) >= 7" class="ml-auto text-xs">Riesgo de devolución</span>
          <span v-else-if="diasRetencion(pedido.retencion_inicio) >= 5" class="ml-auto text-xs">Alerta</span>
          <span v-else class="ml-auto text-xs">En tiempo</span>
        </div>
      </div>

      <!-- Acciones (transiciones + editar + WA + eliminar) -->
      <div class="p-5 border-b border-lavanda-medio flex flex-wrap gap-2">
        <button
          v-for="trans in TODOS_LOS_ESTADOS.filter(e => e !== pedido?.estado)"
          :key="trans"
          @click="emit('cambiar-estado', trans as EstadoPedido)"
          class="px-3 py-1.5 text-xs font-bold rounded-lg border transition"
          :class="ESTADO_BADGE[trans] || 'bg-gray-100 text-gray-700'"
        >
          → {{ ESTADO_LABELS[trans] || trans }}
        </button>

        <div class="flex-1"></div>

        <button
          v-if="!editando"
          @click="iniciarEdicion"
          class="px-3 py-1.5 text-xs font-bold border border-lavanda-medio rounded-lg text-navy hover:bg-lavanda transition"
        >
          <i class="pi pi-pencil"></i> Editar
        </button>

        <button
          @click="emit('abrir-wa', pedido)"
          class="px-3 py-1.5 text-xs font-bold bg-wa-green text-white rounded-lg hover:opacity-90 transition"
        >
          <i class="pi pi-whatsapp"></i> WA
        </button>

        <button
          @click="emit('eliminar', pedido)"
          class="px-3 py-1.5 text-xs font-bold text-alerta border border-alerta/30 rounded-lg hover:bg-red-50 transition flex items-center gap-1"
        >
          <i class="pi pi-trash" aria-hidden="true"></i> Eliminar
        </button>
      </div>

      <!-- Timeline historial -->
      <div class="p-5 flex-1">
        <h4 class="text-sm font-bold text-navy/60 uppercase tracking-wider mb-4">
          <i class="pi pi-history"></i> Historial de Estados
        </h4>
        <PedidoTimeline :historial="pedido.historial || []" />
      </div>
    </div>
  </Drawer>
</template>
