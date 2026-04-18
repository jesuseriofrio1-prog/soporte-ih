<script setup lang="ts">
import type { HistorialEstado } from '../../services/pedidosService'

defineProps<{
  historial: HistorialEstado[]
}>()

const estadoColores: Record<string, string> = {
  PENDIENTE:         'dot-stone',
  CONFIRMADO:        'dot-blue',
  EN_PREPARACION:    'dot-blue',
  ENVIADO:           'dot-blue',
  EN_RUTA:           'dot-blue',
  NOVEDAD:           'dot-amber',
  RETIRO_EN_AGENCIA: 'dot-blue',
  ENTREGADO:         'dot-emerald',
  NO_ENTREGADO:      'dot-rose',
  DEVUELTO:          'dot-rose',
}

const estadoLabels: Record<string, string> = {
  PENDIENTE: 'Pendiente',
  CONFIRMADO: 'Confirmado',
  EN_PREPARACION: 'En Preparación',
  ENVIADO: 'Enviado',
  EN_RUTA: 'En Ruta',
  NOVEDAD: 'Novedad',
  RETIRO_EN_AGENCIA: 'Retiro en Agencia',
  ENTREGADO: 'Entregado',
  NO_ENTREGADO: 'No Entregado',
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
    <div v-if="historial.length === 0" class="text-center py-4 text-[12px] text-ink-faint">
      Sin historial de estados
    </div>

    <ol v-else class="relative border-l hairline ml-2 pl-5 space-y-5">
      <li
        v-for="item in historial"
        :key="item.id"
        class="relative"
      >
        <span
          class="absolute -left-[27px] top-1 w-3 h-3 rounded-full"
          :class="estadoColores[item.estado_nuevo] || 'dot-stone'"
          :style="{ boxShadow: '0 0 0 4px var(--paper-elev)' }"
        ></span>
        <div class="text-[11px] text-ink-faint tabular font-mono mb-0.5">
          {{ formatFechaHora(item.created_at) }}
        </div>
        <div class="text-[13px] font-medium">
          {{ estadoLabels[item.estado_nuevo] || item.estado_nuevo }}
        </div>
        <div v-if="item.estado_anterior" class="text-[11px] text-ink-faint">
          desde {{ estadoLabels[item.estado_anterior] || item.estado_anterior }}
        </div>
        <div v-if="item.nota" class="text-[12px] text-ink-muted mt-1">
          {{ item.nota }}
        </div>
      </li>
    </ol>
  </div>
</template>
