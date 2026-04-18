<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useTiendaStore } from '../stores/tienda'
import { useTemplatesStore } from '../stores/templates'
import {
  CATEGORIAS,
  CATEGORIA_LABELS,
  extraerVariables,
  renderTemplate,
  type CategoriaTemplate,
  type WhatsAppTemplate,
} from '../services/templatesService'

const toast = useToast()
const tiendaStore = useTiendaStore()
const store = useTemplatesStore()

// ──── Variables disponibles (documentación) ────
const VARIABLES_DISPONIBLES: Array<{ key: string; descripcion: string; ejemplo: string }> = [
  { key: 'nombre',        descripcion: 'Nombre del cliente',          ejemplo: 'María López' },
  { key: 'producto',      descripcion: 'Nombre del producto',         ejemplo: 'Depiladora IPL' },
  { key: 'guia',          descripcion: 'Guía Servientrega',           ejemplo: 'SRV-12345' },
  { key: 'tienda',        descripcion: 'Nombre de la tienda',         ejemplo: 'Skinna' },
  { key: 'agencia',       descripcion: 'Agencia destino',             ejemplo: 'Guayaquil Norte' },
  { key: 'direccion',     descripcion: 'Dirección de entrega',        ejemplo: 'Av. Principal 123' },
  { key: 'monto',         descripcion: 'Monto del pedido',            ejemplo: '$29.99' },
  { key: 'link_tracking', descripcion: 'Link público de tracking',    ejemplo: '/t/abc123' },
  { key: 'link_referido', descripcion: 'Link personalizado referido', ejemplo: '/p/skinna?ref=ANA' },
]

// Ejemplo para el preview en vivo
const EJEMPLO: Record<string, string> = VARIABLES_DISPONIBLES.reduce(
  (acc, v) => ({ ...acc, [v.key]: v.ejemplo }),
  {} as Record<string, string>,
)

// ──── Selección y edición ────
const seleccionadaId = ref<string | null>(null)
const modoEdicion = ref(false)
const form = ref({
  slug: '',
  nombre: '',
  mensaje: '',
  categoria: 'general' as CategoriaTemplate,
  activo: true,
})
const creandoNueva = ref(false)

const seleccionada = computed<WhatsAppTemplate | null>(() =>
  store.templates.find((t) => t.id === seleccionadaId.value) ?? null,
)

const variablesUsadas = computed(() => extraerVariables(form.value.mensaje))

const preview = computed(() => renderTemplate(form.value.mensaje, EJEMPLO))

const categoriaActual = ref<CategoriaTemplate | 'todas'>('todas')

const templatesFiltradas = computed(() => {
  if (categoriaActual.value === 'todas') return store.templates
  return store.templates.filter((t) => t.categoria === categoriaActual.value)
})

function seleccionar(t: WhatsAppTemplate) {
  seleccionadaId.value = t.id
  creandoNueva.value = false
  modoEdicion.value = false
  form.value = {
    slug: t.slug,
    nombre: t.nombre,
    mensaje: t.mensaje,
    categoria: t.categoria,
    activo: t.activo,
  }
}

function iniciarNueva() {
  seleccionadaId.value = null
  creandoNueva.value = true
  modoEdicion.value = true
  form.value = {
    slug: '',
    nombre: '',
    mensaje: '',
    categoria: 'general',
    activo: true,
  }
}

function iniciarEdicion() {
  modoEdicion.value = true
}

function cancelar() {
  if (creandoNueva.value) {
    creandoNueva.value = false
    seleccionadaId.value = null
    form.value = { slug: '', nombre: '', mensaje: '', categoria: 'general', activo: true }
  } else if (seleccionada.value) {
    seleccionar(seleccionada.value)
  }
  modoEdicion.value = false
}

async function guardar() {
  if (!form.value.nombre.trim()) return toast.warning('El nombre es requerido')
  if (!form.value.mensaje.trim()) return toast.warning('El mensaje es requerido')

  try {
    if (creandoNueva.value) {
      if (!form.value.slug.trim()) return toast.warning('El slug es requerido')
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.value.slug)) {
        return toast.warning('El slug debe ser lowercase con guiones (ej. confirmacion-envio)')
      }
      const nueva = await store.crearTemplate({
        slug: form.value.slug,
        nombre: form.value.nombre,
        mensaje: form.value.mensaje,
        categoria: form.value.categoria,
        activo: form.value.activo,
      })
      toast.success(`Plantilla "${nueva.nombre}" creada`)
      seleccionadaId.value = nueva.id
      creandoNueva.value = false
      modoEdicion.value = false
    } else if (seleccionadaId.value) {
      await store.actualizarTemplate(seleccionadaId.value, {
        nombre: form.value.nombre,
        mensaje: form.value.mensaje,
        categoria: form.value.categoria,
        activo: form.value.activo,
      })
      toast.success('Plantilla actualizada')
      modoEdicion.value = false
    }
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || 'Error al guardar')
  }
}

async function eliminar(t: WhatsAppTemplate) {
  if (!confirm(`¿Eliminar la plantilla "${t.nombre}"? Esta acción no se puede deshacer.`)) return
  try {
    await store.eliminarTemplate(t.id)
    if (seleccionadaId.value === t.id) {
      seleccionadaId.value = null
      modoEdicion.value = false
    }
    toast.success('Plantilla eliminada')
  } catch {
    toast.error('Error al eliminar')
  }
}

function insertarVariable(key: string) {
  form.value.mensaje = form.value.mensaje + `{${key}}`
}

onMounted(() => {
  store.fetchTemplates()
})

watch(() => tiendaStore.tiendaActivaId, () => {
  seleccionadaId.value = null
  modoEdicion.value = false
  creandoNueva.value = false
  store.fetchTemplates()
})

// Categoría → clase del pill
const CATEGORIA_PILL: Record<CategoriaTemplate, string> = {
  envio:    'pill-blue',
  tracking: 'pill-blue',
  novedad:  'pill-amber',
  alerta:   'pill-rose',
  upsell:   'pill-emerald',
  referido: 'pill-emerald',
  general:  'pill-blue',
  libre:    '',
}
</script>

<template>
  <div class="px-8 py-8">
    <!-- Header -->
    <div class="flex items-end justify-between mb-6 flex-wrap gap-4">
      <div>
        <div class="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint mb-2">
          {{ store.templates.length }} plantillas · variables con {clave}
        </div>
        <h1 class="h-display text-[40px] leading-none">Plantillas WhatsApp</h1>
      </div>
      <button
        @click="iniciarNueva"
        class="h-9 px-3 rounded-md text-[12px] font-medium hover:opacity-90 transition flex items-center gap-2"
        style="background: var(--ink); color: var(--paper);"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M8 3v10M3 8h10" stroke-linecap="round"/>
        </svg>
        Nueva plantilla
      </button>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5">
      <!-- Lista -->
      <div class="surface rounded-xl overflow-hidden flex flex-col">
        <!-- Filtro por categoría -->
        <div class="p-3 border-b hairline flex gap-1 overflow-x-auto thin-scroll">
          <button
            @click="categoriaActual = 'todas'"
            class="px-2.5 h-7 text-[11px] font-medium rounded-md whitespace-nowrap transition"
            :class="categoriaActual === 'todas' ? '' : 'hover:bg-paper-alt text-ink-muted'"
            :style="categoriaActual === 'todas' ? { background: 'var(--ink)', color: 'var(--paper)' } : {}"
          >
            Todas
          </button>
          <button
            v-for="c in CATEGORIAS"
            :key="c"
            @click="categoriaActual = c"
            class="px-2.5 h-7 text-[11px] font-medium rounded-md whitespace-nowrap transition"
            :class="categoriaActual === c ? '' : 'hover:bg-paper-alt text-ink-muted'"
            :style="categoriaActual === c ? { background: 'var(--ink)', color: 'var(--paper)' } : {}"
          >
            {{ CATEGORIA_LABELS[c] }}
          </button>
        </div>

        <div v-if="store.loading" class="py-10 text-center">
          <div class="inline-block w-4 h-4 border-2 rounded-full animate-spin" style="border-color: var(--line); border-top-color: var(--accent);"></div>
        </div>
        <div v-else-if="templatesFiltradas.length === 0" class="py-10 text-center text-[12px] text-ink-faint">
          Sin plantillas{{ categoriaActual !== 'todas' ? ` en ${CATEGORIA_LABELS[categoriaActual]}` : '' }}
        </div>
        <div v-else class="divide-y hairline max-h-[70vh] overflow-y-auto thin-scroll">
          <button
            v-for="t in templatesFiltradas"
            :key="t.id"
            @click="seleccionar(t)"
            class="w-full text-left p-3 transition"
            :class="seleccionadaId === t.id ? 'bg-paper-alt' : 'hover:bg-paper-alt'"
          >
            <div class="flex items-start justify-between gap-2">
              <div class="min-w-0 flex-1">
                <div class="text-[13px] font-medium truncate">{{ t.nombre }}</div>
                <div class="text-[11px] font-mono tabular text-ink-faint truncate">/{{ t.slug }}</div>
              </div>
              <div class="flex flex-col items-end gap-1 shrink-0">
                <span
                  class="px-1.5 py-0.5 rounded text-[10px] font-medium"
                  :class="CATEGORIA_PILL[t.categoria]"
                >
                  {{ CATEGORIA_LABELS[t.categoria] }}
                </span>
                <span v-if="!t.activo" class="text-[9px] uppercase tracking-wider text-ink-faint">
                  Inactiva
                </span>
              </div>
            </div>
          </button>
        </div>
      </div>

      <!-- Editor / detalle -->
      <div v-if="!seleccionada && !creandoNueva" class="surface rounded-xl p-12 empty-pattern text-center">
        <p class="text-[13px] text-ink-muted">
          Selecciona una plantilla de la lista o crea una nueva.
        </p>
      </div>

      <div v-else class="space-y-5">
        <!-- Barra de acciones -->
        <div class="flex items-center justify-between flex-wrap gap-2">
          <div class="flex items-center gap-2">
            <h2 v-if="!creandoNueva" class="h-display text-[22px] leading-tight">{{ seleccionada?.nombre }}</h2>
            <h2 v-else class="h-display text-[22px] leading-tight">Nueva plantilla</h2>
            <span
              v-if="seleccionada && !seleccionada.activo"
              class="px-2 py-0.5 rounded text-[10px] font-medium pill-rose"
            >
              Inactiva
            </span>
          </div>
          <div class="flex gap-2">
            <template v-if="modoEdicion">
              <button
                @click="cancelar"
                class="h-9 px-3 rounded-md border hairline text-[12px] font-medium hover:bg-paper-alt transition"
              >
                Cancelar
              </button>
              <button
                @click="guardar"
                class="h-9 px-3 rounded-md text-[12px] font-medium hover:opacity-90 transition"
                style="background: var(--ink); color: var(--paper);"
              >
                {{ creandoNueva ? 'Crear' : 'Guardar cambios' }}
              </button>
            </template>
            <template v-else-if="seleccionada">
              <button
                @click="iniciarEdicion"
                class="h-9 px-3 rounded-md border hairline text-[12px] font-medium hover:bg-paper-alt transition"
              >
                Editar
              </button>
              <button
                @click="eliminar(seleccionada)"
                class="h-9 px-3 rounded-md border hairline text-[12px] font-medium hover:bg-paper-alt transition"
                :style="{ color: 'var(--rose-dot)' }"
              >
                Eliminar
              </button>
            </template>
          </div>
        </div>

        <!-- Form -->
        <div class="surface rounded-xl p-5 space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1.5">
                Nombre
              </label>
              <input
                v-model="form.nombre"
                type="text"
                :disabled="!modoEdicion"
                class="w-full px-3 py-2 border hairline rounded-md bg-paper-alt text-[13px] text-ink focus:outline-none focus:border-accent transition disabled:opacity-60"
              />
            </div>

            <div>
              <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1.5">
                Categoría
              </label>
              <select
                v-model="form.categoria"
                :disabled="!modoEdicion"
                class="w-full px-3 py-2 border hairline rounded-md bg-paper-alt text-[13px] text-ink focus:outline-none focus:border-accent transition disabled:opacity-60"
              >
                <option v-for="c in CATEGORIAS" :key="c" :value="c">
                  {{ CATEGORIA_LABELS[c] }}
                </option>
              </select>
            </div>
          </div>

          <div v-if="creandoNueva">
            <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1.5">
              Slug (único por tienda · lowercase con guiones)
            </label>
            <input
              v-model="form.slug"
              type="text"
              placeholder="confirmacion-envio"
              class="w-full px-3 py-2 border hairline rounded-md bg-paper-alt text-[13px] font-mono tabular text-ink focus:outline-none focus:border-accent transition"
            />
          </div>

          <div>
            <div class="flex items-center justify-between mb-1.5">
              <label class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold">
                Mensaje
              </label>
              <span class="text-[10px] text-ink-faint font-mono">
                {{ form.mensaje.length }} chars · {{ variablesUsadas.length }} vars
              </span>
            </div>
            <textarea
              v-model="form.mensaje"
              :disabled="!modoEdicion"
              rows="10"
              class="w-full px-3 py-2.5 border hairline rounded-md text-[13px] text-ink leading-relaxed focus:outline-none focus:border-accent transition resize-none disabled:opacity-60"
              style="background: var(--paper-elev);"
            ></textarea>
          </div>

          <div v-if="modoEdicion" class="flex items-center gap-2">
            <span class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold">
              Insertar variable:
            </span>
            <div class="flex flex-wrap gap-1">
              <button
                v-for="v in VARIABLES_DISPONIBLES"
                :key="v.key"
                @click="insertarVariable(v.key)"
                :title="v.descripcion"
                class="px-2 h-6 rounded text-[10px] font-mono tabular hover:opacity-90 transition"
                style="background: var(--paper-alt); border: 1px solid var(--line);"
              >
                {{ '{' + v.key + '}' }}
              </button>
            </div>
          </div>

          <label v-if="modoEdicion" class="flex items-center gap-2 text-[12px]">
            <input v-model="form.activo" type="checkbox" class="rounded" />
            <span>Activa (aparece en el modal al enviar WhatsApp)</span>
          </label>
        </div>

        <!-- Preview -->
        <div class="surface rounded-xl p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold">
              Vista previa (con datos de ejemplo)
            </h3>
            <span class="text-[10px] font-mono tabular text-ink-faint">
              {{ preview.length }} chars
            </span>
          </div>
          <div
            class="rounded-md p-4 text-[13px] leading-relaxed whitespace-pre-wrap"
            style="background: var(--paper-alt); border: 1px solid var(--line);"
          >{{ preview || 'Escribe un mensaje para ver la vista previa…' }}</div>

          <!-- Documentación de variables -->
          <details class="mt-4">
            <summary class="text-[11px] text-ink-faint cursor-pointer hover:text-ink-muted select-none">
              Variables disponibles ({{ VARIABLES_DISPONIBLES.length }})
            </summary>
            <dl class="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 text-[12px]">
              <div v-for="v in VARIABLES_DISPONIBLES" :key="v.key" class="flex items-baseline gap-2">
                <dt class="font-mono tabular shrink-0" style="color: var(--accent);">
                  {{ '{' + v.key + '}' }}
                </dt>
                <dd class="text-ink-muted">{{ v.descripcion }}</dd>
              </div>
            </dl>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>
