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

const ESTADO_LABELS: Record<EstadoSolicitud, { label: string; clase: string }> = {
  PENDIENTE:          { label: 'Pendiente',       clase: 'bg-orange-100 text-orange-800 border-orange-300' },
  ENVIADA_A_ROCKET:   { label: 'En Rocket',       clase: 'bg-blue-100 text-blue-800 border-blue-300' },
  ENLAZADA:           { label: 'Enlazada',        clase: 'bg-green-100 text-green-800 border-green-300' },
  CANCELADA:          { label: 'Cancelada',       clase: 'bg-gray-100 text-gray-600 border-gray-300' },
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
  <div class="space-y-5">
    <!-- Cabecera + filtros -->
    <div class="bg-white p-5 rounded-xl shadow-sm border border-lavanda-medio">
      <div class="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h3 class="text-lg font-bold text-navy">Solicitudes recibidas</h3>
          <p class="text-sm text-navy/60 mt-0.5">
            Formularios que llenaron tus clientes desde el link público.
            Copia los datos a Rocket y pega el <b>ID PEDIDO</b> aquí para cerrarlas.
          </p>
        </div>
        <div class="flex gap-2">
          <div class="px-3 py-2 rounded-lg bg-orange-50 border border-orange-200 text-center min-w-[90px]">
            <p class="text-[10px] uppercase font-bold text-orange-700">Pendientes</p>
            <p class="text-xl font-black text-orange-900">{{ pendientesCount }}</p>
          </div>
          <div class="px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-center min-w-[90px]">
            <p class="text-[10px] uppercase font-bold text-blue-700">En Rocket</p>
            <p class="text-xl font-black text-blue-900">{{ enviadasCount }}</p>
          </div>
        </div>
      </div>

      <!-- Share link general -->
      <div v-if="shareLinkGeneral" class="mt-4 flex items-center gap-2 bg-lavanda/40 border border-lavanda-medio rounded-lg px-3 py-2">
        <i class="pi pi-link text-mauve" aria-hidden="true"></i>
        <span class="text-xs text-navy/50 shrink-0">Link catálogo:</span>
        <code class="text-xs font-mono text-navy flex-1 truncate">{{ shareLinkGeneral }}</code>
        <button
          @click="copiar(shareLinkGeneral, 'Link')"
          class="text-xs font-bold text-mauve hover:underline shrink-0"
        >Copiar</button>
      </div>

      <!-- Filtros estado -->
      <div class="mt-4 flex gap-2 flex-wrap">
        <button
          v-for="opt in [
            { value: '',                  label: 'Todas' },
            { value: 'PENDIENTE',         label: 'Pendientes' },
            { value: 'ENVIADA_A_ROCKET',  label: 'En Rocket' },
            { value: 'ENLAZADA',          label: 'Enlazadas' },
            { value: 'CANCELADA',         label: 'Canceladas' },
          ]"
          :key="opt.value"
          @click="filtroEstado = opt.value as EstadoSolicitud | ''"
          :class="[
            'px-3 py-1 text-xs font-bold rounded-full border transition',
            filtroEstado === opt.value
              ? 'bg-navy text-white border-navy'
              : 'bg-white text-navy/70 border-lavanda-medio hover:bg-lavanda/50',
          ]"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- Lista -->
    <div class="bg-white rounded-xl shadow-sm border border-lavanda-medio overflow-x-auto">
      <div v-if="loading" class="text-center py-12">
        <i class="pi pi-spin pi-spinner text-3xl text-mauve"></i>
      </div>
      <div v-else-if="solicitudes.length === 0" class="text-center py-12 text-navy/50 text-sm">
        No hay solicitudes {{ filtroEstado ? `en estado ${ESTADO_LABELS[filtroEstado].label}` : '' }}.
      </div>
      <table v-else class="w-full text-sm">
        <thead class="bg-lavanda/40 text-navy">
          <tr class="text-left">
            <th class="px-4 py-2 font-bold">Fecha</th>
            <th class="px-4 py-2 font-bold">Cliente</th>
            <th class="px-4 py-2 font-bold">Producto</th>
            <th class="px-4 py-2 font-bold">Ciudad</th>
            <th class="px-4 py-2 font-bold">Estado</th>
            <th class="px-4 py-2 font-bold text-right">Acción</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="s in solicitudes"
            :key="s.id"
            class="border-t border-lavanda-medio hover:bg-lavanda/20 transition cursor-pointer"
            @click="abrirDetalle(s)"
          >
            <td class="px-4 py-2 text-navy/70 text-xs">{{ fmtFecha(s.created_at) }}</td>
            <td class="px-4 py-2">
              <p class="font-bold text-navy">{{ s.cliente_nombre }}</p>
              <p class="text-xs text-navy/50">{{ s.cliente_telefono }}</p>
            </td>
            <td class="px-4 py-2 text-navy/80">
              {{ s.productos?.nombre ?? '—' }}
              <span v-if="s.cantidad > 1" class="text-xs text-navy/50">× {{ s.cantidad }}</span>
            </td>
            <td class="px-4 py-2 text-navy/70">
              {{ [s.ciudad, s.provincia].filter(Boolean).join(', ') || '—' }}
            </td>
            <td class="px-4 py-2">
              <span
                class="inline-block px-2 py-0.5 text-[11px] font-bold rounded-full border"
                :class="ESTADO_LABELS[s.estado].clase"
              >{{ ESTADO_LABELS[s.estado].label }}</span>
            </td>
            <td class="px-4 py-2 text-right">
              <button
                @click.stop="copiarTodoRocket(s)"
                class="text-xs text-mauve hover:underline font-bold"
                title="Copiar datos formateados"
              >
                <i class="pi pi-copy" aria-hidden="true"></i> Copiar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal detalle -->
    <div
      v-if="seleccionada"
      class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      @click.self="cerrarDetalle"
    >
      <div class="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <!-- Header -->
        <div class="p-5 border-b border-lavanda-medio flex items-center justify-between">
          <div>
            <h4 class="text-lg font-bold text-navy">Solicitud</h4>
            <p class="text-xs text-navy/50">{{ fmtFecha(seleccionada.created_at) }}</p>
          </div>
          <span
            class="px-2 py-0.5 text-[11px] font-bold rounded-full border"
            :class="ESTADO_LABELS[seleccionada.estado].clase"
          >{{ ESTADO_LABELS[seleccionada.estado].label }}</span>
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
              <p class="text-[10px] uppercase font-bold text-navy/50">{{ campo.label }}</p>
              <p class="text-sm text-navy break-words">{{ campo.value }}</p>
            </div>
            <button
              @click="copiar(campo.value as string, campo.label)"
              class="text-navy/40 hover:text-mauve transition p-1"
              :title="`Copiar ${campo.label.toLowerCase()}`"
            >
              <i class="pi pi-copy text-sm" aria-hidden="true"></i>
            </button>
          </div>

          <button
            @click="copiarTodoRocket(seleccionada)"
            class="w-full py-2.5 mt-2 bg-mauve text-white rounded-lg font-bold text-sm hover:opacity-90 transition flex items-center justify-center gap-2"
          >
            <i class="pi pi-copy" aria-hidden="true"></i>
            Copiar todo formateado para Rocket
          </button>
        </div>

        <!-- Vincular Rocket -->
        <div class="p-5 border-t border-lavanda-medio bg-lavanda/20 space-y-2">
          <p class="text-xs font-bold text-navy uppercase tracking-wide">
            Pega aquí el ID PEDIDO que te dé Rocket
          </p>
          <div class="flex gap-2">
            <input
              v-model="rocketIdInput"
              type="text"
              placeholder="Ej. 185910452"
              class="flex-1 px-3 py-2 border border-lavanda-medio rounded-lg bg-white text-navy text-sm focus:outline-none focus:border-mauve"
            />
            <button
              @click="vincularRocket"
              class="px-4 py-2 bg-navy text-white rounded-lg text-sm font-bold hover:opacity-90 transition"
            >Guardar</button>
          </div>
          <p v-if="seleccionada.estado === 'ENLAZADA' && seleccionada.pedido_id" class="text-xs text-green-700 mt-1">
            <i class="pi pi-check-circle mr-1" aria-hidden="true"></i>
            Enlazada con pedido de Rocket. Los cambios de estado se sincronizarán automáticamente.
          </p>
        </div>

        <!-- Footer actions -->
        <div class="p-5 border-t border-lavanda-medio flex gap-2 justify-between">
          <div class="flex gap-2">
            <button
              v-if="seleccionada.estado !== 'CANCELADA'"
              @click="cancelar(seleccionada)"
              class="px-3 py-1.5 text-xs font-bold text-orange-700 hover:bg-orange-50 rounded-lg transition"
            >Cancelar solicitud</button>
            <button
              @click="eliminar(seleccionada)"
              class="px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg transition"
            >Eliminar</button>
          </div>
          <button
            @click="cerrarDetalle"
            class="px-4 py-1.5 text-sm font-bold text-navy hover:bg-lavanda/50 rounded-lg transition"
          >Cerrar</button>
        </div>
      </div>
    </div>
  </div>
</template>
