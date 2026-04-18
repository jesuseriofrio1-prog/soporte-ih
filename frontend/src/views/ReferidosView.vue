<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useToast } from 'vue-toastification'
import { useTiendaStore } from '../stores/tienda'
import referidosService, { type Referido } from '../services/referidosService'

const toast = useToast()
const tiendaStore = useTiendaStore()

const referidos = ref<Referido[]>([])
const loading = ref(false)

// Modal crear
const modalVisible = ref(false)
const form = ref({
  cliente_nombre: '',
  cliente_tel: '',
  codigo: '',
  notas: '',
})

async function cargar() {
  if (!tiendaStore.tiendaActiva) return
  loading.value = true
  try {
    referidos.value = await referidosService.list(tiendaStore.tiendaActiva.id)
  } catch {
    toast.error('No se pudieron cargar los referidos')
  } finally {
    loading.value = false
  }
}

onMounted(cargar)
watch(() => tiendaStore.tiendaActivaId, cargar)

function abrirModal() {
  form.value = { cliente_nombre: '', cliente_tel: '', codigo: '', notas: '' }
  modalVisible.value = true
}

async function crear() {
  if (!tiendaStore.tiendaActiva) return
  if (!form.value.cliente_nombre.trim()) {
    toast.warning('El nombre del cliente es requerido')
    return
  }
  try {
    const nuevo = await referidosService.create({
      tienda_id: tiendaStore.tiendaActiva.id,
      cliente_nombre: form.value.cliente_nombre.trim(),
      cliente_tel: form.value.cliente_tel.trim() || undefined,
      codigo: form.value.codigo.trim() || undefined,
      notas: form.value.notas.trim() || undefined,
    })
    referidos.value.unshift(nuevo)
    toast.success(`Código ${nuevo.codigo} creado`)
    modalVisible.value = false
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || 'No se pudo crear el referido')
  }
}

async function toggleActivo(r: Referido) {
  if (!tiendaStore.tiendaActiva) return
  try {
    const actualizado = await referidosService.update(r.id, tiendaStore.tiendaActiva.id, {
      activo: !r.activo,
    })
    const idx = referidos.value.findIndex((x) => x.id === r.id)
    if (idx !== -1) referidos.value[idx] = actualizado
  } catch {
    toast.error('No se pudo actualizar')
  }
}

async function eliminar(r: Referido) {
  if (!tiendaStore.tiendaActiva) return
  if (!confirm(`¿Eliminar el código ${r.codigo}? Esta acción no se puede deshacer.`)) return
  try {
    await referidosService.remove(r.id, tiendaStore.tiendaActiva.id)
    referidos.value = referidos.value.filter((x) => x.id !== r.id)
    toast.success('Código eliminado')
  } catch {
    toast.error('No se pudo eliminar')
  }
}

// Link + mensaje template para compartir
function linkDe(r: Referido): string {
  const slug = tiendaStore.tiendaActiva?.slug
  if (!slug) return ''
  return `${window.location.origin}/p/${slug}?ref=${encodeURIComponent(r.codigo)}`
}

function mensajeWA(r: Referido): string {
  const tienda = tiendaStore.tiendaActiva?.nombre || 'nuestra tienda'
  return `¡Hola ${r.cliente_referente_nombre}! 🎁

Te comparto tu código personal de referido en ${tienda}:

Código: *${r.codigo}*
Link directo: ${linkDe(r)}

Cuando alguien use tu link para pedir, te aviso y te mando un descuento especial por recomendar. ¡Gracias! ✨`
}

async function copiar(texto: string, label = 'Texto') {
  try {
    await navigator.clipboard.writeText(texto)
    toast.success(`${label} copiado`)
  } catch {
    toast.error('No se pudo copiar')
  }
}

// Stats
const totales = computed(() => {
  const activos = referidos.value.filter((r) => r.activo).length
  const usosTotal = referidos.value.reduce((sum, r) => sum + r.usos_count, 0)
  const conUsos = referidos.value.filter((r) => r.usos_count > 0).length
  return { activos, usosTotal, conUsos }
})

function fmtFecha(iso: string): string {
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: 'short', year: 'numeric' })
}
function fmtFechaCorta(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-EC', { day: '2-digit', month: 'short' })
}
</script>

<template>
  <div class="px-8 py-8">
    <!-- Header -->
    <div class="flex items-end justify-between mb-6 flex-wrap gap-4">
      <div>
        <div class="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint mb-2">
          {{ referidos.length }} códigos · {{ totales.usosTotal }} usos acumulados
        </div>
        <h1 class="h-display text-[40px] leading-none">
          Referidos <span class="h-display-italic text-ink-muted">tracking</span>
        </h1>
      </div>
      <button
        @click="abrirModal"
        class="h-9 px-3 rounded-md text-[12px] font-medium hover:opacity-90 transition flex items-center gap-2"
        style="background: var(--ink); color: var(--paper);"
      >
        <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M8 3v10M3 8h10" stroke-linecap="round"/>
        </svg>
        Nuevo código
      </button>
    </div>

    <!-- KPIs -->
    <div class="grid grid-cols-1 md:grid-cols-3 surface rounded-xl overflow-hidden mb-6">
      <div class="p-5 border-r hairline">
        <div class="text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-3">Activos</div>
        <div class="h-display tabular text-[24px] leading-none">{{ totales.activos }}</div>
      </div>
      <div class="p-5 border-r hairline">
        <div class="text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-3">Con al menos 1 uso</div>
        <div class="h-display tabular text-[24px] leading-none">{{ totales.conUsos }}</div>
      </div>
      <div class="p-5">
        <div class="text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold mb-3">Usos totales</div>
        <div class="h-display tabular text-[24px] leading-none">{{ totales.usosTotal }}</div>
      </div>
    </div>

    <!-- Tabla -->
    <div class="surface rounded-xl overflow-hidden">
      <div v-if="loading" class="py-10 text-center">
        <div class="inline-block w-5 h-5 border-2 rounded-full animate-spin" style="border-color: var(--line); border-top-color: var(--accent);"></div>
      </div>
      <div v-else-if="referidos.length === 0" class="empty-pattern py-16 text-center">
        <p class="text-[13px] text-ink-muted">
          Sin códigos creados. Creá el primero para empezar a trackear atribución.
        </p>
      </div>
      <table v-else class="w-full text-[13px]">
        <thead>
          <tr
            class="border-b hairline text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold"
            style="background: var(--paper-alt);"
          >
            <th class="py-2.5 pl-5 pr-2 text-left">Código</th>
            <th class="py-2.5 px-2 text-left">Referente</th>
            <th class="py-2.5 px-2 text-right">Usos</th>
            <th class="py-2.5 px-2 text-right">Último uso</th>
            <th class="py-2.5 px-2 text-left">Creado</th>
            <th class="py-2.5 pl-2 pr-5 text-right w-56">Acciones</th>
          </tr>
        </thead>
        <tbody class="divide-y hairline">
          <tr
            v-for="r in referidos"
            :key="r.id"
            class="transition row-parent hover:bg-paper-alt"
            :class="{ 'opacity-50': !r.activo }"
          >
            <td class="py-3 pl-5 pr-2">
              <code class="font-mono tabular font-semibold">{{ r.codigo }}</code>
            </td>
            <td class="py-3 px-2">
              <div class="font-medium">{{ r.cliente_referente_nombre }}</div>
              <div v-if="r.cliente_referente_tel" class="text-[11px] tabular font-mono text-ink-faint">
                {{ r.cliente_referente_tel }}
              </div>
            </td>
            <td class="py-3 px-2 text-right font-mono tabular">
              <span v-if="r.usos_count > 0" class="font-semibold" style="color: var(--emerald-fg);">
                {{ r.usos_count }}
              </span>
              <span v-else class="text-ink-faint">0</span>
            </td>
            <td class="py-3 px-2 text-right text-[11px] tabular font-mono text-ink-muted">
              {{ fmtFechaCorta(r.ultimo_uso_en) }}
            </td>
            <td class="py-3 px-2 text-[11px] tabular font-mono text-ink-faint">
              {{ fmtFecha(r.created_at) }}
            </td>
            <td class="py-3 pl-2 pr-5 text-right">
              <div class="flex items-center justify-end gap-1 flex-wrap">
                <button
                  @click="copiar(linkDe(r), 'Link')"
                  class="h-7 px-2 rounded-md text-[11px] font-medium hover:bg-paper-alt transition"
                  style="color: var(--accent);"
                  title="Copiar link del referido"
                >
                  Link
                </button>
                <button
                  @click="copiar(mensajeWA(r), 'Mensaje')"
                  class="h-7 px-2 rounded-md text-[11px] font-medium hover:bg-paper-alt transition"
                  style="color: var(--accent);"
                  title="Copiar mensaje completo para WhatsApp"
                >
                  Mensaje
                </button>
                <button
                  @click="toggleActivo(r)"
                  class="h-7 px-2 rounded-md border hairline text-[10px] font-medium hover:bg-paper-alt transition"
                >
                  {{ r.activo ? 'Pausar' : 'Activar' }}
                </button>
                <button
                  @click="eliminar(r)"
                  class="row-actions h-7 w-7 rounded-md grid place-items-center hover:bg-paper-alt transition"
                  title="Eliminar"
                >
                  <svg class="w-3.5 h-3.5" style="color: var(--rose-dot);" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                    <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1m-5 0v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke-linecap="round"/>
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Modal crear -->
    <div
      v-if="modalVisible"
      class="fixed inset-0 z-50 flex items-center justify-center p-4"
      style="background: color-mix(in srgb, var(--ink) 40%, transparent);"
      @click.self="modalVisible = false"
    >
      <div class="surface rounded-xl max-w-md w-full" style="box-shadow: var(--shadow-xl);">
        <div class="p-5 border-b hairline">
          <h3 class="h-display text-[20px]">Nuevo código de referido</h3>
          <p class="text-[12px] text-ink-muted mt-1">
            Se genera un código único para un cliente que quieras convertir en embajador.
          </p>
        </div>
        <form @submit.prevent="crear" class="p-5 space-y-4">
          <div>
            <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1.5">
              Nombre del referente *
            </label>
            <input
              v-model="form.cliente_nombre"
              type="text"
              placeholder="María López"
              class="w-full px-3 py-2 border hairline rounded-md bg-paper-alt text-[13px] text-ink focus:outline-none focus:border-accent transition"
            />
          </div>
          <div>
            <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1.5">
              Teléfono (opcional)
            </label>
            <input
              v-model="form.cliente_tel"
              type="text"
              placeholder="0991234567"
              class="w-full px-3 py-2 border hairline rounded-md bg-paper-alt text-[13px] text-ink focus:outline-none focus:border-accent transition"
            />
          </div>
          <div>
            <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1.5">
              Código personalizado (opcional)
            </label>
            <input
              v-model="form.codigo"
              type="text"
              placeholder="Se genera automáticamente si lo dejas vacío"
              class="w-full px-3 py-2 border hairline rounded-md bg-paper-alt text-[13px] font-mono tabular text-ink focus:outline-none focus:border-accent transition"
            />
          </div>
          <div>
            <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1.5">
              Notas (opcional)
            </label>
            <textarea
              v-model="form.notas"
              rows="2"
              placeholder="Ej. VIP, influencer, ex-empleada…"
              class="w-full px-3 py-2 border hairline rounded-md bg-paper-alt text-[13px] text-ink focus:outline-none focus:border-accent transition resize-none"
            ></textarea>
          </div>
          <div class="flex justify-end gap-2 pt-2">
            <button
              type="button"
              @click="modalVisible = false"
              class="h-9 px-3 rounded-md border hairline text-[12px] font-medium hover:bg-paper-alt transition"
            >Cancelar</button>
            <button
              type="submit"
              class="h-9 px-4 rounded-md text-[12px] font-medium hover:opacity-90 transition"
              style="background: var(--ink); color: var(--paper);"
            >Crear código</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
