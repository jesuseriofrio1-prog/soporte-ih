<script setup lang="ts">
import type { HistorialEstado } from '../../services/pedidosService'

defineProps<{
  historial: HistorialEstado[]
}>()

const estadoColores: Record<string, string> = {
  INGRESANDO: 'bg-gray-400',
  EN_TRANSITO: 'bg-blue-500',
  EN_AGENCIA: 'bg-purple-500',
  EN_REPARTO: 'bg-yellow-500',
  ENTREGADO: 'bg-green-500',
  NOVEDAD: 'bg-orange-500',
  DEVUELTO: 'bg-red-500',
}

const estadoLabels: Record<string, string> = {
  INGRESANDO: 'Ingresando',
  EN_TRANSITO: 'En Tránsito',
  EN_AGENCIA: 'En Agencia',
  EN_REPARTO: 'En Reparto',
  ENTREGADO: 'Entregado',
  NOVEDAD: 'Novedad',
  DEVUELTO: 'Devuelto',
}

function formatFechaHora(fecha: string): string {
  return new Date(fecha).toLocaleString('es-EC', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="relative">
    <div v-if="historial.length === 0" class="text-center py-4 text-navy/40 text-sm">
      Sin historial de estados
    </div>

    <div v-else class="space-y-0">
      <div
        v-for="(item, idx) in historial"
        :key="item.id"
        class="relative flex gap-3"
      >
        <!-- Línea vertical -->
        <div class="flex flex-col items-center">
          <div
            class="w-3 h-3 rounded-full shrink-0 mt-1.5"
            :class="estadoColores[item.estado_nuevo] || 'bg-gray-400'"
          ></div>
          <div
            v-if="idx < historial.length - 1"
            class="w-0.5 flex-1 bg-lavanda-medio min-h-[32px]"
          ></div>
        </div>

        <!-- Contenido -->
        <div class="pb-4 flex-1">
          <p class="text-sm font-bold text-navy">
            {{ estadoLabels[item.estado_nuevo] || item.estado_nuevo }}
          </p>
          <p v-if="item.estado_anterior" class="text-[10px] text-navy/40">
            desde {{ estadoLabels[item.estado_anterior] || item.estado_anterior }}
          </p>
          <p class="text-xs text-navy/50 mt-0.5">
            {{ formatFechaHora(item.created_at) }}
          </p>
          <p v-if="item.nota" class="text-xs text-navy/70 mt-1 bg-lavanda/50 px-2 py-1 rounded">
            {{ item.nota }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
