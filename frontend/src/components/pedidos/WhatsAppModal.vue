<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import Dialog from 'primevue/dialog'
import { abrirWhatsApp } from '../../composables/useWhatsApp'
import { useTiendaStore } from '../../stores/tienda'
import { useTemplatesStore } from '../../stores/templates'
import { renderTemplate } from '../../services/templatesService'

const tiendaStore = useTiendaStore()
const templatesStore = useTemplatesStore()

const props = defineProps<{
  visible: boolean
  nombre: string
  telefono: string
  producto: string
  guia: string
  estado: string
  direccion?: string
  /** Monto del pedido, si está disponible para variables {monto}. */
  monto?: number
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
}>()

const dialogVisible = computed({
  get: () => props.visible,
  set: (val) => emit('update:visible', val),
})

const templateIdSeleccionado = ref<string | null>(null)
const mensajeTexto = ref('')

/**
 * Mapea estado → slug de plantilla sugerida. Si no hay match exacto,
 * cae a la primera plantilla activa.
 */
function slugSugeridoPorEstado(estado: string): string | null {
  switch (estado) {
    case 'PENDIENTE':
    case 'CONFIRMADO':
    case 'EN_PREPARACION':
    case 'ENVIADO':
      return 'envio-nuevo'
    case 'EN_RUTA':
      return 'reparto-hoy'
    case 'RETIRO_EN_AGENCIA':
      return 'llego-agencia'
    case 'NOVEDAD':
    case 'NO_ENTREGADO':
      return 'novedad-direccion'
    default:
      return 'libre'
  }
}

// Datos para reemplazo de variables
const variables = computed(() => ({
  nombre: props.nombre,
  producto: props.producto,
  guia: props.guia,
  tienda: tiendaStore.tiendaActiva?.nombre || 'nuestra tienda',
  agencia: props.direccion || 'tu ciudad',
  direccion: props.direccion || '',
  monto: props.monto !== undefined ? `$${props.monto.toFixed(2)}` : '',
}))

// Seleccionar plantilla sugerida cuando el modal se abre
watch(() => props.visible, async (val) => {
  if (!val) return
  if (templatesStore.templates.length === 0) {
    await templatesStore.fetchTemplates()
  }
  const slug = slugSugeridoPorEstado(props.estado)
  const sugerida = slug ? templatesStore.porSlug(slug) : null
  const fallback = templatesStore.activos[0] ?? null
  const elegida = sugerida ?? fallback
  templateIdSeleccionado.value = elegida?.id ?? null
  regenerarMensaje()
})

watch(templateIdSeleccionado, () => regenerarMensaje())

function regenerarMensaje() {
  const tpl = templatesStore.templates.find((t) => t.id === templateIdSeleccionado.value)
  if (!tpl) { mensajeTexto.value = ''; return }
  mensajeTexto.value = renderTemplate(tpl.mensaje, variables.value)
}

function enviar() {
  abrirWhatsApp(props.telefono, mensajeTexto.value)
  dialogVisible.value = false
}

onMounted(() => {
  if (templatesStore.templates.length === 0) templatesStore.fetchTemplates()
})

/** Estilo del badge de estado en el resumen */
const estadoEstilos: Record<string, string> = {
  PENDIENTE: 'pill-amber',
  CONFIRMADO: 'pill-blue',
  EN_PREPARACION: 'pill-blue',
  ENVIADO: 'pill-blue',
  EN_RUTA: 'pill-blue',
  NOVEDAD: 'pill-amber',
  RETIRO_EN_AGENCIA: 'pill-blue',
  ENTREGADO: 'pill-emerald',
  NO_ENTREGADO: 'pill-rose',
  DEVUELTO: 'pill-rose',
}
</script>

<template>
  <Dialog
    v-model:visible="dialogVisible"
    header="Enviar WhatsApp"
    modal
    :style="{ width: '520px' }"
    :pt="{
      root: { class: 'rounded-xl overflow-hidden' },
      content: { class: 'p-6' },
    }"
  >
    <!-- Info del pedido -->
    <div class="surface rounded-md p-3 mb-4 flex items-center justify-between">
      <div class="min-w-0">
        <p class="font-medium text-[13px] truncate">{{ nombre }}</p>
        <p class="text-[11px] tabular font-mono text-ink-faint">{{ telefono }} · {{ producto }}</p>
      </div>
      <span
        class="px-2 py-0.5 rounded text-[11px] font-medium shrink-0"
        :class="estadoEstilos[estado] || 'pill-blue'"
      >
        {{ estado.replace(/_/g, ' ').toLowerCase() }}
      </span>
    </div>

    <!-- Selector de plantilla -->
    <div class="mb-4">
      <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1.5">
        Plantilla de mensaje
      </label>
      <select
        v-model="templateIdSeleccionado"
        class="w-full px-3 py-2 border hairline rounded-md bg-paper-alt text-[13px] text-ink focus:outline-none focus:border-accent transition"
      >
        <option v-if="templatesStore.activos.length === 0" :value="null" disabled>
          No hay plantillas activas — creá una en /plantillas
        </option>
        <option
          v-for="tpl in templatesStore.activos"
          :key="tpl.id"
          :value="tpl.id"
        >
          {{ tpl.nombre }}
        </option>
      </select>
    </div>

    <!-- Textarea editable -->
    <div class="mb-4">
      <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1.5">
        Mensaje
      </label>
      <textarea
        v-model="mensajeTexto"
        rows="8"
        class="w-full px-3 py-2.5 border hairline rounded-md text-[13px] text-ink leading-relaxed focus:outline-none focus:border-accent transition resize-none"
        style="background: var(--paper-elev);"
      ></textarea>
      <p class="text-[11px] text-ink-faint mt-1">Puedes editar el mensaje antes de enviar</p>
    </div>

    <!-- Botones -->
    <div class="flex justify-end gap-2">
      <button
        @click="dialogVisible = false"
        class="h-9 px-3 rounded-md border hairline text-[12px] font-medium hover:bg-paper-alt transition"
      >
        Cancelar
      </button>
      <button
        @click="enviar"
        class="h-9 px-4 rounded-md text-[12px] font-medium text-white hover:opacity-90 transition flex items-center gap-2"
        style="background: var(--emerald-dot);"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1a7 7 0 00-6.06 10.5L1 15l3.6-.94A7 7 0 108 1z"/>
        </svg>
        Abrir WhatsApp
      </button>
    </div>
  </Dialog>
</template>
