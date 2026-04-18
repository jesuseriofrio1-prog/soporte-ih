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

/**
 * Mapa de estados → pills semánticos del design system v2.
 * Todos los estados se categorizan en 5 semánticas: emerald (entregado),
 * blue (en progreso/tránsito), amber (requiere atención), rose (fallidos),
 * stone (pendiente/neutro).
 */
const estilos: Record<string, { pill: string; dot: string; label: string }> = {
  PENDIENTE:         { pill: 'pill-amber',   dot: 'dot-amber',   label: 'Pendiente' },
  CONFIRMADO:        { pill: 'pill-blue',    dot: 'dot-blue',    label: 'Confirmado' },
  EN_PREPARACION:    { pill: 'pill-blue',    dot: 'dot-blue',    label: 'En Preparación' },
  ENVIADO:           { pill: 'pill-blue',    dot: 'dot-blue',    label: 'Enviado' },
  EN_RUTA:           { pill: 'pill-blue',    dot: 'dot-blue',    label: 'En Ruta' },
  NOVEDAD:           { pill: 'pill-amber',   dot: 'dot-amber',   label: 'Novedad' },
  RETIRO_EN_AGENCIA: { pill: 'pill-blue',    dot: 'dot-blue',    label: 'Retiro en Agencia' },
  ENTREGADO:         { pill: 'pill-emerald', dot: 'dot-emerald', label: 'Entregado' },
  NO_ENTREGADO:      { pill: 'pill-rose',    dot: 'dot-rose',    label: 'No Entregado' },
  DEVUELTO:          { pill: 'pill-rose',    dot: 'dot-rose',    label: 'Devuelto' },
}

const defaultEstilo = { pill: 'pill-blue', dot: 'dot-blue', label: '' }
const estilo = computed(() => {
  const e = estilos[props.estado]
  if (e) return e
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
      class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium transition max-w-[220px] leading-tight"
      :class="[
        estilo.pill,
        esFinal ? 'cursor-default' : 'cursor-pointer hover:opacity-80',
      ]"
    >
      <span class="state-dot" :class="estilo.dot"></span>
      {{ estilo.label }}
      <svg v-if="!esFinal" class="w-2.5 h-2.5 opacity-70" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M3 5l3 3 3-3" stroke-linecap="round"/>
      </svg>
    </button>

    <!-- Indicador días en agencia -->
    <span
      v-if="estado === 'RETIRO_EN_AGENCIA' && diasEnAgencia !== undefined"
      class="ml-1 text-[11px] font-medium tabular font-mono"
      :style="diasEnAgencia >= 6 ? { color: 'var(--rose-dot)' } : { color: 'var(--ink-faint)' }"
    >
      {{ diasEnAgencia }}/8d
    </span>

    <!-- Dropdown -->
    <Teleport to="body">
      <div
        v-if="dropdownOpen"
        class="fixed surface rounded-md min-w-[190px] py-1 thin-scroll"
        :style="{ top: dropdownStyle.top, left: dropdownStyle.left, zIndex: 9999, boxShadow: 'var(--shadow-md)' }"
        @mouseenter="cancelClose"
        @mouseleave="scheduleClose"
      >
        <button
          v-for="opcion in transicionesDisponibles"
          :key="opcion"
          @click="seleccionar(opcion)"
          class="w-full text-left px-3 py-2 text-[12px] font-medium hover:bg-paper-alt transition flex items-center gap-2"
        >
          <span class="state-dot" :class="estilos[opcion]?.dot || 'dot-stone'"></span>
          <span>{{ estilos[opcion]?.label || opcion }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>
