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
  webhookLogsLoading.value = true
  try {
    webhookLogs.value = await importsService.listWebhookLogs(30)
  } catch {
    // silencioso
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
  try {
    await importsService.eliminarAlias(alias.id)
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
  <div class="space-y-6">
    <!-- Encabezado -->
    <div class="bg-white p-6 rounded-xl shadow-sm border border-lavanda-medio">
      <div class="flex items-start gap-3">
        <div class="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center shrink-0">
          <i class="pi pi-sync text-orange-600 text-xl" aria-hidden="true"></i>
        </div>
        <div class="flex-1">
          <h3 class="text-lg font-bold text-navy">Rocket Ecuador</h3>
          <p class="text-sm text-navy/60 mt-1">
            Importa los pedidos desde Rocket subiendo el archivo de <b>Pedidos → Resumen Excel</b>.
            La importación es idempotente: subir el mismo archivo dos veces no duplica pedidos.
          </p>
        </div>
      </div>

      <!-- Uploader -->
      <div class="mt-5 flex flex-wrap items-center gap-3">
        <input
          ref="fileInput"
          type="file"
          accept=".xlsx"
          @change="onFileChange"
          class="hidden"
        />
        <button
          @click="fileInput?.click()"
          class="px-4 py-2 bg-lavanda/50 border border-lavanda-medio rounded-lg text-sm font-medium text-navy hover:bg-lavanda transition"
        >
          <i class="pi pi-file-excel mr-2" aria-hidden="true"></i>
          Elegir archivo
        </button>
        <span class="text-sm text-navy/70 truncate max-w-[300px]">
          {{ selectedFile ? selectedFile.name : 'Sin archivo seleccionado' }}
        </span>
        <button
          @click="ejecutarImport"
          :disabled="uploading || !selectedFile"
          class="ml-auto px-5 py-2 bg-mauve text-white rounded-lg text-sm font-bold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          <i :class="uploading ? 'pi pi-spin pi-spinner' : 'pi pi-upload'" aria-hidden="true"></i>
          {{ uploading ? 'Procesando...' : 'Importar' }}
        </button>
      </div>
    </div>

    <!-- Resultado de la última importación -->
    <div v-if="lastResult" class="bg-white p-6 rounded-xl shadow-sm border border-lavanda-medio space-y-4">
      <h4 class="text-base font-bold text-navy">Resultado de la importación</h4>

      <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="bg-green-50 border border-green-200 p-3 rounded-lg">
          <p class="text-xs font-bold uppercase text-green-700">Creados</p>
          <p class="text-2xl font-black text-green-800">{{ lastResult.creados }}</p>
        </div>
        <div class="bg-blue-50 border border-blue-200 p-3 rounded-lg">
          <p class="text-xs font-bold uppercase text-blue-700">Actualizados</p>
          <p class="text-2xl font-black text-blue-800">{{ lastResult.actualizados }}</p>
        </div>
        <div class="bg-gray-50 border border-lavanda-medio p-3 rounded-lg">
          <p class="text-xs font-bold uppercase text-navy/60">Saltados (estado)</p>
          <p class="text-2xl font-black text-navy">{{ lastResult.saltadosPorEstado }}</p>
        </div>
        <div class="bg-orange-50 border border-orange-200 p-3 rounded-lg">
          <p class="text-xs font-bold uppercase text-orange-700">Sin mapear</p>
          <p class="text-2xl font-black text-orange-800">{{ lastResult.sinMapear.length }}</p>
        </div>
      </div>

      <p class="text-xs text-navy/50">
        Total procesado: {{ totalProcesado }} &middot; Filas en Excel: {{ lastResult.total + lastResult.saltadosPorEstado }}
      </p>

      <!-- Stats IA -->
      <div
        v-if="lastResult.ia && lastResult.ia.llamados > 0"
        class="bg-purple-50 border border-purple-200 rounded-lg p-3 text-xs text-purple-900 flex flex-wrap gap-4"
      >
        <span>
          <i class="pi pi-sparkles mr-1" aria-hidden="true"></i>
          <b>Matching por IA</b>
        </span>
        <span>Analizados: {{ lastResult.ia.llamados }}</span>
        <span>Auto-mapeados (≥85%): {{ lastResult.ia.auto_mapeados }}</span>
        <span>Sugeridos (≥50%): {{ lastResult.ia.sugeridos }}</span>
        <span v-if="!lastResult.ia.habilitado" class="text-purple-600/70">
          · IA deshabilitada (falta ANTHROPIC_API_KEY)
        </span>
      </div>

      <!-- Productos sin mapear: UI para asignar producto local -->
      <div v-if="pendientes.length > 0" class="border-t border-lavanda-medio pt-4">
        <h5 class="text-sm font-bold text-navy mb-2">
          <i class="pi pi-exclamation-triangle text-orange-500 mr-1" aria-hidden="true"></i>
          Productos sin mapear ({{ pendientes.length }})
        </h5>
        <p class="text-xs text-navy/60 mb-3">
          Elige a qué producto del catálogo corresponde cada nombre que viene de Rocket.
          Una vez guardado, se recordará para futuras importaciones.
        </p>

        <div class="space-y-2">
          <div
            v-for="(p, idx) in pendientes"
            :key="p.alias_externo + p.id_pedido"
            class="flex flex-wrap items-center gap-3 p-3 bg-orange-50/40 border border-orange-200 rounded-lg"
          >
            <div class="flex-1 min-w-[200px]">
              <div class="text-sm font-bold text-navy">{{ p.alias_externo }}</div>
              <div class="text-xs text-navy/50">
                Pedido Rocket #{{ p.id_pedido }} · fila {{ p.fila }}
              </div>
              <div
                v-if="p.sugerencia"
                class="mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium bg-purple-100 text-purple-800"
                :title="`Confianza IA: ${p.sugerencia.confianza}%`"
              >
                <i class="pi pi-sparkles" aria-hidden="true"></i>
                IA sugiere: {{ p.sugerencia.producto_nombre }} ({{ p.sugerencia.confianza }}%)
              </div>
            </div>
            <select
              v-model="p.producto_id"
              class="px-3 py-1.5 text-sm bg-white border border-lavanda-medio rounded-lg text-navy"
            >
              <option :value="null">— Elegir producto —</option>
              <option v-for="prod in productosStore.productos" :key="prod.id" :value="prod.id">
                {{ prod.nombre }}
              </option>
            </select>
            <button
              @click="guardarMapping(idx)"
              :disabled="!p.producto_id"
              class="px-3 py-1.5 text-sm bg-mauve text-white rounded-lg font-bold hover:opacity-90 transition disabled:opacity-50"
            >
              Guardar mapping
            </button>
          </div>
        </div>

        <p class="text-xs text-navy/60 mt-3">
          💡 Cuando hayas mapeado todos, vuelve a subir el mismo Excel: los pedidos pendientes se crearán.
        </p>
      </div>

      <!-- Errores de validación -->
      <div v-if="lastResult.erroresValidacion.length > 0" class="border-t border-lavanda-medio pt-4">
        <h5 class="text-sm font-bold text-red-700 mb-2">
          Errores de validación ({{ lastResult.erroresValidacion.length }})
        </h5>
        <ul class="text-xs text-red-700 space-y-1 max-h-48 overflow-y-auto">
          <li v-for="(e, i) in lastResult.erroresValidacion" :key="i">
            Fila {{ e.fila }}: {{ e.mensaje }}
          </li>
        </ul>
      </div>
    </div>

    <!-- Webhook de Rocket -->
    <div class="bg-white p-6 rounded-xl shadow-sm border border-lavanda-medio">
      <div class="flex items-start gap-3 mb-3">
        <div class="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center shrink-0">
          <i class="pi pi-bolt text-purple-600 text-xl" aria-hidden="true"></i>
        </div>
        <div class="flex-1">
          <h4 class="text-base font-bold text-navy">Webhook de cambios de estado</h4>
          <p class="text-sm text-navy/60 mt-1">
            Rocket puede avisarnos cuando un pedido cambia de estado sin que subas un Excel.
            Copia la URL debajo y pégala en la configuración de webhooks de Rocket.
          </p>
        </div>
      </div>

      <div class="bg-lavanda/40 border border-lavanda-medio rounded-lg p-3 font-mono text-xs text-navy break-all">
        {{ webhookOrigin }}/api/webhooks/rocket/&lt;ROCKET_WEBHOOK_SECRET&gt;
      </div>
      <p class="text-xs text-navy/50 mt-2">
        Reemplaza <code>&lt;ROCKET_WEBHOOK_SECRET&gt;</code> por el secreto configurado en las
        variables de entorno del backend. Solicitudes con secreto inválido se rechazan con 403.
      </p>

      <!-- Últimos eventos -->
      <div class="mt-5">
        <div class="flex items-center justify-between mb-2">
          <h5 class="text-sm font-bold text-navy">Últimos eventos recibidos</h5>
          <button
            @click="cargarWebhookLogs"
            class="text-xs text-mauve hover:underline"
            :disabled="webhookLogsLoading"
          >
            <i :class="webhookLogsLoading ? 'pi pi-spin pi-spinner' : 'pi pi-refresh'" aria-hidden="true"></i>
            Refrescar
          </button>
        </div>
        <div v-if="webhookLogsLoading && webhookLogs.length === 0" class="text-center py-6">
          <i class="pi pi-spin pi-spinner text-xl text-mauve" aria-hidden="true"></i>
        </div>
        <div v-else-if="webhookLogs.length === 0" class="text-sm text-navy/50 text-center py-4">
          Aún no se ha recibido ningún evento. Configura el webhook en Rocket para empezar.
        </div>
        <div v-else class="space-y-1.5 max-h-72 overflow-y-auto">
          <div
            v-for="log in webhookLogs"
            :key="log.id"
            class="flex flex-wrap items-center gap-2 text-xs p-2 rounded border"
            :class="{
              'bg-green-50 border-green-200': log.status === 'ok',
              'bg-orange-50 border-orange-200': log.status === 'pedido_no_encontrado' || log.status === 'estado_no_reconocido' || log.status === 'ignorado',
              'bg-red-50 border-red-200': log.status === 'error',
            }"
          >
            <span class="font-mono text-navy/60">
              {{ new Date(log.created_at).toLocaleString('es-EC') }}
            </span>
            <span class="font-bold text-navy">#{{ log.external_order_id ?? '—' }}</span>
            <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase"
              :class="{
                'bg-green-200 text-green-900': log.status === 'ok',
                'bg-orange-200 text-orange-900': log.status !== 'ok' && log.status !== 'error',
                'bg-red-200 text-red-900': log.status === 'error',
              }"
            >
              {{ log.status }}
            </span>
            <span v-if="log.error_mensaje" class="text-red-700 flex-1 min-w-[200px]">
              {{ log.error_mensaje }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Aliases guardados -->
    <div class="bg-white p-6 rounded-xl shadow-sm border border-lavanda-medio">
      <div class="flex items-center justify-between mb-3">
        <h4 class="text-base font-bold text-navy">Mappings de productos guardados</h4>
        <span class="text-xs text-navy/60">{{ aliases.length }} activos</span>
      </div>
      <div v-if="aliasesLoading" class="text-center py-8">
        <i class="pi pi-spin pi-spinner text-2xl text-mauve" aria-hidden="true"></i>
      </div>
      <div v-else-if="aliases.length === 0" class="text-sm text-navy/50 text-center py-4">
        Aún no hay mappings guardados. Se crean automáticamente cuando mapeas productos tras una importación.
      </div>
      <table v-else class="w-full text-sm">
        <thead class="bg-lavanda/40 text-navy">
          <tr class="text-left">
            <th class="px-3 py-2 font-bold">Nombre en Rocket</th>
            <th class="px-3 py-2 font-bold">Producto local</th>
            <th class="px-3 py-2 font-bold text-right">Acción</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="a in aliases"
            :key="a.id"
            class="border-t border-lavanda-medio hover:bg-lavanda/20 transition"
          >
            <td class="px-3 py-2 text-navy">{{ a.alias_externo }}</td>
            <td class="px-3 py-2 text-navy/80">{{ a.productos?.nombre ?? '—' }}</td>
            <td class="px-3 py-2 text-right">
              <button
                @click="eliminarAliasExistente(a)"
                class="text-xs text-red-600 hover:underline"
              >
                Eliminar
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
