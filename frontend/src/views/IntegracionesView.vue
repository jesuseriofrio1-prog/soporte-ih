<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useToast } from 'vue-toastification'
import importsService, {
  type ImportResult,
  type ProductoAlias,
  type WebhookLog,
} from '../services/importsService'
import { useTiendaStore } from '../stores/tienda'
import { useProductosStore } from '../stores/productos'

const toast = useToast()
const tiendaStore = useTiendaStore()
const productosStore = useProductosStore()

const fileInput = ref<HTMLInputElement | null>(null)
const selectedFile = ref<File | null>(null)
const uploading = ref(false)
const lastResult = ref<ImportResult | null>(null)

const aliases = ref<ProductoAlias[]>([])
const aliasesLoading = ref(false)

const webhookLogs = ref<WebhookLog[]>([])
const webhookLogsLoading = ref(false)

// Origen del dominio backend para armar la URL del webhook.
const webhookOrigin = computed(() => window.location.origin)

// Mapa local de "alias pendientes" no-mapeados tras la última importación,
// pareados con el producto que el usuario elige del catálogo. Si la IA
// sugirió algo, pre-seleccionamos esa opción para que el usuario sólo
// confirme con un click.
const pendientes = ref<
  {
    alias_externo: string
    id_pedido: string
    fila: number
    producto_id: string | null
    sugerencia?: { producto_id: string; producto_nombre: string; confianza: number }
  }[]
>([])

async function cargarWebhookLogs() {
  if (!tiendaStore.tiendaActiva) return
  webhookLogsLoading.value = true
  try {
    webhookLogs.value = await importsService.listWebhookLogs(tiendaStore.tiendaActiva.id, 30)
  } catch (err) {
    console.warn('[Integraciones] No se pudieron cargar webhook logs:', err)
  } finally {
    webhookLogsLoading.value = false
  }
}

async function cargarAliases() {
  if (!tiendaStore.tiendaActiva) return
  aliasesLoading.value = true
  try {
    aliases.value = await importsService.listAliases(tiendaStore.tiendaActiva.id)
  } catch {
    // silencioso
  } finally {
    aliasesLoading.value = false
  }
}

onMounted(async () => {
  if (productosStore.productos.length === 0) {
    await productosStore.fetchProductos(true)
  }
  cargarAliases()
  cargarWebhookLogs()
})

watch(
  () => tiendaStore.tiendaActivaId,
  () => {
    cargarAliases()
    cargarWebhookLogs()
    lastResult.value = null
    pendientes.value = []
  },
)

function onFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  selectedFile.value = target.files?.[0] ?? null
}

async function ejecutarImport() {
  if (!tiendaStore.tiendaActiva) {
    toast.warning('Selecciona una tienda primero')
    return
  }
  if (!selectedFile.value) {
    toast.warning('Selecciona un archivo Excel')
    return
  }

  uploading.value = true
  try {
    const result = await importsService.importRocketExcel(
      tiendaStore.tiendaActiva.id,
      selectedFile.value,
    )
    lastResult.value = result
    pendientes.value = result.sinMapear.map((s) => ({
      ...s,
      // Si la IA sugirió un producto con suficiente confianza, pre-seleccionamos.
      producto_id: s.sugerencia?.producto_id ?? null,
    }))

    if (result.creados > 0 || result.actualizados > 0) {
      toast.success(`Importados: ${result.creados} creados, ${result.actualizados} actualizados`)
    } else if (result.sinMapear.length > 0) {
      toast.info('No se creó nada. Mapea los productos debajo y reintenta.')
    } else {
      toast.info('No hubo cambios.')
    }
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || 'Error al importar el Excel')
  } finally {
    uploading.value = false
  }
}

async function guardarMapping(idx: number) {
  const p = pendientes.value[idx]
  if (!p.producto_id) {
    toast.warning('Selecciona un producto del catálogo primero')
    return
  }
  if (!tiendaStore.tiendaActiva) return

  try {
    await importsService.crearAlias(
      tiendaStore.tiendaActiva.id,
      p.alias_externo,
      p.producto_id,
    )
    toast.success(`Alias guardado: "${p.alias_externo}"`)
    // Remuevo de la lista de pendientes y recargo aliases
    pendientes.value.splice(idx, 1)
    cargarAliases()
  } catch (e: unknown) {
    const err = e as { response?: { data?: { message?: string } } }
    toast.error(err.response?.data?.message || 'No se pudo guardar el alias')
  }
}

async function eliminarAliasExistente(alias: ProductoAlias) {
  if (!tiendaStore.tiendaActiva) return
  try {
    await importsService.eliminarAlias(alias.id, tiendaStore.tiendaActiva.id)
    toast.success('Alias eliminado')
    cargarAliases()
  } catch {
    toast.error('No se pudo eliminar el alias')
  }
}

const totalProcesado = computed(() => {
  const r = lastResult.value
  if (!r) return 0
  return r.creados + r.actualizados + r.saltadosPorEstado + r.sinMapear.length
})
</script>

<template>
  <div class="px-8 py-8 max-w-[1100px]">
    <!-- Header página -->
    <div class="mb-8">
      <div class="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint mb-2">
        {{ [
          'Rocket Ecuador',
          lastResult?.ia?.habilitado ? 'Claude Haiku' : null,
          'Servientrega',
        ].filter(Boolean).length }} servicios conectados
      </div>
      <h1 class="h-display text-[40px] leading-none">Integraciones</h1>
    </div>

    <div class="space-y-3">
      <!-- ────────── Rocket Ecuador (import Excel) ────────── -->
      <div class="surface rounded-xl overflow-hidden">
        <div class="p-5 flex items-start gap-5">
          <div class="w-12 h-12 rounded-lg grid place-items-center shrink-0" style="background: rgba(147, 51, 234, 0.1);">
            <svg class="w-6 h-6" style="color: rgb(168, 85, 247);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M13 2l-3 7h5l-3 7-2 6 5-8h-5l3-7-3-5h3z" stroke-linejoin="round"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <h3 class="h-display text-[20px]">Rocket Ecuador</h3>
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 pill-emerald rounded text-[10px] font-semibold">
                <span class="state-dot dot-emerald"></span>Conectado
              </span>
            </div>
            <p class="text-[12px] text-ink-muted">
              Webhook + import Excel. Subir <b>Pedidos → Resumen Excel</b> es idempotente:
              el mismo archivo dos veces no duplica pedidos.
            </p>
          </div>
        </div>

        <!-- Uploader -->
        <div class="px-5 pb-5 flex flex-wrap items-center gap-3">
          <input ref="fileInput" type="file" accept=".xlsx" @change="onFileChange" class="hidden" />
          <button
            @click="fileInput?.click()"
            class="h-9 px-3 rounded-md border hairline text-[12px] font-medium hover:bg-paper-alt transition flex items-center gap-2"
          >
            <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M3 3h10v10H3z"/><path d="M6 7h4M6 10h4" stroke-linecap="round"/>
            </svg>
            Elegir archivo
          </button>
          <span class="text-[12px] text-ink-muted truncate max-w-[280px]">
            {{ selectedFile ? selectedFile.name : 'Sin archivo seleccionado' }}
          </span>
          <button
            @click="ejecutarImport"
            :disabled="uploading || !selectedFile"
            class="ml-auto h-9 px-3 rounded-md text-[12px] font-medium hover:opacity-90 transition disabled:opacity-50 flex items-center gap-2"
            style="background: var(--ink); color: var(--paper);"
          >
            <svg v-if="uploading" class="w-3.5 h-3.5 animate-spin" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M8 1.5a6.5 6.5 0 016.5 6.5" stroke-linecap="round"/>
            </svg>
            <svg v-else class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M8 2v8m-3-3l3 3 3-3M3 14h10" stroke-linecap="round"/>
            </svg>
            {{ uploading ? 'Procesando…' : 'Importar' }}
          </button>
        </div>

        <!-- Resultado -->
        <div v-if="lastResult" class="border-t hairline p-5 space-y-4">
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div class="p-3 rounded-lg" style="background: var(--emerald-bg);">
              <p class="text-[10px] font-semibold uppercase tracking-wider" style="color: var(--emerald-fg);">Creados</p>
              <p class="h-display tabular text-[22px] leading-none mt-1" style="color: var(--emerald-fg);">
                {{ lastResult.creados }}
              </p>
            </div>
            <div class="p-3 rounded-lg" style="background: var(--blue-bg);">
              <p class="text-[10px] font-semibold uppercase tracking-wider" style="color: var(--blue-fg);">Actualizados</p>
              <p class="h-display tabular text-[22px] leading-none mt-1" style="color: var(--blue-fg);">
                {{ lastResult.actualizados }}
              </p>
            </div>
            <div class="p-3 rounded-lg surface">
              <p class="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">Saltados</p>
              <p class="h-display tabular text-[22px] leading-none mt-1">
                {{ lastResult.saltadosPorEstado }}
              </p>
            </div>
            <div class="p-3 rounded-lg surface-amber" style="border: 1px solid var(--amber-dot);">
              <p class="text-[10px] font-semibold uppercase tracking-wider" style="color: var(--amber-fg);">Sin mapear</p>
              <p class="h-display tabular text-[22px] leading-none mt-1" style="color: var(--amber-fg);">
                {{ lastResult.sinMapear.length }}
              </p>
            </div>
          </div>

          <p class="text-[11px] text-ink-faint tabular font-mono">
            Total procesado {{ totalProcesado }} · filas en Excel {{ lastResult.total + lastResult.saltadosPorEstado }}
          </p>

          <!-- Stats IA -->
          <div
            v-if="lastResult.ia && lastResult.ia.llamados > 0"
            class="rounded-md p-3 text-[12px] flex flex-wrap gap-4"
            style="background: rgba(147, 51, 234, 0.08); color: rgb(126, 34, 206);"
          >
            <span class="font-semibold flex items-center gap-1">
              <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="currentColor">
                <path d="M8 1l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/>
              </svg>
              Matching por IA
            </span>
            <span>Analizados: {{ lastResult.ia.llamados }}</span>
            <span>Auto-mapeados (≥85%): {{ lastResult.ia.auto_mapeados }}</span>
            <span>Sugeridos (≥50%): {{ lastResult.ia.sugeridos }}</span>
            <span v-if="!lastResult.ia.habilitado" class="opacity-70">
              · IA deshabilitada (falta ANTHROPIC_API_KEY)
            </span>
          </div>

          <!-- Productos sin mapear -->
          <div v-if="pendientes.length > 0" class="border-t hairline pt-4">
            <h5 class="text-[10px] font-semibold uppercase tracking-[0.1em] mb-1" style="color: var(--amber-fg);">
              Productos sin mapear ({{ pendientes.length }})
            </h5>
            <p class="text-[11px] text-ink-muted mb-3">
              Elige a qué producto del catálogo corresponde cada nombre que viene de Rocket.
              Una vez guardado, se recordará para futuras importaciones.
            </p>
            <div class="space-y-2">
              <div
                v-for="(p, idx) in pendientes"
                :key="p.alias_externo + p.id_pedido"
                class="flex flex-wrap items-center gap-3 p-3 surface-amber rounded-md"
                style="border: 1px solid var(--amber-dot);"
              >
                <div class="flex-1 min-w-[200px]">
                  <div class="text-[13px] font-medium">{{ p.alias_externo }}</div>
                  <div class="text-[11px] text-ink-faint tabular font-mono">
                    Pedido #{{ p.id_pedido }} · fila {{ p.fila }}
                  </div>
                  <div
                    v-if="p.sugerencia"
                    class="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium"
                    style="background: rgba(147, 51, 234, 0.15); color: rgb(126, 34, 206);"
                    :title="`Confianza IA: ${p.sugerencia.confianza}%`"
                  >
                    <svg class="w-3 h-3" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/></svg>
                    IA sugiere: {{ p.sugerencia.producto_nombre }} ({{ p.sugerencia.confianza }}%)
                  </div>
                </div>
                <select
                  v-model="p.producto_id"
                  class="h-8 px-2 rounded-md surface text-[12px] text-ink outline-none"
                >
                  <option :value="null">— Elegir —</option>
                  <option v-for="prod in productosStore.productos" :key="prod.id" :value="prod.id">
                    {{ prod.nombre }}
                  </option>
                </select>
                <button
                  @click="guardarMapping(idx)"
                  :disabled="!p.producto_id"
                  class="h-8 px-3 rounded-md text-[11px] font-medium hover:opacity-90 transition disabled:opacity-50"
                  style="background: var(--ink); color: var(--paper);"
                >
                  Guardar
                </button>
              </div>
            </div>
          </div>

          <!-- Errores -->
          <div v-if="lastResult.erroresValidacion.length > 0" class="border-t hairline pt-4">
            <h5 class="text-[10px] font-semibold uppercase tracking-[0.1em] mb-2" style="color: var(--rose-dot);">
              Errores de validación ({{ lastResult.erroresValidacion.length }})
            </h5>
            <ul class="text-[11px] space-y-1 max-h-40 overflow-y-auto thin-scroll" style="color: var(--rose-fg);">
              <li v-for="(e, i) in lastResult.erroresValidacion" :key="i" class="tabular font-mono">
                Fila {{ e.fila }}: {{ e.mensaje }}
              </li>
            </ul>
          </div>
        </div>
      </div>

      <!-- ────────── Claude Haiku (IA matcher) ────────── -->
      <div class="surface rounded-xl overflow-hidden">
        <div class="p-5 flex items-center gap-5">
          <div class="w-12 h-12 rounded-lg grid place-items-center shrink-0" style="background: var(--amber-bg);">
            <svg class="w-6 h-6" style="color: var(--amber-fg);" viewBox="0 0 24 24" fill="currentColor">
              <path d="M5 20l5-16h4l5 16h-4l-1-4h-4l-1 4H5zm6-7h2l-1-4-1 4z"/>
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2 mb-0.5">
              <h3 class="h-display text-[20px]">Anthropic · Claude Haiku</h3>
              <span class="inline-flex items-center gap-1 px-1.5 py-0.5 pill-emerald rounded text-[10px] font-semibold">
                <span class="state-dot dot-emerald"></span>Activa
              </span>
            </div>
            <p class="text-[12px] text-ink-muted">
              Matching automático de productos al importar Excel. Auto-mapea con ≥85% de confianza.
            </p>
          </div>
        </div>
      </div>

      <!-- ────────── Webhook Rocket ────────── -->
      <div class="surface rounded-xl overflow-hidden">
        <div class="p-5">
          <div class="flex items-start gap-5">
            <div class="w-12 h-12 rounded-lg grid place-items-center shrink-0" style="background: rgba(147, 51, 234, 0.1);">
              <svg class="w-6 h-6" style="color: rgb(168, 85, 247);" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M13 2l-3 7h5l-3 7-2 6 5-8h-5l3-7-3-5h3z" stroke-linejoin="round"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 mb-0.5">
                <h3 class="h-display text-[20px]">Webhook de cambios de estado</h3>
                <span class="inline-flex items-center gap-1 px-1.5 py-0.5 pill-emerald rounded text-[10px] font-semibold">
                  <span class="state-dot dot-emerald"></span>Activo
                </span>
              </div>
              <p class="text-[12px] text-ink-muted">
                Rocket notifica los cambios en tiempo real. Copia la URL y pégala en la configuración de webhooks de Rocket.
              </p>
            </div>
          </div>

          <div class="mt-5 p-3 rounded-md font-mono text-[11px] tabular break-all" style="background: var(--paper-alt); border: 1px solid var(--line);">
            {{ webhookOrigin }}/api/webhooks/rocket/&lt;ROCKET_WEBHOOK_SECRET&gt;
          </div>
          <p class="text-[11px] text-ink-faint mt-2">
            Reemplaza el placeholder por el secreto configurado en variables de entorno del backend.
            Requests con secreto inválido → 403.
          </p>

          <!-- Logs -->
          <div class="mt-5 border-t hairline pt-4">
            <div class="flex items-center justify-between mb-3">
              <h5 class="text-[10px] font-semibold uppercase tracking-[0.1em] text-ink-faint">
                Últimos eventos recibidos
              </h5>
              <button
                @click="cargarWebhookLogs"
                class="text-[11px] font-medium hover:underline disabled:opacity-50"
                style="color: var(--accent);"
                :disabled="webhookLogsLoading"
              >
                {{ webhookLogsLoading ? 'Cargando…' : 'Refrescar' }}
              </button>
            </div>
            <div v-if="webhookLogs.length === 0 && !webhookLogsLoading" class="text-center py-6 text-[12px] text-ink-faint">
              Aún no se ha recibido ningún evento.
            </div>
            <div v-else class="space-y-1.5 max-h-72 overflow-y-auto thin-scroll">
              <div
                v-for="log in webhookLogs"
                :key="log.id"
                class="flex flex-wrap items-center gap-2 text-[11px] p-2 rounded-md"
                :class="{
                  'pill-emerald': log.status === 'ok',
                  'pill-amber': log.status === 'pedido_no_encontrado' || log.status === 'estado_no_reconocido' || log.status === 'ignorado',
                  'pill-rose': log.status === 'error',
                }"
              >
                <span class="font-mono tabular opacity-70">
                  {{ new Date(log.created_at).toLocaleString('es-EC') }}
                </span>
                <span class="font-semibold">#{{ log.external_order_id ?? '—' }}</span>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase" style="background: rgba(0, 0, 0, 0.08);">
                  {{ log.status }}
                </span>
                <span v-if="log.error_mensaje" class="flex-1 min-w-[200px] opacity-80">
                  {{ log.error_mensaje }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ────────── Aliases guardados ────────── -->
      <div class="surface rounded-xl overflow-hidden">
        <div class="p-5">
          <div class="flex items-center justify-between mb-3">
            <h3 class="h-display text-[20px]">Alias de productos</h3>
            <span class="text-[11px] text-ink-faint tabular font-mono">{{ aliases.length }} guardados</span>
          </div>
          <div v-if="aliasesLoading" class="text-center py-8">
            <div class="inline-block w-4 h-4 border-2 rounded-full animate-spin" style="border-color: var(--line); border-top-color: var(--accent);"></div>
          </div>
          <div v-else-if="aliases.length === 0" class="text-[12px] text-ink-muted text-center py-6">
            Aún no hay alias guardados. Se crean al mapear productos tras una importación.
          </div>
          <table v-else class="w-full text-[13px]">
            <thead>
              <tr class="text-[10px] uppercase tracking-[0.1em] text-ink-faint font-semibold border-b hairline" style="background: var(--paper-alt);">
                <th class="px-3 py-2 text-left">Nombre en Rocket</th>
                <th class="px-3 py-2 text-left">Producto local</th>
                <th class="px-3 py-2 text-right w-20"></th>
              </tr>
            </thead>
            <tbody class="divide-y hairline">
              <tr v-for="a in aliases" :key="a.id" class="hover:bg-paper-alt transition row-parent">
                <td class="px-3 py-2">{{ a.alias_externo }}</td>
                <td class="px-3 py-2 text-ink-muted">{{ a.productos?.nombre ?? '—' }}</td>
                <td class="px-3 py-2 text-right">
                  <button
                    @click="eliminarAliasExistente(a)"
                    class="row-actions text-[11px] hover:underline"
                    style="color: var(--rose-dot);"
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>
