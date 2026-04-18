<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import Drawer from 'primevue/drawer'
import type { EstadoPedido, Pedido } from '../../services/pedidosService'
import { TODOS_LOS_ESTADOS } from '../../services/pedidosService'
import {
  ESTADO_LABELS,
  diasRetencion,
  retencionColor,
  formatFechaLarga,
} from '../../composables/usePedidoEstado'
import {
  calcularStatsProvincia,
  calcularStatsCliente,
  calcularRiesgo,
  NIVEL_PILL,
  NIVEL_DOT,
} from '../../composables/usePedidoRiesgo'
import { usePedidosStore } from '../../stores/pedidos'

const props = defineProps<{
  visible: boolean
  pedido: Pedido | null
  loading: boolean
}>()

const emit = defineEmits<{
  'update:visible': [v: boolean]
  'generar-referido': [p: Pedido]
  'cambiar-estado': [nuevo: EstadoPedido]
  'toggle-retencion': [p: Pedido]
  editar: [payload: {
    cliente_nombre: string
    cliente_telefono: string
    direccion: string
    notas: string
    dias_en_agencia: number
    monto: number
    guia: string
  }]
  'abrir-wa': [p: Pedido]
  'abrir-tracking': [guia: string]
  eliminar: [p: Pedido]
}>()

const editando = ref(false)
const accionesAvanzadasAbiertas = ref(false)
const editForm = ref({
  cliente_nombre: '',
  cliente_telefono: '',
  direccion: '',
  notas: '',
  dias_en_agencia: 0,
  monto: 0,
  guia: '',
})

function iniciarEdicion() {
  if (!props.pedido) return
  editForm.value = {
    cliente_nombre: props.pedido.cliente_nombre || props.pedido.clientes?.nombre || '',
    cliente_telefono: props.pedido.cliente_telefono || props.pedido.clientes?.telefono || '',
    direccion: props.pedido.direccion,
    notas: props.pedido.notas || '',
    dias_en_agencia: props.pedido.dias_en_agencia,
    monto: Number(props.pedido.monto),
    guia: props.pedido.guia,
  }
  editando.value = true
}

function guardar() {
  emit('editar', { ...editForm.value })
}

async function copiarLinkTracking() {
  if (!props.pedido?.tracking_code) return
  const url = `${window.location.origin}/t/${props.pedido.tracking_code}`
  try {
    await navigator.clipboard.writeText(url)
  } catch {
    // silencioso
  }
}

watch(() => props.pedido?.id, () => {
  editando.value = false
  accionesAvanzadasAbiertas.value = false
})

// Dot semántico por estado
const DOT_BY_ESTADO: Record<string, string> = {
  ENTREGADO: 'dot-emerald',
  NOVEDAD: 'dot-amber',
  NO_ENTREGADO: 'dot-rose',
  DEVUELTO: 'dot-rose',
  ENVIADO: 'dot-blue',
  EN_RUTA: 'dot-blue',
  RETIRO_EN_AGENCIA: 'dot-blue',
  PENDIENTE: 'dot-stone',
  CONFIRMADO: 'dot-stone',
  EN_PREPARACION: 'dot-stone',
}
const PILL_BY_ESTADO: Record<string, string> = {
  ENTREGADO: 'pill-emerald',
  NOVEDAD: 'pill-amber',
  NO_ENTREGADO: 'pill-rose',
  DEVUELTO: 'pill-rose',
  ENVIADO: 'pill-blue',
  EN_RUTA: 'pill-blue',
  RETIRO_EN_AGENCIA: 'pill-blue',
  PENDIENTE: 'pill-amber',
  CONFIRMADO: 'pill-blue',
  EN_PREPARACION: 'pill-blue',
}

function iniciales(nombre?: string): string {
  if (!nombre) return '?'
  const words = nombre.trim().split(/\s+/).slice(0, 2)
  return words.map((w) => w[0]).join('').toUpperCase()
}

const historialOrdenado = computed(() => {
  const list = [...(props.pedido?.historial || [])]
  return list.sort((a, b) => b.created_at.localeCompare(a.created_at))
})

// Riesgo pre-envío (calculado sobre todos los pedidos cargados)
const pedidosStore = usePedidosStore()
const statsProvincia = computed(() => calcularStatsProvincia(pedidosStore.pedidos))
const statsCliente = computed(() => calcularStatsCliente(pedidosStore.pedidos))
const riesgo = computed(() =>
  props.pedido ? calcularRiesgo(props.pedido, statsProvincia.value, statsCliente.value) : null,
)

// El riesgo sólo aplica mientras el pedido está "accionable"
const riesgoAccionable = computed(() =>
  props.pedido
    ? ['PENDIENTE', 'CONFIRMADO', 'EN_PREPARACION', 'NOVEDAD'].includes(props.pedido.estado)
    : false,
)
</script>

<template>
  <Drawer
    :visible="visible"
    @update:visible="(v) => emit('update:visible', v)"
    position="right"
    :style="{ width: '520px' }"
    :showHeader="false"
    :pt="{
      root: { class: 'border-l hairline' },
      mask: { style: 'background: color-mix(in srgb, var(--ink) 20%, transparent);' },
    }"
  >
    <div v-if="loading" class="flex items-center justify-center py-20">
      <div class="w-6 h-6 border-2 rounded-full animate-spin" style="border-color: var(--line); border-top-color: var(--accent);"></div>
    </div>

    <div v-else-if="pedido" class="flex flex-col h-full thin-scroll overflow-y-auto">
      <!-- Sticky header: ID + estado + close -->
      <div
        class="sticky top-0 border-b hairline px-6 py-4 flex items-center justify-between z-10"
        style="background: var(--paper-elev);"
      >
        <div class="flex items-center gap-3">
          <span class="font-mono text-[12px] text-ink-faint tabular">#{{ pedido.guia }}</span>
          <span
            class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium"
            :class="PILL_BY_ESTADO[pedido.estado] || 'pill-blue'"
          >
            <span class="state-dot" :class="DOT_BY_ESTADO[pedido.estado] || 'dot-blue'"></span>
            {{ ESTADO_LABELS[pedido.estado] || pedido.estado }}
          </span>
        </div>
        <button
          @click="emit('update:visible', false)"
          class="w-8 h-8 grid place-items-center rounded-md hover:bg-paper-alt"
          aria-label="Cerrar"
        >
          <svg class="w-4 h-4" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M4 4l8 8M12 4l-8 8" stroke-linecap="round"/>
          </svg>
        </button>
      </div>

      <div class="p-6 flex-1">
        <!-- Cliente -->
        <div class="flex items-start gap-4 mb-6">
          <div
            class="w-12 h-12 rounded-full grid place-items-center text-[14px] font-semibold shrink-0"
            :style="pedido.estado === 'NOVEDAD' || pedido.estado === 'NO_ENTREGADO'
              ? { background: 'linear-gradient(135deg, var(--amber-bg), var(--amber-surface))', color: 'var(--amber-fg)' }
              : { background: 'linear-gradient(135deg, var(--rose-bg), var(--accent-soft))', color: 'var(--rose-fg)' }"
          >
            {{ iniciales(pedido.cliente_nombre || pedido.clientes?.nombre) }}
          </div>
          <div class="flex-1 min-w-0">
            <h2 class="h-display text-[24px] leading-tight mb-0.5 truncate">
              {{ pedido.cliente_nombre || pedido.clientes?.nombre }}
            </h2>
            <div class="text-[12px] text-ink-muted font-mono tabular">
              {{ pedido.cliente_telefono || pedido.clientes?.telefono || '—' }}
              <span v-if="pedido.provincia"> · {{ pedido.provincia }}</span>
              <span v-if="pedido.direccion" class="text-ink-faint"> · {{ pedido.direccion }}</span>
            </div>
            <div
              v-if="pedido.lat != null && pedido.lng != null"
              class="flex items-center gap-2 mt-1 text-[11px]"
            >
              <a
                :href="`https://www.google.com/maps/search/?api=1&query=${pedido.lat},${pedido.lng}`"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex items-center gap-1 font-medium hover:underline"
                style="color: var(--accent);"
              >
                <svg class="w-3 h-3" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                  <path d="M8 1.5c-2.5 0-4.5 2-4.5 4.5 0 3.5 4.5 8 4.5 8s4.5-4.5 4.5-8c0-2.5-2-4.5-4.5-4.5z" />
                  <circle cx="8" cy="6" r="1.5" />
                </svg>
                Ver en Maps
              </a>
              <span
                v-if="pedido.direccion_referencia"
                class="text-ink-faint"
              >
                · Ref: {{ pedido.direccion_referencia }}
              </span>
            </div>
          </div>
        </div>

        <!-- Acciones rápidas -->
        <div class="grid grid-cols-3 gap-2 mb-7">
          <button
            @click="emit('abrir-wa', pedido)"
            class="h-9 rounded-md text-[11px] font-medium text-white transition flex items-center justify-center gap-1.5 hover:opacity-90"
            style="background: var(--emerald-dot);"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 00-6.06 10.5L1 15l3.6-.94A7 7 0 108 1z"/>
            </svg>
            WhatsApp
          </button>
          <button
            v-if="!editando"
            @click="iniciarEdicion"
            class="h-9 rounded-md border hairline text-[11px] font-medium hover:bg-paper-alt transition"
          >
            Editar
          </button>
          <button
            v-else
            @click="editando = false"
            class="h-9 rounded-md border hairline text-[11px] font-medium hover:bg-paper-alt transition"
          >
            Cancelar
          </button>
          <button
            @click="emit('toggle-retencion', pedido)"
            class="h-9 rounded-md border hairline text-[11px] font-medium hover:bg-paper-alt transition"
          >
            {{ pedido.retencion_inicio ? 'Parar retención' : 'Retención' }}
          </button>
        </div>

        <!-- Form de edición (inline) -->
        <div v-if="editando" class="space-y-3 mb-6">
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">Nombre</label>
              <input v-model="editForm.cliente_nombre" type="text"
                class="w-full px-3 py-2 border hairline rounded-md bg-paper-alt text-[13px] text-ink focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">Teléfono</label>
              <input v-model="editForm.cliente_telefono" type="text"
                class="w-full px-3 py-2 border hairline rounded-md bg-paper-alt text-[13px] text-ink focus:outline-none focus:border-accent" />
            </div>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">Guía</label>
              <input v-model="editForm.guia" type="text"
                class="w-full px-3 py-2 border hairline rounded-md bg-paper-alt text-[13px] text-ink focus:outline-none focus:border-accent" />
            </div>
            <div>
              <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">Monto ($)</label>
              <input v-model.number="editForm.monto" type="number" step="0.01" min="0"
                class="w-full px-3 py-2 border hairline rounded-md bg-paper-alt text-[13px] text-ink focus:outline-none focus:border-accent" />
            </div>
          </div>
          <div>
            <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">Dirección</label>
            <input v-model="editForm.direccion" type="text"
              class="w-full px-3 py-2 border hairline rounded-md bg-paper-alt text-[13px] text-ink focus:outline-none focus:border-accent" />
          </div>
          <div>
            <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">Notas</label>
            <textarea v-model="editForm.notas" rows="2"
              class="w-full px-3 py-2 border hairline rounded-md bg-paper-alt text-[13px] text-ink focus:outline-none focus:border-accent resize-none"></textarea>
          </div>
          <button
            @click="guardar"
            class="w-full h-9 rounded-md text-[12px] font-medium hover:opacity-90 transition"
            style="background: var(--ink); color: var(--paper);"
          >
            Guardar cambios
          </button>
        </div>

        <!-- Análisis de riesgo pre-envío -->
        <div v-if="!editando && riesgo && riesgoAccionable" class="mb-7">
          <div class="flex items-center justify-between mb-3">
            <div class="text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold">
              Análisis de riesgo
            </div>
            <span
              class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium"
              :class="NIVEL_PILL[riesgo.nivel]"
            >
              <span class="state-dot" :class="NIVEL_DOT[riesgo.nivel]"></span>
              {{ riesgo.nivel.charAt(0).toUpperCase() + riesgo.nivel.slice(1) }} · {{ riesgo.score }}/100
            </span>
          </div>
          <div
            v-if="riesgo.factores.length > 0"
            class="surface rounded-md p-3 space-y-1.5"
          >
            <div
              v-for="(f, i) in riesgo.factores"
              :key="i"
              class="flex items-start gap-2 text-[12px]"
            >
              <span
                class="inline-block px-1.5 py-0.5 rounded text-[10px] font-mono tabular shrink-0"
                :style="f.impacto > 0
                  ? { background: 'var(--rose-bg)', color: 'var(--rose-fg)' }
                  : { background: 'var(--emerald-bg)', color: 'var(--emerald-fg)' }"
              >
                {{ f.impacto > 0 ? '+' : '' }}{{ f.impacto }}
              </span>
              <div class="flex-1">
                <div class="font-medium">{{ f.nombre }}</div>
                <div class="text-ink-muted">{{ f.razon }}</div>
              </div>
            </div>
          </div>
          <div v-else class="text-[12px] text-ink-faint">
            Sin factores destacados. Pedido listo para enviar.
          </div>
        </div>

        <!-- Historial (timeline vertical) -->
        <div v-if="!editando" class="mb-7">
          <div class="text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-4">Historial</div>
          <ol v-if="historialOrdenado.length > 0" class="relative border-l hairline ml-2 pl-5 space-y-5">
            <li
              v-for="(h, i) in historialOrdenado"
              :key="h.id"
              class="relative"
            >
              <span
                class="absolute -left-[27px] top-1 w-3 h-3 rounded-full"
                :class="DOT_BY_ESTADO[h.estado_nuevo] || 'dot-stone'"
                :style="{ boxShadow: `0 0 0 4px var(--${i === 0 ? 'amber-bg' : 'paper-alt'})` }"
              ></span>
              <div class="text-[11px] text-ink-faint tabular font-mono mb-0.5">
                {{ formatFechaLarga(h.created_at) }}
              </div>
              <div class="text-[13px] font-medium">
                {{ ESTADO_LABELS[h.estado_nuevo] || h.estado_nuevo }}
              </div>
              <div v-if="h.nota" class="text-[12px] text-ink-muted mt-0.5">{{ h.nota }}</div>
            </li>
          </ol>
          <div v-else class="text-[12px] text-ink-faint">Sin historial registrado</div>
        </div>

        <!-- Producto card -->
        <div v-if="!editando" class="surface rounded-lg p-4 mb-6 flex items-center gap-4">
          <div
            class="w-12 h-12 rounded overflow-hidden shrink-0"
            :style="pedido.productos?.foto_url
              ? { background: 'var(--paper-alt)' }
              : { background: 'linear-gradient(135deg, var(--rose-bg), var(--accent-soft))' }"
          >
            <img
              v-if="pedido.productos?.foto_url"
              :src="pedido.productos.foto_url"
              :alt="pedido.productos.nombre"
              loading="lazy"
              class="w-full h-full object-cover"
            />
          </div>
          <div class="flex-1 min-w-0">
            <div class="font-medium truncate">{{ pedido.productos?.nombre || '—' }}</div>
            <div class="text-[11px] text-ink-faint tabular font-mono">
              {{ pedido.tipo_entrega }}
            </div>
          </div>
          <div class="text-right">
            <div class="h-display tabular text-[18px] leading-none">
              ${{ Number(pedido.monto).toFixed(2) }}
            </div>
            <div class="text-[10px] text-ink-faint mt-0.5">total</div>
          </div>
        </div>

        <!-- Detalles metadata -->
        <dl v-if="!editando" class="grid grid-cols-2 gap-y-3 gap-x-6 text-[12px] mb-6">
          <div v-if="pedido.tracking_code" class="col-span-2">
            <dt class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">
              Link público de tracking
            </dt>
            <dd class="flex items-center gap-2">
              <code class="font-mono tabular text-[11px] flex-1 truncate">
                /t/{{ pedido.tracking_code }}
              </code>
              <button
                @click="copiarLinkTracking"
                class="h-7 px-2 rounded border hairline text-[10px] font-medium hover:bg-paper-alt"
                title="Copiar URL completa"
              >
                Copiar link
              </button>
            </dd>
          </div>
          <div>
            <dt class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">Guía</dt>
            <dd class="font-mono tabular break-all">{{ pedido.guia }}</dd>
          </div>
          <div v-if="pedido.canal_origen">
            <dt class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">Canal</dt>
            <dd>{{ pedido.canal_origen }}</dd>
          </div>
          <div>
            <dt class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">Fecha despacho</dt>
            <dd class="tabular">{{ formatFechaLarga(pedido.fecha_despacho) }}</dd>
          </div>
          <div v-if="pedido.retencion_inicio">
            <dt class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">Retención</dt>
            <dd :class="retencionColor(diasRetencion(pedido.retencion_inicio))" class="px-2 py-0.5 rounded inline-block">
              Día {{ diasRetencion(pedido.retencion_inicio) }} / 8
            </dd>
          </div>
        </dl>

        <!-- Cambio de estado (collapse) -->
        <div v-if="!editando" class="border-t hairline pt-4 mb-4">
          <div class="text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-3">
            Cambiar estado
          </div>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="trans in TODOS_LOS_ESTADOS.filter(e => e !== pedido?.estado)"
              :key="trans"
              @click="emit('cambiar-estado', trans as EstadoPedido)"
              class="px-2.5 py-1 text-[11px] font-medium rounded-md border hairline hover:bg-paper-alt transition flex items-center gap-1.5"
            >
              <span class="state-dot" :class="DOT_BY_ESTADO[trans] || 'dot-stone'"></span>
              {{ ESTADO_LABELS[trans] || trans }}
            </button>
          </div>
        </div>

        <!-- Generar referido (solo entregados) -->
        <div v-if="!editando && pedido.estado === 'ENTREGADO'" class="border-t hairline pt-4 mb-4">
          <button
            @click="emit('generar-referido', pedido)"
            class="w-full h-9 rounded-md border hairline text-[12px] font-medium hover:bg-paper-alt transition flex items-center justify-center gap-2"
          >
            <span>🎁</span>
            Generar código de referido para este cliente
          </button>
          <p class="text-[11px] text-ink-faint mt-2 text-center">
            Crea un link único que el cliente puede compartir.
          </p>
        </div>

        <!-- Acciones avanzadas -->
        <details v-if="!editando" class="border-t hairline pt-4" @toggle="accionesAvanzadasAbiertas = ($event.target as HTMLDetailsElement).open">
          <summary class="text-[11px] text-ink-faint cursor-pointer hover:text-ink-muted list-none flex items-center gap-1 select-none">
            <svg
              class="w-3 h-3 transition"
              :style="{ transform: accionesAvanzadasAbiertas ? 'rotate(90deg)' : '' }"
              viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5"
            >
              <path d="M4 3l4 3-4 3"/>
            </svg>
            Acciones avanzadas
          </summary>
          <div class="mt-3">
            <button
              @click="emit('eliminar', pedido)"
              class="h-8 px-3 rounded-md border hairline text-[11px] font-medium transition"
              style="color: var(--rose-dot);"
            >
              Eliminar pedido
            </button>
          </div>
        </details>
      </div>
    </div>
  </Drawer>
</template>
