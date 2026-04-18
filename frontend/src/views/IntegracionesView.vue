<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useToast } from 'vue-toastification'
import importsService, { type ImportResult, type ProductoAlias } from '../services/importsService'
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

// Mapa local de "alias pendientes" no-mapeados tras la última importación,
// pareados con el producto que el usuario elige del catálogo.
const pendientes = ref<
  { alias_externo: string; id_pedido: string; fila: number; producto_id: string | null }[]
>([])

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
    pendientes.value = result.sinMapear.map((s) => ({ ...s, producto_id: null }))

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
