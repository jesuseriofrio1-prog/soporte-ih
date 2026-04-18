<script setup lang="ts">
import PedidoStatusBadge from './PedidoStatusBadge.vue'
import type { EstadoPedido, Pedido } from '../../services/pedidosService'
import {
  diasRetencion,
  retencionColor,
  retencionDotColor,
  filaAlerta,
  formatFecha,
} from '../../composables/usePedidoEstado'

/**
 * Tabla de pedidos. Toda la lógica de filtrado/ordenado vive en el padre;
 * aquí solo renderizamos y emitimos eventos.
 */

defineProps<{
  pedidos: Pedido[]
  sortKey: string
  loading: boolean
  empty: boolean
  sortLabel: (key: string) => string
}>()

const emit = defineEmits<{
  sort: [key: string]
  'abrir-detalle': [p: Pedido]
  'cambiar-estado': [id: string, nuevo: EstadoPedido]
  'toggle-retencion': [p: Pedido]
  'abrir-wa': [p: Pedido]
  'abrir-tracking': [guia: string]
}>()
</script>

<template>
  <div v-if="loading" class="text-center py-12">
    <i class="pi pi-spin pi-spinner text-4xl text-mauve"></i>
    <p class="text-navy/60 mt-2">Cargando pedidos...</p>
  </div>

  <div v-else class="bg-white rounded-xl shadow-sm border border-lavanda-medio overflow-x-auto">
    <table class="w-full text-left min-w-[700px]">
      <thead class="bg-lavanda-medio text-navy text-xs uppercase font-bold tracking-wider">
        <tr>
          <th class="p-4 cursor-pointer hover:bg-lavanda transition select-none" @click="emit('sort', 'fecha')">
            <span class="flex items-center gap-1">
              Cliente / Fecha
              <span class="text-base" :class="sortKey === 'fecha' ? 'opacity-100' : 'opacity-30'">{{ sortLabel('fecha') }}</span>
            </span>
          </th>
          <th class="p-4 cursor-pointer hover:bg-lavanda transition select-none" @click="emit('sort', 'monto')">
            <span class="flex items-center gap-1">
              Producto
              <span class="text-base" :class="sortKey === 'monto' ? 'opacity-100' : 'opacity-30'">{{ sortLabel('monto') }}</span>
            </span>
          </th>
          <th class="p-4 cursor-pointer hover:bg-lavanda transition select-none" @click="emit('sort', 'destino')">
            <span class="flex items-center gap-1">
              Destino
              <span class="text-base" :class="sortKey === 'destino' ? 'opacity-100' : 'opacity-30'">{{ sortLabel('destino') }}</span>
            </span>
          </th>
          <th class="p-4 cursor-pointer hover:bg-lavanda transition select-none" @click="emit('sort', 'estado')">
            <span class="flex items-center gap-1">
              Estado
              <span class="text-base" :class="sortKey === 'estado' ? 'opacity-100' : 'opacity-30'">{{ sortLabel('estado') }}</span>
            </span>
          </th>
          <th class="p-4 text-center">Acción</th>
        </tr>
      </thead>
      <tbody class="text-sm divide-y divide-lavanda">
        <tr
          v-for="pedido in pedidos"
          :key="pedido.id"
          class="transition cursor-pointer"
          :class="filaAlerta(pedido.estado, pedido.dias_en_agencia) ? 'bg-red-50' : 'hover:bg-lavanda/50'"
          @click="emit('abrir-detalle', pedido)"
        >
          <td class="p-4">
            <p class="font-bold text-navy">{{ pedido.cliente_nombre || pedido.clientes?.nombre || '—' }}</p>
            <p class="text-xs text-navy/60">{{ pedido.cliente_telefono || pedido.clientes?.telefono || '—' }}</p>
            <p class="text-xs text-navy/40 mt-1">
              {{ formatFecha(pedido.created_at) }} ·
              <button
                @click.stop="emit('abrir-tracking', pedido.guia)"
                class="text-mauve hover:underline font-medium"
              >
                {{ pedido.guia }}
              </button>
            </p>
          </td>

          <td class="p-4">
            <span class="font-medium text-navy">{{ pedido.productos?.nombre || '—' }}</span>
            <p class="text-xs text-navy/50">${{ Number(pedido.monto).toFixed(2) }}</p>
          </td>

          <td class="p-4">
            <span
              class="inline-block px-2 py-0.5 rounded text-xs font-bold mb-1"
              :class="pedido.tipo_entrega === 'DOMICILIO' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'"
            >
              {{ pedido.tipo_entrega }}
            </span>
            <p class="text-xs text-navy/60 max-w-[180px] truncate">{{ pedido.direccion }}</p>
          </td>

          <td class="p-4" @click.stop>
            <PedidoStatusBadge
              :estado="pedido.estado"
              :dias-en-agencia="pedido.dias_en_agencia"
              @cambiar="(nuevo) => emit('cambiar-estado', pedido.id, nuevo)"
            />
            <div
              v-if="pedido.retencion_inicio"
              class="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border"
              :class="retencionColor(diasRetencion(pedido.retencion_inicio))"
            >
              <span class="w-1.5 h-1.5 rounded-full" :class="retencionDotColor(diasRetencion(pedido.retencion_inicio))"></span>
              Día {{ diasRetencion(pedido.retencion_inicio) }} / 8
            </div>
          </td>

          <td class="p-4 text-center" @click.stop>
            <div class="flex flex-col items-center gap-1">
              <button
                @click="emit('toggle-retencion', pedido)"
                class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition"
                :class="pedido.retencion_inicio
                  ? 'bg-navy text-white hover:opacity-80'
                  : 'border border-lavanda-medio text-navy hover:bg-lavanda'"
              >
                <i class="pi pi-clock" aria-hidden="true"></i>
                {{ pedido.retencion_inicio ? 'Día ' + diasRetencion(pedido.retencion_inicio) : '8 días' }}
              </button>
              <button
                v-if="pedido.cliente_telefono || pedido.clientes?.telefono"
                @click="emit('abrir-wa', pedido)"
                class="inline-flex items-center gap-1 bg-wa-green text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:opacity-90 transition"
              >
                <i class="pi pi-whatsapp"></i> WA
              </button>
            </div>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="empty" class="text-center py-12">
      <i class="pi pi-truck text-5xl text-lavanda-medio"></i>
      <p class="text-navy/60 mt-3">No hay pedidos con estos filtros</p>
    </div>
  </div>
</template>
