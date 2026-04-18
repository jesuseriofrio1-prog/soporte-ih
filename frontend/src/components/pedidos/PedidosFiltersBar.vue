<script setup lang="ts">
import type { AntiguedadKey } from '../../composables/usePedidosFiltros'
import type { Producto } from '../../services/productosService'
import { ESTADOS_DISPONIBLES } from '../../composables/usePedidoEstado'

/**
 * Barra superior de /pedidos: chips de vista rápida + filtros secundarios
 * (producto, estado) + botones de acción (sincronizar, importar, nuevo).
 *
 * Todo el estado vive en el padre; este componente es puramente visual
 * y se comunica con v-model / emits.
 */

interface Chip {
  key: AntiguedadKey
  label: string
  count: number
  alerta: boolean
}

defineProps<{
  chips: Chip[]
  filtroAntiguedad: AntiguedadKey
  filtroProducto: string
  filtroEstado: string
  productos: Producto[]
  sincronizando: boolean
}>()

const emit = defineEmits<{
  'update:filtroAntiguedad': [v: AntiguedadKey]
  'update:filtroProducto': [v: string]
  'update:filtroEstado': [v: string]
  sincronizar: []
  importar: []
  'nuevo-pedido': []
}>()
</script>

<template>
  <div class="bg-white rounded-xl shadow-sm border border-lavanda-medio">
    <!-- Chips de vista rápida -->
    <div class="px-3 pt-3 pb-2 flex flex-wrap gap-2 border-b border-lavanda-medio/60">
      <button
        v-for="chip in chips"
        :key="chip.key"
        @click="emit('update:filtroAntiguedad', chip.key)"
        class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold transition border"
        :class="[
          filtroAntiguedad === chip.key
            ? (chip.alerta && chip.count > 0
                ? 'bg-red-600 text-white border-red-600 shadow-sm'
                : 'bg-mauve text-white border-mauve shadow-sm')
            : (chip.alerta && chip.count > 0
                ? 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100'
                : 'bg-white text-navy border-lavanda-medio hover:bg-lavanda/30')
        ]"
      >
        <i v-if="chip.alerta && chip.count > 0" class="pi pi-exclamation-triangle text-xs" aria-hidden="true"></i>
        <span>{{ chip.label }}</span>
        <span
          class="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 text-[11px] rounded-full"
          :class="[
            filtroAntiguedad === chip.key
              ? 'bg-white/25 text-white'
              : (chip.alerta && chip.count > 0 ? 'bg-red-200 text-red-800' : 'bg-lavanda/60 text-navy/70')
          ]"
        >
          {{ chip.count }}
        </span>
      </button>
    </div>

    <!-- Filtros secundarios + acciones -->
    <div class="px-3 py-2.5 flex flex-wrap gap-3 items-center justify-between">
      <div class="flex items-center gap-2 flex-wrap">
        <i class="pi pi-filter text-mauve text-sm" aria-hidden="true"></i>
        <select
          :value="filtroProducto"
          @change="emit('update:filtroProducto', ($event.target as HTMLSelectElement).value)"
          class="px-3 py-1.5 text-sm bg-lavanda/40 border border-lavanda-medio rounded-lg focus:outline-none focus:border-mauve text-navy font-medium"
        >
          <option value="">Todos los productos</option>
          <option v-for="p in productos" :key="p.id" :value="p.id">
            {{ p.nombre }}
          </option>
        </select>

        <select
          :value="filtroEstado"
          @change="emit('update:filtroEstado', ($event.target as HTMLSelectElement).value)"
          class="px-3 py-1.5 text-sm bg-lavanda/40 border border-lavanda-medio rounded-lg focus:outline-none focus:border-mauve text-navy font-medium"
        >
          <option v-for="e in ESTADOS_DISPONIBLES" :key="e.value" :value="e.value">
            {{ e.label }}
          </option>
        </select>
      </div>

      <div class="flex items-center gap-2">
        <button
          @click="emit('sincronizar')"
          :disabled="sincronizando"
          class="bg-navy text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:opacity-90 transition flex items-center gap-2 shadow-sm disabled:opacity-50"
        >
          <i :class="sincronizando ? 'pi pi-spin pi-spinner' : 'pi pi-sync'" aria-hidden="true"></i>
          <span class="hidden md:inline">{{ sincronizando ? 'Sincronizando...' : 'Sincronizar' }}</span>
        </button>
        <button
          @click="emit('importar')"
          class="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm font-bold hover:opacity-90 transition flex items-center gap-2 shadow-sm"
          title="Importar pedidos desde Rocket Ecuador"
        >
          <i class="pi pi-file-excel" aria-hidden="true"></i>
          <span class="hidden md:inline">Importar Rocket</span>
        </button>
        <button
          @click="emit('nuevo-pedido')"
          class="bg-mauve text-white px-4 py-1.5 rounded-lg text-sm font-bold hover:opacity-90 transition flex items-center gap-2 shadow-sm"
        >
          <i class="pi pi-plus"></i> Nuevo Pedido
        </button>
      </div>
    </div>
  </div>
</template>
