<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Dialog from 'primevue/dialog'
import {
  generarMensaje,
  abrirWhatsApp,
  sugerirPlantilla,
  PLANTILLA_LABELS,
  type PlantillaWA,
  type DatosPlantilla,
} from '../../composables/useWhatsApp'

const props = defineProps<{
  visible: boolean
  nombre: string
  telefono: string
  producto: string
  guia: string
  estado: string
  direccion?: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

const plantillaSeleccionada = ref<PlantillaWA>('NUEVO')
const mensajeTexto = ref('')

const plantillasOpciones = Object.entries(PLANTILLA_LABELS) as [PlantillaWA, string][]

// Datos para la plantilla
const datos = computed<DatosPlantilla>(() => ({
  nombre: props.nombre,
  producto: props.producto,
  guia: props.guia,
  agencia: props.direccion || 'tu ciudad',
}))

// Cuando se abre el modal, auto-seleccionar plantilla según estado
watch(() => props.visible, (val) => {
  if (val) {
    plantillaSeleccionada.value = sugerirPlantilla(props.estado)
    regenerarMensaje()
  }
})

// Cuando cambia la plantilla, regenerar mensaje
watch(plantillaSeleccionada, () => {
  regenerarMensaje()
})

function regenerarMensaje() {
  mensajeTexto.value = generarMensaje(plantillaSeleccionada.value, datos.value)
}

function enviar() {
  abrirWhatsApp(props.telefono, mensajeTexto.value)
  dialogVisible.value = false
}

/** Estilo del badge de estado en el resumen */
const estadoEstilos: Record<string, string> = {
  INGRESANDO: 'bg-gray-100 text-gray-700',
  EN_TRANSITO: 'bg-blue-100 text-blue-700',
  EN_AGENCIA: 'bg-purple-100 text-purple-700',
  EN_REPARTO: 'bg-yellow-100 text-yellow-700',
  ENTREGADO: 'bg-green-100 text-green-700',
  NOVEDAD: 'bg-orange-100 text-orange-700',
  DEVUELTO: 'bg-red-100 text-red-700',
}
</script>

<template>
  <Dialog
    v-model:visible="dialogVisible"
    header="Enviar WhatsApp"
    modal
    :style="{ width: '520px' }"
    :pt="{
      root: { class: 'border border-lavanda-medio rounded-xl' },
      header: { class: 'bg-wa-green text-white rounded-t-xl p-4' },
      title: { class: 'font-bold text-lg' },
      content: { class: 'p-6' },
      headerActions: { class: 'text-white' },
    }"
  >
    <!-- Info del pedido -->
    <div class="bg-lavanda/50 rounded-lg p-3 mb-4 flex items-center justify-between">
      <div>
        <p class="font-bold text-navy text-sm">{{ nombre }}</p>
        <p class="text-xs text-navy/60">{{ telefono }} · {{ producto }}</p>
      </div>
      <span
        class="px-2 py-1 rounded-full text-xs font-bold"
        :class="estadoEstilos[estado] || 'bg-gray-100 text-gray-700'"
      >
        {{ estado.replace(/_/g, ' ') }}
      </span>
    </div>

    <!-- Selector de plantilla -->
    <div class="mb-4">
      <label class="block text-sm font-bold text-navy mb-1">Plantilla de mensaje</label>
      <select
        v-model="plantillaSeleccionada"
        class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-wa-green transition"
      >
        <option v-for="[key, label] in plantillasOpciones" :key="key" :value="key">
          {{ label }}
        </option>
      </select>
    </div>

    <!-- Textarea editable -->
    <div class="mb-4">
      <label class="block text-sm font-bold text-navy mb-1">Mensaje</label>
      <textarea
        v-model="mensajeTexto"
        rows="8"
        class="w-full px-4 py-3 border border-lavanda-medio rounded-lg bg-white text-navy text-sm leading-relaxed focus:outline-none focus:border-wa-green transition resize-none"
      ></textarea>
      <p class="text-xs text-navy/40 mt-1">Puedes editar el mensaje antes de enviar</p>
    </div>

    <!-- Botones -->
    <div class="flex justify-end gap-3">
      <button
        @click="dialogVisible = false"
        class="px-4 py-2 rounded-lg font-bold border border-lavanda-medio text-navy hover:bg-lavanda transition"
      >
        Cancelar
      </button>
      <button
        @click="enviar"
        class="px-6 py-2 rounded-lg font-bold bg-wa-green text-white hover:opacity-90 transition shadow-sm flex items-center gap-2"
      >
        <i class="pi pi-whatsapp"></i> Abrir WhatsApp
      </button>
    </div>
  </Dialog>
</template>
