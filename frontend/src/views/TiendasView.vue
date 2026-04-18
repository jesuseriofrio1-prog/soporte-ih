<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import Dialog from 'primevue/dialog'
import { useTiendaStore } from '../stores/tienda'
import type { Tienda } from '../services/tiendasService'

const toast = useToast()
const tiendaStore = useTiendaStore()

// Modal crear/editar
const modalVisible = ref(false)
const editando = ref(false)
const editId = ref<string | null>(null)
const form = ref({
  nombre: '',
  color_primario: '#0a0a0a',
  color_secundario: '#e11d48',
  color_fondo: '#fafaf9',
  color_borde: '#e7e5e4',
})

function abrirCrear() {
  editando.value = false
  editId.value = null
  form.value = {
    nombre: '',
    color_primario: '#0a0a0a',
    color_secundario: '#e11d48',
    color_fondo: '#fafaf9',
    color_borde: '#e7e5e4',
  }
  modalVisible.value = true
}

function abrirEditar(tienda: Tienda) {
  editando.value = true
  editId.value = tienda.id
  form.value = {
    nombre: tienda.nombre,
    color_primario: tienda.color_primario || '#0a0a0a',
    color_secundario: tienda.color_secundario || '#e11d48',
    color_fondo: tienda.color_fondo || '#fafaf9',
    color_borde: tienda.color_borde || '#e7e5e4',
  }
  modalVisible.value = true
}

async function guardar() {
  if (!form.value.nombre.trim()) {
    toast.warning('El nombre es requerido')
    return
  }

  try {
    if (editando.value && editId.value) {
      await tiendaStore.editarTienda(editId.value, {
        nombre: form.value.nombre,
        color_primario: form.value.color_primario,
        color_secundario: form.value.color_secundario,
        color_fondo: form.value.color_fondo,
        color_borde: form.value.color_borde,
      })
      toast.success('Tienda actualizada')
    } else {
      await tiendaStore.crearTienda({
        nombre: form.value.nombre,
        color_primario: form.value.color_primario,
        color_secundario: form.value.color_secundario,
        color_fondo: form.value.color_fondo,
        color_borde: form.value.color_borde,
      })
      toast.success('Tienda creada')
    }
    modalVisible.value = false
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || 'Error al guardar')
  }
}

async function toggleEstado(tienda: Tienda) {
  try {
    await tiendaStore.editarTienda(tienda.id, { estado: !tienda.estado })
    toast.success(tienda.estado ? 'Tienda desactivada' : 'Tienda activada')
  } catch {
    toast.error('Error al cambiar estado')
  }
}

function formatFecha(fecha: string): string {
  return new Date(fecha).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })
}

onMounted(() => {
  tiendaStore.fetchTiendas()
})
</script>

<template>
  <div class="px-8 py-8">
    <!-- Header -->
    <div class="flex items-end justify-between mb-6 flex-wrap gap-4">
      <div>
        <div class="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint mb-2">
          {{ tiendaStore.tiendas.length }} tienda{{ tiendaStore.tiendas.length === 1 ? '' : 's' }}
        </div>
        <h1 class="h-display text-[40px] leading-none">Tiendas</h1>
      </div>
      <button
        @click="abrirCrear"
        class="h-9 px-3 rounded-md text-[12px] font-medium hover:opacity-90 transition flex items-center gap-2"
        style="background: var(--ink); color: var(--paper);"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M8 3v10M3 8h10" stroke-linecap="round"/>
        </svg>
        Nueva tienda
      </button>
    </div>

    <!-- Grid -->
    <div v-if="tiendaStore.tiendas.length === 0" class="surface empty-pattern rounded-xl py-16 text-center">
      <p class="text-[13px] text-ink-muted">No hay tiendas creadas</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      <div
        v-for="tienda in tiendaStore.tiendas"
        :key="tienda.id"
        class="surface rounded-xl p-5 transition hover:shadow-md"
        :class="{ 'opacity-60': !tienda.estado }"
      >
        <!-- Barra de colores de la tienda -->
        <div class="flex gap-1 mb-4 h-1.5 rounded-full overflow-hidden">
          <div class="flex-1 rounded-full" :style="{ backgroundColor: tienda.color_primario || 'var(--ink)' }"></div>
          <div class="flex-1 rounded-full" :style="{ backgroundColor: tienda.color_secundario || 'var(--accent)' }"></div>
          <div class="flex-1 rounded-full" :style="{ backgroundColor: tienda.color_fondo || 'var(--paper-alt)' }"></div>
          <div class="flex-1 rounded-full" :style="{ backgroundColor: tienda.color_borde || 'var(--line)' }"></div>
        </div>

        <div class="flex items-start justify-between mb-3">
          <div class="min-w-0">
            <h4 class="h-display text-[20px] leading-tight truncate">{{ tienda.nombre }}</h4>
            <p class="text-[11px] text-ink-faint tabular font-mono mt-1">
              Creada {{ formatFecha(tienda.created_at) }} · /p/{{ tienda.slug }}
            </p>
          </div>
          <span
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold shrink-0"
            :class="tienda.estado ? 'pill-emerald' : 'pill-rose'"
          >
            <span class="state-dot" :class="tienda.estado ? 'dot-emerald' : 'dot-rose'"></span>
            {{ tienda.estado ? 'Activa' : 'Inactiva' }}
          </span>
        </div>

        <!-- Indicador activa -->
        <div v-if="tienda.id === tiendaStore.tiendaActivaId" class="mb-3 flex items-center gap-1.5 text-[11px] font-medium" style="color: var(--accent);">
          <span class="state-dot" style="background: var(--accent);"></span>
          Tienda seleccionada
        </div>

        <!-- Acciones -->
        <div class="flex gap-2 pt-3 border-t hairline">
          <button
            v-if="tienda.id !== tiendaStore.tiendaActivaId"
            @click="tiendaStore.setTiendaActiva(tienda.id)"
            class="flex-1 h-8 rounded-md border hairline text-[11px] font-medium hover:bg-paper-alt transition"
          >
            Seleccionar
          </button>
          <button
            @click="abrirEditar(tienda)"
            class="flex-1 h-8 rounded-md border hairline text-[11px] font-medium hover:bg-paper-alt transition"
          >
            Editar
          </button>
          <button
            @click="toggleEstado(tienda)"
            class="h-8 px-3 rounded-md border hairline text-[11px] font-medium hover:bg-paper-alt transition"
            :style="tienda.estado ? { color: 'var(--rose-dot)' } : { color: 'var(--emerald-dot)' }"
          >
            {{ tienda.estado ? 'Desactivar' : 'Activar' }}
          </button>
        </div>
      </div>

      <!-- Card añadir tienda -->
      <button
        @click="abrirCrear"
        class="rounded-xl bg-transparent p-8 flex flex-col items-center justify-center gap-3 transition min-h-[180px] text-ink-faint hover:text-ink"
        style="border: 2px dashed var(--line);"
      >
        <div class="w-12 h-12 rounded-full surface grid place-items-center">
          <svg class="w-5 h-5" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M10 4v12M4 10h12" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="h-display text-[18px]">Nueva tienda</div>
      </button>
    </div>

    <!-- Modal crear/editar -->
    <Dialog
      v-model:visible="modalVisible"
      :header="editando ? 'Editar tienda' : 'Nueva tienda'"
      modal
      :style="{ width: '420px' }"
      :pt="{
        root: { class: 'rounded-xl overflow-hidden' },
        content: { class: 'p-6' },
      }"
    >
      <form @submit.prevent="guardar" class="space-y-4">
        <div>
          <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1.5">
            Nombre de la tienda
          </label>
          <input
            v-model="form.nombre"
            type="text"
            placeholder="Mi Tienda"
            class="w-full px-3 py-2 border hairline rounded-md bg-paper-alt text-[13px] text-ink focus:outline-none focus:border-accent transition"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div v-for="field in [
            { key: 'color_primario', label: 'Primario (accent)' },
            { key: 'color_secundario', label: 'Secundario' },
            { key: 'color_fondo', label: 'Fondo' },
            { key: 'color_borde', label: 'Borde' },
          ]" :key="field.key">
            <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1.5">
              {{ field.label }}
            </label>
            <div class="flex items-center gap-2">
              <input
                v-model="form[field.key as 'color_primario' | 'color_secundario' | 'color_fondo' | 'color_borde']"
                type="color"
                class="w-8 h-8 rounded cursor-pointer border-0"
              />
              <span class="text-[11px] font-mono tabular text-ink-faint">
                {{ form[field.key as 'color_primario' | 'color_secundario' | 'color_fondo' | 'color_borde'] }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            @click="modalVisible = false"
            class="h-9 px-3 rounded-md border hairline text-[12px] font-medium hover:bg-paper-alt transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="h-9 px-4 rounded-md text-[12px] font-medium hover:opacity-90 transition"
            style="background: var(--ink); color: var(--paper);"
          >
            {{ editando ? 'Guardar cambios' : 'Crear tienda' }}
          </button>
        </div>
      </form>
    </Dialog>
  </div>
</template>
