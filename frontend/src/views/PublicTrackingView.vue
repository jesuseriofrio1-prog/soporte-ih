<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import api from '../services/api'

/**
 * Vista pública de tracking. El cliente entra con el link `/t/<code>` y
 * ve: estado actual, timeline, producto, marca de la tienda, botón
 * WhatsApp al admin. No requiere auth. No muestra teléfono del cliente,
 * monto ni guía interna.
 */

interface TrackingItem { estado: string; fecha: string; nota: string | null }
interface TrackingData {
  tracking_code: string
  estado: string
  tipo_entrega: 'DOMICILIO' | 'AGENCIA'
  fecha_creado: string
  fecha_despacho: string | null
  provincia: string | null
  dias_en_agencia: number
  cliente_nombre_masked: string
  producto: { nombre: string; slug: string; icono: string | null } | null
  tienda: {
    slug: string
    nombre: string
    logo_url: string | null
    color_primario: string | null
    color_secundario: string | null
    color_fondo: string | null
  }
  historial: TrackingItem[]
  whatsapp_contacto: string | null
}

const route = useRoute()

const loading = ref(true)
const loadError = ref<string | null>(null)
const data = ref<TrackingData | null>(null)

const ESTADO_LABEL: Record<string, string> = {
  PENDIENTE: 'Pendiente de envío',
  CONFIRMADO: 'Pedido confirmado',
  EN_PREPARACION: 'En preparación',
  ENVIADO: 'Enviado',
  EN_RUTA: 'En ruta',
  NOVEDAD: 'Con novedad',
  RETIRO_EN_AGENCIA: 'Esperando retiro en agencia',
  ENTREGADO: 'Entregado',
  NO_ENTREGADO: 'No entregado',
  DEVUELTO: 'Devuelto',
}

const DOT_BY_ESTADO: Record<string, string> = {
  PENDIENTE: 'dot-stone',
  CONFIRMADO: 'dot-blue',
  EN_PREPARACION: 'dot-blue',
  ENVIADO: 'dot-blue',
  EN_RUTA: 'dot-blue',
  RETIRO_EN_AGENCIA: 'dot-blue',
  NOVEDAD: 'dot-amber',
  NO_ENTREGADO: 'dot-rose',
  ENTREGADO: 'dot-emerald',
  DEVUELTO: 'dot-rose',
}

const PILL_BY_ESTADO: Record<string, string> = {
  PENDIENTE: 'pill-amber',
  CONFIRMADO: 'pill-blue',
  EN_PREPARACION: 'pill-blue',
  ENVIADO: 'pill-blue',
  EN_RUTA: 'pill-blue',
  RETIRO_EN_AGENCIA: 'pill-blue',
  NOVEDAD: 'pill-amber',
  NO_ENTREGADO: 'pill-rose',
  ENTREGADO: 'pill-emerald',
  DEVUELTO: 'pill-rose',
}

/** Paso actual en el progreso visual (0-4). */
const pasoActual = computed(() => {
  if (!data.value) return 0
  const e = data.value.estado
  if (e === 'PENDIENTE' || e === 'CONFIRMADO') return 1
  if (e === 'EN_PREPARACION') return 2
  if (['ENVIADO', 'EN_RUTA', 'RETIRO_EN_AGENCIA'].includes(e)) return 3
  if (e === 'ENTREGADO') return 4
  return 1 // novedades u otros → mostrar hasta el paso de envío
})

function formatFechaHora(iso: string): string {
  return new Date(iso).toLocaleString('es-EC', {
    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
  })
}

function abrirWhatsApp() {
  if (!data.value?.whatsapp_contacto) return
  const tel = data.value.whatsapp_contacto.replace(/\D/g, '')
  const msg = `Hola, te escribo sobre mi pedido (${data.value.tracking_code})`
  window.open(`https://wa.me/${tel}?text=${encodeURIComponent(msg)}`, '_blank')
}

function aplicarColores(d: TrackingData) {
  if (d.tienda.color_primario) {
    document.documentElement.style.setProperty('--accent', d.tienda.color_primario)
  }
  document.title = `Tu pedido — ${d.tienda.nombre}`
}

onMounted(async () => {
  const code = route.params.code as string
  try {
    const { data: resp } = await api.get(`/public/tracking/${code}`)
    data.value = resp
    aplicarColores(resp)
  } catch (e: unknown) {
    const err = e as { response?: { status?: number } }
    if (err.response?.status === 404) {
      loadError.value = 'No encontramos tu pedido con ese código. Verifica el link.'
    } else if (err.response?.status === 400) {
      loadError.value = 'El código del link no es válido.'
    } else {
      loadError.value = 'No pudimos cargar tu pedido. Intenta de nuevo en un momento.'
    }
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="min-h-screen py-8 px-4" style="background: var(--paper);">
    <div class="max-w-xl mx-auto">
      <!-- Loading -->
      <div v-if="loading" class="text-center py-20">
        <div class="inline-block w-5 h-5 border-2 rounded-full animate-spin" style="border-color: var(--line); border-top-color: var(--accent);"></div>
      </div>

      <!-- Error -->
      <div v-else-if="loadError" class="surface rounded-2xl p-10 text-center" style="box-shadow: var(--shadow-md);">
        <div class="w-16 h-16 mx-auto rounded-full grid place-items-center mb-4" style="background: var(--rose-bg);">
          <svg class="w-7 h-7" style="color: var(--rose-dot);" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="8" cy="8" r="6.5"/>
            <path d="M5 5l6 6M11 5l-6 6" stroke-linecap="round"/>
          </svg>
        </div>
        <h2 class="h-display text-[22px] mb-2">{{ loadError }}</h2>
        <p class="text-[13px] text-ink-muted">
          Si el problema persiste, contacta a la tienda por sus canales oficiales.
        </p>
      </div>

      <!-- Tracking -->
      <div v-else-if="data" class="surface rounded-2xl overflow-hidden" style="box-shadow: var(--shadow-md);">
        <!-- Header branding -->
        <div class="p-6 text-white" :style="{ background: data.tienda.color_primario || 'var(--ink)' }">
          <div class="flex items-center gap-3">
            <img
              v-if="data.tienda.logo_url"
              :src="data.tienda.logo_url"
              :alt="data.tienda.nombre"
              class="w-10 h-10 rounded-lg bg-white/10 object-cover"
            />
            <div>
              <p class="text-xs uppercase tracking-wider opacity-80">Seguimiento de pedido</p>
              <h1 class="text-xl font-black">{{ data.tienda.nombre }}</h1>
            </div>
          </div>
          <div class="mt-4 flex items-center gap-2 text-[11px] opacity-90">
            <span>Código</span>
            <span class="font-mono tabular px-2 py-0.5 rounded" style="background: rgba(255,255,255,0.15);">
              {{ data.tracking_code }}
            </span>
          </div>
        </div>

        <!-- Estado actual + producto -->
        <div class="p-6 border-b hairline">
          <div class="flex items-start gap-4 flex-wrap">
            <div
              class="w-14 h-14 rounded-xl grid place-items-center text-2xl shrink-0"
              :style="{ background: `linear-gradient(135deg, var(--accent-soft), var(--paper-alt))` }"
            >
              {{ data.producto?.icono || '📦' }}
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold">
                Hola {{ data.cliente_nombre_masked }}
              </p>
              <p class="font-medium text-[15px] truncate">
                Tu pedido: {{ data.producto?.nombre || '—' }}
              </p>
              <span
                class="inline-flex items-center gap-1.5 px-2 py-0.5 mt-1 rounded text-[11px] font-medium"
                :class="PILL_BY_ESTADO[data.estado] || 'pill-blue'"
              >
                <span class="state-dot" :class="DOT_BY_ESTADO[data.estado] || 'dot-blue'"></span>
                {{ ESTADO_LABEL[data.estado] || data.estado }}
              </span>
            </div>
          </div>
        </div>

        <!-- Progress bar 4 pasos -->
        <div class="p-6 border-b hairline">
          <div class="flex items-start gap-0">
            <div
              v-for="(paso, i) in [
                { label: 'Confirmado', icon: '✓' },
                { label: 'Preparando', icon: '📦' },
                { label: 'En camino', icon: '🚚' },
                { label: 'Entregado', icon: '🏠' },
              ]"
              :key="i"
              class="flex-1 text-center relative"
            >
              <!-- Línea conectora (entre pasos, no en el último) -->
              <div
                v-if="i < 3"
                class="absolute top-4 left-1/2 right-0 h-0.5 -translate-y-1/2"
                :style="{
                  background: (i + 1) < pasoActual ? (data.tienda.color_primario || 'var(--ink)') : 'var(--line)',
                  width: 'calc(100% - 16px)',
                  marginLeft: '8px',
                }"
              ></div>
              <div
                class="w-8 h-8 rounded-full grid place-items-center mx-auto mb-1.5 text-[12px] relative z-10 transition"
                :style="(i + 1) <= pasoActual
                  ? { background: data.tienda.color_primario || 'var(--ink)', color: '#fff' }
                  : { background: 'var(--paper-alt)', color: 'var(--ink-faint)' }"
              >
                {{ paso.icon }}
              </div>
              <p
                class="text-[10px] font-medium"
                :class="(i + 1) <= pasoActual ? 'text-ink' : 'text-ink-faint'"
              >
                {{ paso.label }}
              </p>
            </div>
          </div>
        </div>

        <!-- Detalles -->
        <div class="p-6 border-b hairline grid grid-cols-2 gap-4 text-[13px]">
          <div>
            <p class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">Tipo de entrega</p>
            <p>{{ data.tipo_entrega === 'DOMICILIO' ? 'Domicilio' : 'Retiro en agencia' }}</p>
          </div>
          <div v-if="data.provincia">
            <p class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">Provincia</p>
            <p>{{ data.provincia }}</p>
          </div>
          <div v-if="data.estado === 'RETIRO_EN_AGENCIA' && data.dias_en_agencia > 0" class="col-span-2">
            <p class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">Días en agencia</p>
            <p :style="data.dias_en_agencia >= 6 ? { color: 'var(--rose-dot)' } : {}">
              {{ data.dias_en_agencia }} de 8 días ·
              <b v-if="data.dias_en_agencia >= 6">¡Retíralo pronto!</b>
            </p>
          </div>
        </div>

        <!-- Historial -->
        <div class="p-6">
          <h3 class="text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-4">Historial</h3>
          <ol v-if="data.historial.length > 0" class="relative border-l hairline ml-2 pl-5 space-y-4">
            <li v-for="(h, i) in data.historial" :key="i" class="relative">
              <span
                class="absolute -left-[27px] top-1 w-3 h-3 rounded-full"
                :class="DOT_BY_ESTADO[h.estado] || 'dot-stone'"
                :style="{ boxShadow: '0 0 0 4px var(--paper-elev)' }"
              ></span>
              <div class="text-[11px] text-ink-faint tabular font-mono mb-0.5">
                {{ formatFechaHora(h.fecha) }}
              </div>
              <div class="text-[13px] font-medium">
                {{ ESTADO_LABEL[h.estado] || h.estado }}
              </div>
              <div v-if="h.nota" class="text-[12px] text-ink-muted mt-0.5">{{ h.nota }}</div>
            </li>
          </ol>
          <p v-else class="text-[12px] text-ink-faint text-center py-4">
            Sin eventos registrados aún.
          </p>
        </div>

        <!-- CTA WhatsApp -->
        <div v-if="data.whatsapp_contacto" class="p-6 border-t hairline">
          <button
            @click="abrirWhatsApp"
            class="w-full h-11 rounded-md text-white font-medium text-[13px] hover:opacity-90 transition flex items-center justify-center gap-2"
            style="background: var(--emerald-dot);"
          >
            <svg class="w-4 h-4" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 1a7 7 0 00-6.06 10.5L1 15l3.6-.94A7 7 0 108 1z"/>
            </svg>
            Contactar a {{ data.tienda.nombre }} por WhatsApp
          </button>
        </div>
      </div>

      <p class="text-center text-[11px] text-ink-faint mt-4">
        Powered by <span class="font-medium">Soporte IH</span>
      </p>
    </div>
  </div>
</template>
