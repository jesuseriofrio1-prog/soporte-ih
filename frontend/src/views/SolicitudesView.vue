<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import solicitudesService, {
  type Solicitud,
  type EstadoSolicitud,
} from '../services/solicitudesService'
import { useTiendaStore } from '../stores/tienda'

const toast = useToast()
const tiendaStore = useTiendaStore()

const solicitudes = ref<Solicitud[]>([])
const loading = ref(false)
const filtroEstado = ref<EstadoSolicitud | ''>('')
const seleccionada = ref<Solicitud | null>(null)
const rocketIdInput = ref('')

const ESTADO_LABELS: Record<EstadoSolicitud, { label: string; pill: string; dot: string }> = {
  PENDIENTE:         { label: 'Pendiente', pill: 'pill-amber',   dot: 'dot-amber'   },
  ENVIADA_A_ROCKET:  { label: 'En Rocket', pill: 'pill-blue',    dot: 'dot-blue'    },
  ENLAZADA:          { label: 'Enlazada',  pill: 'pill-emerald', dot: 'dot-emerald' },
  CANCELADA:         { label: 'Cancelada', pill: '',             dot: 'dot-stone'   },
}

async function cargar() {
  if (!tiendaStore.tiendaActiva) return
  loading.value = true
  try {
    solicitudes.value = await solicitudesService.list(
      tiendaStore.tiendaActiva.id,
      filtroEstado.value || undefined,
    )
  } catch {
    toast.error('No se pudieron cargar las solicitudes')
  } finally {
    loading.value = false
  }
}

onMounted(cargar)
watch(() => tiendaStore.tiendaActivaId, cargar)
watch(filtroEstado, cargar)

function fmtFecha(iso: string) {
  return new Date(iso).toLocaleString('es-EC', { dateStyle: 'short', timeStyle: 'short' })
}

function abrirDetalle(s: Solicitud) {
  seleccionada.value = s
  rocketIdInput.value = s.rocket_order_id ?? ''
}

function cerrarDetalle() {
  seleccionada.value = null
  rocketIdInput.value = ''
}

// Copiar al clipboard
async function copiar(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success(`${label} copiado`)
  } catch {
    toast.error('No se pudo copiar')
  }
}

function textoParaRocket(s: Solicitud): string {
  const lineas = [
    `Nombre: ${s.cliente_nombre}`,
    `Teléfono: ${s.cliente_telefono}`,
    s.cliente_email ? `Email: ${s.cliente_email}` : null,
    `Dirección: ${s.direccion}`,
    s.ciudad ? `Ciudad: ${s.ciudad}` : null,
    s.provincia ? `Provincia: ${s.provincia}` : null,
    `Producto: ${s.productos?.nombre ?? 'No asignado'}`,
    `Cantidad: ${s.cantidad}`,
    s.notas ? `Notas: ${s.notas}` : null,
  ].filter(Boolean)
  return lineas.join('\n')
}

async function copiarTodoRocket(s: Solicitud) {
  await copiar(textoParaRocket(s), 'Datos para Rocket')
}

async function vincularRocket() {
  if (!seleccionada.value) return
  if (!rocketIdInput.value.trim()) {
    toast.warning('Pega el ID PEDIDO que te dio Rocket')
    return
  }
  try {
    const actualizada = await solicitudesService.vincularRocket(
      seleccionada.value.id,
      rocketIdInput.value.trim(),
    )
    toast.success(
      actualizada.estado === 'ENLAZADA'
        ? 'Solicitud enlazada con pedido de Rocket'
        : 'Rocket ID guardado. Se enlazará cuando llegue el webhook.',
    )
    await cargar()
    const refrescada = solicitudes.value.find((s) => s.id === seleccionada.value!.id)
    seleccionada.value = refrescada ?? null
  } catch {
    toast.error('No se pudo guardar el ID de Rocket')
  }
}

async function cancelar(s: Solicitud) {
  if (!confirm('¿Cancelar esta solicitud? Puedes cambiarla de estado luego.')) return
  try {
    await solicitudesService.cambiarEstado(s.id, 'CANCELADA')
    toast.success('Solicitud cancelada')
    cerrarDetalle()
    cargar()
  } catch {
    toast.error('No se pudo cancelar')
  }
}

async function eliminar(s: Solicitud) {
  if (!confirm('¿Eliminar esta solicitud? Esto no se puede deshacer.')) return
  try {
    await solicitudesService.eliminar(s.id)
    toast.success('Solicitud eliminada')
    cerrarDetalle()
    cargar()
  } catch {
    toast.error('No se pudo eliminar')
  }
}

const pendientesCount = computed(() => solicitudes.value.filter((s) => s.estado === 'PENDIENTE').length)
const enviadasCount   = computed(() => solicitudes.value.filter((s) => s.estado === 'ENVIADA_A_ROCKET').length)

// Link público a compartir
const publicBase = computed(() => window.location.origin)
const shareLinkGeneral = computed(() => {
  const slug = tiendaStore.tiendaActiva?.slug
  return slug ? `${publicBase.value}/p/${slug}` : ''
})
</script>

<template>
  <div class="px-8 py-8">
    <!-- Header página -->
    <div class="flex items-end justify-between mb-6 flex-wrap gap-4">
      <div>
        <div class="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint mb-2">
          {{ solicitudes.length }} solicitudes recibidas
        </div>
        <h1 class="h-display text-[40px] leading-none">Solicitudes</h1>
      </div>
      <div class="flex gap-2">
        <div class="surface px-4 py-2 rounded-md text-center min-w-[100px]">
          <p class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold">Pendientes</p>
          <p class="h-display tabular text-[20px] leading-none mt-1" style="color: var(--amber-fg);">
            {{ pendientesCount }}
          </p>
        </div>
        <div class="surface px-4 py-2 rounded-md text-center min-w-[100px]">
          <p class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold">En Rocket</p>
          <p class="h-display tabular text-[20px] leading-none mt-1" style="color: var(--blue-fg);">
            {{ enviadasCount }}
          </p>
        </div>
      </div>
    </div>

    <!-- Explicación + share link -->
    <div class="surface rounded-xl p-5 mb-5 space-y-3">
      <p class="text-[12px] text-ink-muted">
        Formularios que llenaron tus clientes desde el link público. Copia los datos
        a Rocket y pega el <b>ID PEDIDO</b> aquí para cerrarlas.
      </p>
      <div v-if="shareLinkGeneral" class="flex items-center gap-2 surface px-3 py-2 rounded-md">
        <span class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold shrink-0">Link catálogo</span>
        <code class="text-[11px] font-mono tabular text-ink flex-1 truncate">{{ shareLinkGeneral }}</code>
        <button
          @click="copiar(shareLinkGeneral, 'Link')"
          class="text-[11px] font-medium hover:underline shrink-0"
          style="color: var(--accent);"
        >Copiar</button>
      </div>
    </div>

    <!-- Filtros estado (chips) -->
    <div class="flex gap-2 flex-wrap mb-5">
      <button
        v-for="opt in [
          { value: '',                 label: 'Todas' },
          { value: 'PENDIENTE',        label: 'Pendientes' },
          { value: 'ENVIADA_A_ROCKET', label: 'En Rocket' },
          { value: 'ENLAZADA',         label: 'Enlazadas' },
          { value: 'CANCELADA',        label: 'Canceladas' },
        ]"
        :key="opt.value"
        @click="filtroEstado = opt.value as EstadoSolicitud | ''"
        class="px-3 h-8 text-[12px] font-medium rounded-md border hairline transition"
        :style="filtroEstado === opt.value
          ? { background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }
          : {}"
        :class="filtroEstado === opt.value ? '' : 'hover:bg-paper-alt'"
      >
        {{ opt.label }}
      </button>
    </div>

    <!-- Lista -->
    <div class="surface rounded-xl overflow-hidden">
      <div v-if="loading" class="py-12 text-center">
        <div class="inline-block w-5 h-5 border-2 rounded-full animate-spin" style="border-color: var(--line); border-top-color: var(--accent);"></div>
      </div>
      <div v-else-if="solicitudes.length === 0" class="empty-pattern py-16 text-center">
        <p class="text-[13px] text-ink-muted">
          No hay solicitudes{{ filtroEstado ? ` en estado ${ESTADO_LABELS[filtroEstado].label.toLowerCase()}` : '' }}.
        </p>
      </div>
      <table v-else class="w-full text-[13px]">
        <thead>
          <tr
            class="border-b hairline text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold"
            style="background: var(--paper-alt);"
          >
            <th class="py-2.5 pl-5 pr-2 text-left">Fecha</th>
            <th class="py-2.5 px-2 text-left">Cliente</th>
            <th class="py-2.5 px-2 text-left">Producto</th>
            <th class="py-2.5 px-2 text-left">Ciudad</th>
            <th class="py-2.5 px-2 text-left">Estado</th>
            <th class="py-2.5 pl-2 pr-5 text-right w-24"></th>
          </tr>
        </thead>
        <tbody class="divide-y hairline">
          <tr
            v-for="s in solicitudes"
            :key="s.id"
            class="hover:bg-paper-alt transition cursor-pointer row-parent"
            @click="abrirDetalle(s)"
          >
            <td class="py-3 pl-5 pr-2 text-[11px] tabular font-mono text-ink-faint">
              {{ fmtFecha(s.created_at) }}
            </td>
            <td class="py-3 px-2">
              <div class="font-medium">{{ s.cliente_nombre }}</div>
              <div class="text-[11px] tabular font-mono text-ink-faint">{{ s.cliente_telefono }}</div>
            </td>
            <td class="py-3 px-2 text-ink-muted">
              {{ s.productos?.nombre ?? '—' }}
              <span v-if="s.cantidad > 1" class="text-[11px] text-ink-faint">× {{ s.cantidad }}</span>
            </td>
            <td class="py-3 px-2 text-[12px] text-ink-muted">
              {{ [s.ciudad, s.provincia].filter(Boolean).join(', ') || '—' }}
            </td>
            <td class="py-3 px-2">
              <span
                class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium"
                :class="ESTADO_LABELS[s.estado].pill"
              >
                <span class="state-dot" :class="ESTADO_LABELS[s.estado].dot"></span>
                {{ ESTADO_LABELS[s.estado].label }}
              </span>
            </td>
            <td class="py-3 pl-2 pr-5 text-right">
              <button
                @click.stop="copiarTodoRocket(s)"
                class="row-actions text-[11px] font-medium hover:underline"
                style="color: var(--accent);"
                title="Copiar datos formateados para Rocket"
                aria-label="Copiar datos para Rocket"
              >
                Copiar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal detalle -->
    <div
      v-if="seleccionada"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      style="background: color-mix(in srgb, var(--ink) 40%, transparent);"
      @click.self="cerrarDetalle"
      @keydown.esc="cerrarDetalle"
      tabindex="-1"
    >
      <div class="surface rounded-xl max-w-lg w-full max-h-[90vh] overflow-y-auto thin-scroll" style="box-shadow: var(--shadow-xl);">
        <!-- Header -->
        <div class="p-5 border-b hairline flex items-center justify-between">
          <div>
            <h4 class="h-display text-[20px] leading-tight">Solicitud</h4>
            <p class="text-[11px] tabular font-mono text-ink-faint">{{ fmtFecha(seleccionada.created_at) }}</p>
          </div>
          <span
            class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium"
            :class="ESTADO_LABELS[seleccionada.estado].pill"
          >
            <span class="state-dot" :class="ESTADO_LABELS[seleccionada.estado].dot"></span>
            {{ ESTADO_LABELS[seleccionada.estado].label }}
          </span>
        </div>

        <!-- Datos con botón copiar individual -->
        <div class="p-5 space-y-3">
          <div v-for="campo in [
            { label: 'Nombre',    value: seleccionada.cliente_nombre },
            { label: 'Teléfono',  value: seleccionada.cliente_telefono },
            { label: 'Email',     value: seleccionada.cliente_email },
            { label: 'Dirección', value: seleccionada.direccion },
            { label: 'Ciudad',    value: seleccionada.ciudad },
            { label: 'Provincia', value: seleccionada.provincia },
            { label: 'Producto',  value: seleccionada.productos?.nombre ?? 'No asignado' },
            { label: 'Cantidad',  value: String(seleccionada.cantidad) },
            { label: 'Notas',     value: seleccionada.notas },
          ].filter(c => c.value)" :key="campo.label"
            class="flex items-start gap-2"
          >
            <div class="flex-1">
              <p class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold">{{ campo.label }}</p>
              <p class="text-[13px] break-words">{{ campo.value }}</p>
            </div>
            <button
              @click="copiar(campo.value as string, campo.label)"
              class="w-8 h-8 grid place-items-center rounded hover:bg-paper-alt text-ink-faint hover:text-ink transition"
              :title="`Copiar ${campo.label.toLowerCase()}`"
              :aria-label="`Copiar ${campo.label.toLowerCase()}`"
            >
              <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <rect x="5" y="5" width="8" height="9" rx="1"/>
                <path d="M3 3h8v2M3 3v8h2" stroke-linecap="round"/>
              </svg>
            </button>
          </div>

          <button
            @click="copiarTodoRocket(seleccionada)"
            class="w-full h-10 rounded-md text-[12px] font-medium hover:opacity-90 transition flex items-center justify-center gap-2 mt-2"
            style="background: var(--ink); color: var(--paper);"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="5" y="5" width="8" height="9" rx="1"/>
              <path d="M3 3h8v2M3 3v8h2" stroke-linecap="round"/>
            </svg>
            Copiar todo formateado para Rocket
          </button>
        </div>

        <!-- Vincular Rocket -->
        <div class="p-5 border-t hairline space-y-2" style="background: var(--paper-alt);">
          <p class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold">
            Pega aquí el ID PEDIDO que te dé Rocket
          </p>
          <div class="flex gap-2">
            <input
              v-model="rocketIdInput"
              type="text"
              placeholder="Ej. 185910452"
              class="flex-1 px-3 py-2 border hairline rounded-md text-[13px] text-ink focus:outline-none focus:border-accent transition"
              style="background: var(--paper-elev);"
            />
            <button
              @click="vincularRocket"
              class="h-10 px-4 rounded-md text-[12px] font-medium hover:opacity-90 transition"
              style="background: var(--ink); color: var(--paper);"
            >Guardar</button>
          </div>
          <p v-if="seleccionada.estado === 'ENLAZADA' && seleccionada.pedido_id" class="text-[11px] mt-1 flex items-center gap-1" style="color: var(--emerald-fg);">
            <span class="state-dot dot-emerald"></span>
            Enlazada con pedido de Rocket. Los cambios de estado se sincronizarán automáticamente.
          </p>
        </div>

        <!-- Footer actions -->
        <div class="p-5 border-t hairline flex gap-2 justify-between">
          <div class="flex gap-2">
            <button
              v-if="seleccionada.estado !== 'CANCELADA'"
              @click="cancelar(seleccionada)"
              class="h-8 px-3 text-[11px] font-medium rounded-md hover:bg-paper-alt transition"
              style="color: var(--amber-fg);"
            >Cancelar solicitud</button>
            <button
              @click="eliminar(seleccionada)"
              class="h-8 px-3 text-[11px] font-medium rounded-md hover:bg-paper-alt transition"
              style="color: var(--rose-dot);"
            >Eliminar</button>
          </div>
          <button
            @click="cerrarDetalle"
            class="h-8 px-3 text-[12px] font-medium rounded-md hover:bg-paper-alt transition"
          >Cerrar</button>
        </div>
      </div>
    </div>
  </div>
</template>
