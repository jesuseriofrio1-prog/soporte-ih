<script setup lang="ts">
import { ref, computed } from 'vue'
import { TRANSICIONES_VALIDAS, type EstadoPedido } from '../../services/pedidosService'

const props = defineProps<{
  estado: EstadoPedido
  diasEnAgencia?: number
}>()

const emit = defineEmits<{
  cambiar: [nuevoEstado: EstadoPedido]
}>()

const dropdownOpen = ref(false)

/** Colores por estado */
const estilos: Record<string, { bg: string; text: string; label: string }> = {
  INGRESANDO: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Ingresando' },
  EN_TRANSITO: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'En Tránsito' },
  EN_AGENCIA: { bg: 'bg-purple-100', text: 'text-purple-700', label: 'En Agencia' },
  EN_REPARTO: { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'En Reparto' },
  ENTREGADO: { bg: 'bg-green-100', text: 'text-green-700', label: 'Entregado' },
  NOVEDAD: { bg: 'bg-orange-100', text: 'text-orange-700', label: 'Novedad' },
  DEVUELTO: { bg: 'bg-red-100', text: 'text-red-700', label: 'Devuelto' },
}

const estilo = computed(() => estilos[props.estado] || estilos.INGRESANDO)

const transicionesDisponibles = computed(() => {
  return TRANSICIONES_VALIDAS[props.estado] || []
})

const esFinal = computed(() => transicionesDisponibles.value.length === 0)

function seleccionar(nuevoEstado: EstadoPedido) {
  dropdownOpen.value = false
  emit('cambiar', nuevoEstado)
}

function toggleDropdown() {
  if (!esFinal.value) {
    dropdownOpen.value = !dropdownOpen.value
  }
}

function cerrarDropdown() {
  dropdownOpen.value = false
}
</script>

<template>
  <div class="relative inline-block" @mouseleave="cerrarDropdown">
    <!-- Badge -->
    <button
      @click="toggleDropdown"
      class="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold transition"
      :class="[
        estilo.bg,
        estilo.text,
        esFinal ? 'cursor-default' : 'cursor-pointer hover:opacity-80',
      ]"
    >
      {{ estilo.label }}
      <i v-if="!esFinal" class="pi pi-chevron-down text-[10px]"></i>
    </button>

    <!-- Indicador de días en agencia -->
    <span
      v-if="estado === 'EN_AGENCIA' && diasEnAgencia !== undefined"
      class="ml-1 text-xs font-bold"
      :class="diasEnAgencia >= 6 ? 'text-alerta' : 'text-navy/50'"
    >
      Día {{ diasEnAgencia }} de 8
    </span>

    <!-- Dropdown -->
    <div
      v-if="dropdownOpen"
      class="absolute top-full left-0 mt-1 bg-white rounded-lg shadow-lg border border-lavanda-medio z-50 min-w-[160px] py-1"
    >
      <button
        v-for="opcion in transicionesDisponibles"
        :key="opcion"
        @click="seleccionar(opcion)"
        class="w-full text-left px-3 py-2 text-xs font-medium hover:bg-lavanda transition flex items-center gap-2"
      >
        <span
          class="w-2 h-2 rounded-full"
          :class="estilos[opcion]?.bg.replace('100', '500') || 'bg-gray-500'"
        ></span>
        {{ estilos[opcion]?.label || opcion }}
      </button>
    </div>
  </div>
</template>
