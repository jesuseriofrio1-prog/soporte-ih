<script setup lang="ts">
import { ref, computed, nextTick, onBeforeUnmount } from 'vue'
import { TODOS_LOS_ESTADOS, type EstadoPedido } from '../../services/pedidosService'

const props = defineProps<{
  estado: EstadoPedido
  diasEnAgencia?: number
}>()

const emit = defineEmits<{
  cambiar: [nuevoEstado: EstadoPedido]
}>()

const dropdownOpen = ref(false)
const badgeRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref({ top: '0px', left: '0px' })
let closeTimer: ReturnType<typeof setTimeout> | null = null

const estilos: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  PENDIENTE: { bg: 'bg-gray-100', text: 'text-gray-700', dot: 'bg-gray-500', label: 'Pendiente' },
  CONFIRMADO: { bg: 'bg-blue-100', text: 'text-blue-700', dot: 'bg-blue-500', label: 'Confirmado' },
  EN_PREPARACION: { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500', label: 'En Preparación' },
  ENVIADO: { bg: 'bg-cyan-100', text: 'text-cyan-700', dot: 'bg-cyan-500', label: 'Enviado' },
  EN_RUTA: { bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-500', label: 'En Ruta' },
  NOVEDAD: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500', label: 'Novedad' },
  RETIRO_EN_AGENCIA: { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500', label: 'Retiro en Agencia' },
  ENTREGADO: { bg: 'bg-green-100', text: 'text-green-700', dot: 'bg-green-500', label: 'Entregado' },
  NO_ENTREGADO: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500', label: 'No Entregado' },
  DEVUELTO: { bg: 'bg-red-200', text: 'text-red-800', dot: 'bg-red-800', label: 'Devuelto' },
}

const defaultEstilo = { bg: 'bg-sky-100', text: 'text-sky-700', dot: 'bg-sky-500', label: '' }
const estilo = computed(() => {
  const e = estilos[props.estado]
  if (e) return e
  // Estado de Servientrega no predefinido — mostrar tal cual
  return { ...defaultEstilo, label: props.estado }
})
const transicionesDisponibles = computed(() =>
  TODOS_LOS_ESTADOS.filter((e) => e !== props.estado)
)
const esFinal = false

function seleccionar(nuevoEstado: EstadoPedido) {
  cancelClose()
  dropdownOpen.value = false
  emit('cambiar', nuevoEstado)
}

async function toggleDropdown() {
  if (esFinal) return
  cancelClose()

  if (dropdownOpen.value) {
    dropdownOpen.value = false
    return
  }

  dropdownOpen.value = true
  await nextTick()

  if (badgeRef.value) {
    const rect = badgeRef.value.getBoundingClientRect()
    dropdownStyle.value = {
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
    }
  }
}

function scheduleClose() {
  cancelClose()
  closeTimer = setTimeout(() => {
    dropdownOpen.value = false
  }, 200)
}

function cancelClose() {
  if (closeTimer) {
    clearTimeout(closeTimer)
    closeTimer = null
  }
}

onBeforeUnmount(() => {
  cancelClose()
})
</script>

<template>
  <div
    class="relative inline-block"
    @mouseenter="cancelClose"
    @mouseleave="scheduleClose"
  >
    <!-- Badge -->
    <button
      ref="badgeRef"
      @click="toggleDropdown"
      class="inline-flex items-center gap-1 px-2 py-1 rounded-full font-bold transition max-w-[220px] text-[10px] leading-tight"
      :class="[
        estilo.bg,
        estilo.text,
        esFinal ? 'cursor-default' : 'cursor-pointer hover:opacity-80',
      ]"
    >
      {{ estilo.label }}
      <i v-if="!esFinal" class="pi pi-chevron-down text-[10px]" aria-hidden="true"></i>
    </button>

    <!-- Indicador de días en agencia -->
    <span
      v-if="estado === 'RETIRO_EN_AGENCIA' && diasEnAgencia !== undefined"
      class="ml-1 text-xs font-bold"
      :class="diasEnAgencia >= 6 ? 'text-alerta' : 'text-navy/50'"
    >
      Día {{ diasEnAgencia }} de 8
    </span>

    <!-- Dropdown -->
    <Teleport to="body">
      <div
        v-if="dropdownOpen"
        class="fixed bg-white rounded-lg shadow-xl border border-lavanda-medio min-w-[190px] py-1"
        :style="{ top: dropdownStyle.top, left: dropdownStyle.left, zIndex: 9999 }"
        @mouseenter="cancelClose"
        @mouseleave="scheduleClose"
      >
        <button
          v-for="opcion in transicionesDisponibles"
          :key="opcion"
          @click="seleccionar(opcion)"
          class="w-full text-left px-3 py-2 text-xs font-medium hover:bg-lavanda transition flex items-center gap-2"
        >
          <span
            class="w-2 h-2 rounded-full shrink-0"
            :class="estilos[opcion]?.dot || 'bg-gray-500'"
          ></span>
          <span>{{ estilos[opcion]?.label || opcion }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>
