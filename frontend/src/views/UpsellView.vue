<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useTiendaStore } from '../stores/tienda'
import { usePedidosStore } from '../stores/pedidos'
import { useTemplatesStore } from '../stores/templates'
import { abrirWhatsApp } from '../composables/useWhatsApp'
import {
  renderTemplate,
  type WhatsAppTemplate,
} from '../services/templatesService'
import type { Pedido } from '../services/pedidosService'

/**
 * Bandeja de oportunidades de upsell post-entrega.
 * Lista los pedidos ENTREGADO hace 2-30 días. Por cada uno genera el
 * mensaje con la plantilla `upsell-*` (o la plantilla "libre" si no hay)
 * y permite abrir WhatsApp con un click. El operador hace el envío
 * manualmente — no enviamos nada en nombre suyo.
 */

const toast = useToast()
const tiendaStore = useTiendaStore()
const pedidosStore = usePedidosStore()
const templatesStore = useTemplatesStore()

// ── Config de ventanas ──
type Ventana = 'reciente' | 'fresca' | 'vieja'
const ventanas: Array<{ key: Ventana; label: string; min: number; max: number }> = [
  { key: 'reciente', label: 'Hace 2–4 días',  min: 2,  max: 4 },
  { key: 'fresca',   label: 'Hace 5–10 días', min: 5,  max: 10 },
  { key: 'vieja',    label: 'Hace 11–30 días',min: 11, max: 30 },
]
const ventanaSeleccionada = ref<Ventana>('reciente')

function diasDesde(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

const candidatos = computed<Array<{ pedido: Pedido; dias: number }>>(() => {
  const v = ventanas.find((x) => x.key === ventanaSeleccionada.value)!
  return pedidosStore.pedidos
    .filter((p) => p.estado === 'ENTREGADO')
    .map((p) => ({ pedido: p, dias: diasDesde(p.updated_at) }))
    .filter((x) => x.dias >= v.min && x.dias <= v.max)
    .sort((a, b) => a.dias - b.dias)
})

// ── Plantilla a usar ──
// Priorizamos plantillas de categoría 'upsell'; fallback a 'libre'.
const plantillasUpsell = computed(() =>
  templatesStore.activos.filter((t) => t.categoria === 'upsell'),
)

const plantillaIdSeleccionada = ref<string | null>(null)

watch([plantillasUpsell, templatesStore.activos], () => {
  if (plantillaIdSeleccionada.value) return
  const upsell = plantillasUpsell.value[0]
  if (upsell) { plantillaIdSeleccionada.value = upsell.id; return }
  const libre = templatesStore.porSlug('libre')
  plantillaIdSeleccionada.value = libre?.id ?? templatesStore.activos[0]?.id ?? null
}, { immediate: true })

const plantillaActiva = computed<WhatsAppTemplate | null>(() =>
  templatesStore.activos.find((t) => t.id === plantillaIdSeleccionada.value) ?? null,
)

function construirVariables(p: Pedido): Record<string, string> {
  return {
    nombre: p.cliente_nombre || p.clientes?.nombre || '',
    producto: p.productos?.nombre || '',
    guia: p.guia,
    tienda: tiendaStore.tiendaActiva?.nombre || 'nuestra tienda',
    agencia: p.direccion || '',
    direccion: p.direccion || '',
    monto: `$${Number(p.monto).toFixed(2)}`,
    link_tracking: p.tracking_code
      ? `${window.location.origin}/t/${p.tracking_code}`
      : '',
  }
}

function previewFor(p: Pedido): string {
  if (!plantillaActiva.value) return ''
  return renderTemplate(plantillaActiva.value.mensaje, construirVariables(p))
}

function abrirWA(p: Pedido) {
  if (!plantillaActiva.value) {
    toast.warning('Elegí una plantilla primero')
    return
  }
  const tel = p.cliente_telefono || p.clientes?.telefono || ''
  if (!tel) {
    toast.warning('Este pedido no tiene teléfono registrado')
    return
  }
  abrirWhatsApp(tel, previewFor(p))
}

async function copiarMensaje(p: Pedido) {
  try {
    await navigator.clipboard.writeText(previewFor(p))
    toast.success('Mensaje copiado')
  } catch {
    toast.error('No se pudo copiar')
  }
}

// ── Mount + tienda switch ──
onMounted(() => {
  if (pedidosStore.pedidos.length === 0) pedidosStore.fetchPedidos()
  if (templatesStore.templates.length === 0) templatesStore.fetchTemplates()
})
watch(() => tiendaStore.tiendaActivaId, () => {
  pedidosStore.fetchPedidos()
  templatesStore.fetchTemplates()
  plantillaIdSeleccionada.value = null
})
</script>

<template>
  <div class="px-8 py-8">
    <!-- Header -->
    <div class="flex items-end justify-between mb-6 flex-wrap gap-4">
      <div>
        <div class="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint mb-2">
          {{ candidatos.length }} oportunidades en la ventana actual
        </div>
        <h1 class="h-display text-[40px] leading-none">
          Upsell <span class="h-display-italic text-ink-muted">post-entrega</span>
        </h1>
      </div>
    </div>

    <!-- Controles: ventana + plantilla -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      <div class="surface rounded-xl p-4">
        <div class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-2">
          Ventana
        </div>
        <div class="flex gap-1 flex-wrap">
          <button
            v-for="v in ventanas"
            :key="v.key"
            @click="ventanaSeleccionada = v.key"
            class="h-8 px-3 text-[12px] font-medium rounded-md border hairline transition"
            :style="ventanaSeleccionada === v.key
              ? { background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }
              : {}"
            :class="ventanaSeleccionada === v.key ? '' : 'hover:bg-paper-alt'"
          >
            {{ v.label }}
          </button>
        </div>
      </div>

      <div class="surface rounded-xl p-4">
        <div class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-2">
          Plantilla
        </div>
        <select
          v-model="plantillaIdSeleccionada"
          class="w-full h-8 px-2 rounded-md border hairline bg-paper-alt text-[13px] text-ink outline-none"
        >
          <option :value="null" disabled>Elegí una plantilla</option>
          <optgroup v-if="plantillasUpsell.length > 0" label="Upsell">
            <option v-for="t in plantillasUpsell" :key="t.id" :value="t.id">
              {{ t.nombre }}
            </option>
          </optgroup>
          <optgroup label="Otras">
            <option
              v-for="t in templatesStore.activos.filter((x) => x.categoria !== 'upsell')"
              :key="t.id"
              :value="t.id"
            >
              {{ t.nombre }} ({{ t.categoria }})
            </option>
          </optgroup>
        </select>
        <p v-if="plantillasUpsell.length === 0" class="text-[11px] text-ink-faint mt-2">
          💡 Creá una plantilla de categoría <b>Upsell</b> en
          <router-link to="/plantillas" class="underline" style="color: var(--accent);">/plantillas</router-link>
          para que aparezca aquí.
        </p>
      </div>
    </div>

    <!-- Lista -->
    <div v-if="candidatos.length === 0" class="surface empty-pattern rounded-xl py-16 text-center">
      <p class="text-[13px] text-ink-muted">
        Sin pedidos entregados en esta ventana. Probá otra ventana o volvé mañana.
      </p>
    </div>

    <div v-else class="space-y-3">
      <div
        v-for="c in candidatos"
        :key="c.pedido.id"
        class="surface rounded-xl overflow-hidden"
      >
        <div class="p-4 flex items-start gap-4 flex-wrap">
          <div
            class="w-10 h-10 rounded-full grid place-items-center text-[12px] font-semibold shrink-0"
            style="background: linear-gradient(135deg, var(--emerald-bg), var(--rose-bg)); color: var(--emerald-fg);"
          >
            {{ (c.pedido.cliente_nombre || c.pedido.clientes?.nombre || '?').charAt(0).toUpperCase() }}
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5 flex-wrap">
              <span class="font-medium">
                {{ c.pedido.cliente_nombre || c.pedido.clientes?.nombre }}
              </span>
              <span class="text-[11px] tabular font-mono text-ink-faint">
                {{ c.pedido.cliente_telefono || c.pedido.clientes?.telefono }}
              </span>
            </div>
            <div class="text-[12px] text-ink-muted">
              Compró <b>{{ c.pedido.productos?.nombre }}</b> hace {{ c.dias }} día{{ c.dias === 1 ? '' : 's' }} ·
              ${{ Number(c.pedido.monto).toFixed(2) }}
            </div>
          </div>

          <div class="flex gap-2 shrink-0">
            <button
              @click="copiarMensaje(c.pedido)"
              class="h-9 px-3 rounded-md border hairline text-[11px] font-medium hover:bg-paper-alt transition"
              :disabled="!plantillaActiva"
            >
              Copiar
            </button>
            <button
              @click="abrirWA(c.pedido)"
              :disabled="!plantillaActiva"
              class="h-9 px-3 rounded-md text-[11px] font-medium text-white hover:opacity-90 transition flex items-center gap-1.5 disabled:opacity-50"
              style="background: var(--emerald-dot);"
            >
              <svg class="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1a7 7 0 00-6.06 10.5L1 15l3.6-.94A7 7 0 108 1z"/>
              </svg>
              Abrir WA
            </button>
          </div>
        </div>

        <!-- Preview colapsable del mensaje -->
        <details v-if="plantillaActiva" class="border-t hairline">
          <summary class="px-4 py-2 text-[11px] text-ink-faint cursor-pointer hover:text-ink-muted list-none flex items-center gap-1">
            <svg class="w-3 h-3 transition" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M4 3l4 3-4 3"/>
            </svg>
            Ver mensaje
          </summary>
          <div class="p-4 pt-0 text-[12px] whitespace-pre-wrap text-ink-muted">{{ previewFor(c.pedido) }}</div>
        </details>
      </div>
    </div>
  </div>
</template>
