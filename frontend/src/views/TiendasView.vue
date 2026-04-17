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
  color_primario: '#030363',
  color_secundario: '#C49BC2',
  color_fondo: '#E6E6FB',
  color_borde: '#C8C8E9',
})

function abrirCrear() {
  editando.value = false
  editId.value = null
  form.value = { nombre: '', color_primario: '#030363', color_secundario: '#C49BC2', color_fondo: '#E6E6FB', color_borde: '#C8C8E9' }
  modalVisible.value = true
}

function abrirEditar(tienda: Tienda) {
  editando.value = true
  editId.value = tienda.id
  form.value = {
    nombre: tienda.nombre,
    color_primario: tienda.color_primario || '#030363',
    color_secundario: tienda.color_secundario || '#C49BC2',
    color_fondo: tienda.color_fondo || '#E6E6FB',
    color_borde: tienda.color_borde || '#C8C8E9',
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
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-lavanda-medio">
      <h3 class="text-xl font-bold text-navy">Administrar Tiendas</h3>
      <button
        @click="abrirCrear"
        class="bg-mauve text-white px-4 py-2 rounded-lg font-bold hover:opacity-90 transition flex items-center gap-2 shadow-sm"
      >
        <i class="pi pi-plus"></i> Nueva Tienda
      </button>
    </div>

    <!-- Grid de tiendas -->
    <div class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
      <div
        v-for="tienda in tiendaStore.tiendas"
        :key="tienda.id"
        class="bg-white p-5 rounded-xl border border-lavanda-medio shadow-sm hover:shadow-md transition"
        :class="{ 'opacity-50': !tienda.estado }"
      >
        <!-- Barra de colores -->
        <div class="flex gap-1 mb-4 h-2 rounded-full overflow-hidden">
          <div class="flex-1 rounded-full" :style="{ backgroundColor: tienda.color_primario }"></div>
          <div class="flex-1 rounded-full" :style="{ backgroundColor: tienda.color_secundario }"></div>
          <div class="flex-1 rounded-full" :style="{ backgroundColor: tienda.color_fondo }"></div>
          <div class="flex-1 rounded-full" :style="{ backgroundColor: tienda.color_borde }"></div>
        </div>

        <div class="flex items-start justify-between">
          <div>
            <h4 class="text-lg font-bold text-navy">{{ tienda.nombre }}</h4>
            <p class="text-xs text-navy/50 mt-1">Creada: {{ formatFecha(tienda.created_at) }}</p>
          </div>
          <span
            class="px-2 py-0.5 rounded-full text-[10px] font-bold"
            :class="tienda.estado ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'"
          >
            {{ tienda.estado ? 'Activa' : 'Inactiva' }}
          </span>
        </div>

        <!-- Indicador tienda activa -->
        <div v-if="tienda.id === tiendaStore.tiendaActivaId" class="mt-3 flex items-center gap-1 text-xs text-mauve font-bold">
          <i class="pi pi-check-circle"></i> Tienda seleccionada
        </div>

        <!-- Acciones -->
        <div class="flex gap-2 mt-4 pt-3 border-t border-lavanda">
          <button
            @click="tiendaStore.setTiendaActiva(tienda.id)"
            class="px-3 py-1.5 text-xs font-bold rounded-lg transition"
            :class="tienda.id === tiendaStore.tiendaActivaId
              ? 'bg-navy text-white'
              : 'border border-lavanda-medio text-navy hover:bg-lavanda'"
          >
            {{ tienda.id === tiendaStore.tiendaActivaId ? 'Seleccionada' : 'Seleccionar' }}
          </button>
          <button
            @click="abrirEditar(tienda)"
            class="px-3 py-1.5 text-xs font-bold border border-lavanda-medio rounded-lg text-navy hover:bg-lavanda transition"
          >
            <i class="pi pi-pencil"></i> Editar
          </button>
          <button
            @click="toggleEstado(tienda)"
            class="px-3 py-1.5 text-xs font-bold rounded-lg transition"
            :class="tienda.estado
              ? 'text-alerta border border-alerta/30 hover:bg-red-50'
              : 'text-green-600 border border-green-200 hover:bg-green-50'"
          >
            {{ tienda.estado ? 'Desactivar' : 'Activar' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Vacío -->
    <div v-if="tiendaStore.tiendas.length === 0" class="text-center py-12">
      <i class="pi pi-shop text-5xl text-lavanda-medio"></i>
      <p class="text-navy/60 mt-3">No hay tiendas creadas</p>
    </div>

    <!-- Modal crear/editar -->
    <Dialog
      v-model:visible="modalVisible"
      :header="editando ? 'Editar Tienda' : 'Nueva Tienda'"
      modal
      :style="{ width: '420px' }"
      :pt="{
        root: { class: 'border border-lavanda-medio rounded-xl' },
        header: { class: 'bg-navy text-white rounded-t-xl p-4' },
        title: { class: 'font-bold text-lg' },
        content: { class: 'p-6' },
        headerActions: { class: 'text-white' },
      }"
    >
      <form @submit.prevent="guardar" class="space-y-4">
        <div>
          <label class="block text-sm font-bold text-navy mb-1">Nombre de la tienda *</label>
          <input
            v-model="form.nombre"
            type="text"
            placeholder="Mi Tienda"
            class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition"
          />
        </div>

        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-xs font-bold text-navy mb-1">Sidebar / Textos</label>
            <div class="flex items-center gap-2">
              <input v-model="form.color_primario" type="color" class="w-8 h-8 rounded cursor-pointer border-0" />
              <span class="text-[10px] text-navy/50">{{ form.color_primario }}</span>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-navy mb-1">Botones / Acento</label>
            <div class="flex items-center gap-2">
              <input v-model="form.color_secundario" type="color" class="w-8 h-8 rounded cursor-pointer border-0" />
              <span class="text-[10px] text-navy/50">{{ form.color_secundario }}</span>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-navy mb-1">Fondo</label>
            <div class="flex items-center gap-2">
              <input v-model="form.color_fondo" type="color" class="w-8 h-8 rounded cursor-pointer border-0" />
              <span class="text-[10px] text-navy/50">{{ form.color_fondo }}</span>
            </div>
          </div>
          <div>
            <label class="block text-xs font-bold text-navy mb-1">Bordes</label>
            <div class="flex items-center gap-2">
              <input v-model="form.color_borde" type="color" class="w-8 h-8 rounded cursor-pointer border-0" />
              <span class="text-[10px] text-navy/50">{{ form.color_borde }}</span>
            </div>
          </div>
        </div>

        <div class="flex justify-end gap-3 pt-2">
          <button
            type="button"
            @click="modalVisible = false"
            class="px-4 py-2 rounded-lg font-bold border border-lavanda-medio text-navy hover:bg-lavanda transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="px-6 py-2 rounded-lg font-bold bg-mauve text-white hover:opacity-90 transition shadow-sm"
          >
            {{ editando ? 'Guardar' : 'Crear Tienda' }}
          </button>
        </div>
      </form>
    </Dialog>
  </div>
</template>
