<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import Swal from 'sweetalert2'
import Dialog from 'primevue/dialog'
import { useProductosStore } from '../stores/productos'
import { useTiendaStore } from '../stores/tienda'
import type { Producto } from '../services/productosService'

const toast = useToast()
const store = useProductosStore()
const tiendaStore = useTiendaStore()

function linkPublico(producto: Producto): string {
  const slug = tiendaStore.tiendaActiva?.slug
  if (!slug) return ''
  return `${window.location.origin}/p/${slug}/${producto.slug}`
}

async function copiarLinkPublico(producto: Producto) {
  const link = linkPublico(producto)
  if (!link) {
    toast.warning('La tienda no tiene slug configurado')
    return
  }
  try {
    await navigator.clipboard.writeText(link)
    toast.success('Link de pedido copiado')
  } catch {
    toast.error('No se pudo copiar')
  }
}

// Modal
const modalVisible = ref(false)
const editando = ref(false)
const productoEditId = ref<string | null>(null)

// Formulario
const form = ref({
  nombre: '',
  slug: '',
  precio: 0,
  stock: 0,
  icono: '',
  // Unit economics: 0 se interpreta como "no configurado" al guardar
  costo_unitario: 0,
  fee_envio: 0,
  // Bundle cosmético: es_bundle=false ignora bundle_upgrade_desde
  es_bundle: false,
  bundle_upgrade_desde: '' as string,
})

const formErrors = ref<Record<string, string>>({})

// Productos disponibles como base para un bundle (excluye el que se edita
// y los que ya son bundle — no queremos bundle-of-bundle).
const productosBase = computed(() =>
  store.productos.filter((p) =>
    !p.es_bundle && p.activo && p.id !== productoEditId.value,
  ),
)

function abrirModalCrear() {
  editando.value = false
  productoEditId.value = null
  form.value = {
    nombre: '', slug: '', precio: 0, stock: 0, icono: '',
    costo_unitario: 0, fee_envio: 0,
    es_bundle: false, bundle_upgrade_desde: '',
  }
  formErrors.value = {}
  modalVisible.value = true
}

function abrirModalEditar(producto: Producto) {
  editando.value = true
  productoEditId.value = producto.id
  form.value = {
    nombre: producto.nombre,
    slug: producto.slug,
    precio: producto.precio,
    stock: producto.stock,
    icono: producto.icono || '',
    costo_unitario: producto.costo_unitario ?? 0,
    fee_envio: producto.fee_envio ?? 0,
    es_bundle: producto.es_bundle,
    bundle_upgrade_desde: producto.bundle_upgrade_desde ?? '',
  }
  formErrors.value = {}
  modalVisible.value = true
}

function validarForm(): boolean {
  formErrors.value = {}

  if (!form.value.nombre.trim()) {
    formErrors.value.nombre = 'El nombre es requerido'
  }
  if (!form.value.slug.trim()) {
    formErrors.value.slug = 'El slug es requerido'
  } else if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.value.slug)) {
    formErrors.value.slug = 'Solo minúsculas, números y guiones (ej: serum-hidra)'
  }
  if (form.value.precio <= 0) {
    formErrors.value.precio = 'El precio debe ser mayor a 0'
  }
  if (form.value.stock < 0) {
    formErrors.value.stock = 'El stock no puede ser negativo'
  }

  return Object.keys(formErrors.value).length === 0
}

async function guardar() {
  if (!validarForm()) return

  // 0 = "no configurado"; enviamos undefined para que el backend lo
  // deje null y no se vea como $0.00 en el dashboard de economics.
  const costoPayload = form.value.costo_unitario > 0 ? form.value.costo_unitario : undefined
  const feePayload = form.value.fee_envio > 0 ? form.value.fee_envio : undefined

  // Bundle: si no está marcado, desvincular el base (null). Si está
  // marcado pero no eligió base, enviamos undefined (mantiene valor previo).
  const upgradePayload: string | null | undefined = form.value.es_bundle
    ? (form.value.bundle_upgrade_desde || undefined)
    : null

  try {
    if (editando.value && productoEditId.value) {
      await store.editarProducto(productoEditId.value, {
        nombre: form.value.nombre,
        precio: form.value.precio,
        stock: form.value.stock,
        icono: form.value.icono || undefined,
        costo_unitario: costoPayload,
        fee_envio: feePayload,
        es_bundle: form.value.es_bundle,
        bundle_upgrade_desde: upgradePayload,
      })
      toast.success('Producto actualizado')
    } else {
      await store.crearProducto({
        nombre: form.value.nombre,
        slug: form.value.slug,
        precio: form.value.precio,
        stock: form.value.stock,
        icono: form.value.icono || undefined,
        costo_unitario: costoPayload,
        fee_envio: feePayload,
        es_bundle: form.value.es_bundle,
        bundle_upgrade_desde: form.value.es_bundle ? (form.value.bundle_upgrade_desde || undefined) : undefined,
      })
      toast.success('Producto creado')
    }
    modalVisible.value = false
  } catch (e: any) {
    const msg = e.response?.data?.message || 'Error al guardar'
    toast.error(msg)
  }
}

async function eliminar(producto: Producto) {
  const result = await Swal.fire({
    title: '¿Eliminar producto?',
    text: `"${producto.nombre}" se marcará como inactivo.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#EF4444',
    cancelButtonColor: '#C8C8E9',
    confirmButtonText: 'Sí, eliminar',
    cancelButtonText: 'Cancelar',
  })

  if (result.isConfirmed) {
    try {
      await store.eliminarProducto(producto.id)
      toast.success('Producto eliminado')
    } catch {
      toast.error('Error al eliminar producto')
    }
  }
}

onMounted(() => {
  store.fetchProductos(true)
})
</script>

<template>
  <div class="px-8 py-8">
    <!-- Header -->
    <div class="flex items-end justify-between mb-6 flex-wrap gap-4">
      <div>
        <div class="text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-faint mb-2">
          {{ store.productos.length }} productos · {{ store.productos.reduce((a, p) => a + p.stock, 0).toLocaleString() }} unidades en stock
        </div>
        <h1 class="h-display text-[40px] leading-none">Catálogo</h1>
      </div>
      <div class="flex items-center gap-2">
        <button
          @click="abrirModalCrear"
          class="h-9 px-3 rounded-md text-[12px] font-medium hover:opacity-90 transition flex items-center gap-2"
          style="background: var(--ink); color: var(--paper);"
        >
          <svg class="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M8 3v10M3 8h10" stroke-linecap="round"/>
          </svg>
          Añadir producto
        </button>
      </div>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="surface rounded-xl p-16 text-center">
      <div class="inline-block w-5 h-5 border-2 rounded-full animate-spin" style="border-color: var(--line); border-top-color: var(--accent);"></div>
      <p class="text-[13px] text-ink-muted mt-3">Cargando productos…</p>
    </div>

    <!-- Empty -->
    <div v-else-if="store.productos.length === 0" class="surface empty-pattern rounded-xl py-16 text-center">
      <p class="text-[13px] text-ink-muted">No hay productos activos</p>
    </div>

    <!-- Grid de productos -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      <div
        v-for="producto in store.productos"
        :key="producto.id"
        class="surface rounded-xl overflow-hidden group hover:shadow-md transition cursor-pointer"
        @click="abrirModalEditar(producto)"
      >
        <!-- Imagen placeholder con gradiente rose -->
        <div
          class="aspect-[4/3] relative overflow-hidden"
          style="background: linear-gradient(135deg, var(--rose-bg), var(--accent-soft));"
        >
          <div class="absolute inset-0 grid place-items-center opacity-50">
            <i
              v-if="producto.icono"
              :class="producto.icono"
              class="text-6xl"
              style="color: var(--accent);"
            ></i>
            <svg v-else class="w-24 h-24" style="color: var(--accent);" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="1">
              <circle cx="50" cy="50" r="30"/>
              <circle cx="50" cy="50" r="15"/>
            </svg>
          </div>
          <!-- Badge SKU -->
          <div
            class="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono tabular text-ink-muted"
            style="background: var(--paper-elev);"
          >
            SKU: {{ producto.slug }}
          </div>
        </div>

        <!-- Contenido -->
        <div class="p-5">
          <div class="flex items-start justify-between mb-3 gap-3">
            <h3 class="h-display text-[20px] leading-tight truncate">{{ producto.nombre }}</h3>
            <div class="text-right shrink-0">
              <div class="h-display text-[22px] tabular leading-none">
                ${{ Math.floor(producto.precio) }}.<span class="text-[14px]">{{ String(Number(producto.precio).toFixed(2)).split('.')[1] }}</span>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 mb-4 text-[12px]">
            <div>
              <div class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">Stock</div>
              <div class="flex items-baseline gap-1">
                <span class="h-display tabular text-[18px]">{{ producto.stock.toLocaleString() }}</span>
                <span class="text-[10px] text-ink-faint">u.</span>
              </div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wider text-ink-faint font-semibold mb-1">Estado</div>
              <div class="flex items-baseline gap-1">
                <span
                  class="inline-flex items-center gap-1 text-[11px] font-medium"
                  :class="producto.activo ? 'pill-emerald' : 'pill-rose'"
                  style="padding: 2px 6px; border-radius: 4px;"
                >
                  <span class="state-dot" :class="producto.activo ? 'dot-emerald' : 'dot-rose'"></span>
                  {{ producto.activo ? 'Activo' : 'Inactivo' }}
                </span>
              </div>
            </div>
          </div>

          <div class="flex items-center gap-2">
            <button
              @click.stop="copiarLinkPublico(producto)"
              class="flex-1 h-8 rounded-md border hairline text-[11px] font-medium hover:bg-paper-alt transition"
            >
              Copiar link
            </button>
            <button
              @click.stop="abrirModalEditar(producto)"
              class="flex-1 h-8 rounded-md border hairline text-[11px] font-medium hover:bg-paper-alt transition"
            >
              Editar
            </button>
            <button
              @click.stop="eliminar(producto)"
              class="h-8 w-8 rounded-md border hairline grid place-items-center hover:bg-paper-alt transition"
              title="Eliminar"
            >
              <svg class="w-3.5 h-3.5" style="color: var(--rose-dot);" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M3 4h10M6 4V3a1 1 0 011-1h2a1 1 0 011 1v1m-5 0v9a1 1 0 001 1h4a1 1 0 001-1V4" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal crear/editar -->
    <Dialog
      v-model:visible="modalVisible"
      :header="editando ? 'Editar Producto' : 'Nuevo Producto'"
      modal
      :style="{ width: '450px' }"
      :pt="{
        root: { class: 'border border-lavanda-medio rounded-xl' },
        header: { class: 'bg-navy text-white rounded-t-xl p-4' },
        title: { class: 'font-bold text-lg' },
        content: { class: 'p-6' },
        headerActions: { class: 'text-white' },
      }"
    >
      <form @submit.prevent="guardar" class="space-y-4">
        <!-- Nombre -->
        <div>
          <label class="block text-sm font-bold text-navy mb-1">Nombre</label>
          <input
            v-model="form.nombre"
            type="text"
            placeholder="Sérum Hidratante"
            class="w-full px-4 py-2 border rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition"
            :class="formErrors.nombre ? 'border-alerta' : 'border-lavanda-medio'"
          />
          <p v-if="formErrors.nombre" class="text-xs text-alerta mt-1">{{ formErrors.nombre }}</p>
        </div>

        <!-- Slug -->
        <div>
          <label class="block text-sm font-bold text-navy mb-1">Slug</label>
          <input
            v-model="form.slug"
            type="text"
            placeholder="serum-hidra"
            :disabled="editando"
            class="w-full px-4 py-2 border rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition disabled:opacity-50 disabled:cursor-not-allowed"
            :class="formErrors.slug ? 'border-alerta' : 'border-lavanda-medio'"
          />
          <p v-if="formErrors.slug" class="text-xs text-alerta mt-1">{{ formErrors.slug }}</p>
        </div>

        <!-- Precio y Stock -->
        <div class="grid grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-bold text-navy mb-1">Precio ($)</label>
            <input
              v-model.number="form.precio"
              type="number"
              step="0.01"
              min="0"
              class="w-full px-4 py-2 border rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition"
              :class="formErrors.precio ? 'border-alerta' : 'border-lavanda-medio'"
            />
            <p v-if="formErrors.precio" class="text-xs text-alerta mt-1">{{ formErrors.precio }}</p>
          </div>
          <div>
            <label class="block text-sm font-bold text-navy mb-1">Stock</label>
            <input
              v-model.number="form.stock"
              type="number"
              min="0"
              class="w-full px-4 py-2 border rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition"
              :class="formErrors.stock ? 'border-alerta' : 'border-lavanda-medio'"
            />
            <p v-if="formErrors.stock" class="text-xs text-alerta mt-1">{{ formErrors.stock }}</p>
          </div>
        </div>

        <!-- Unit economics -->
        <div class="pt-2 border-t hairline">
          <div class="flex items-center justify-between mb-2">
            <label class="block text-[10px] uppercase tracking-wider text-ink-faint font-semibold">
              Unit economics (opcional)
            </label>
            <span class="text-[10px] text-ink-faint">Usado para calcular margen en /economics</span>
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-[11px] font-medium text-ink-muted mb-1">Costo unitario ($)</label>
              <input
                v-model.number="form.costo_unitario"
                type="number"
                step="0.01"
                min="0"
                placeholder="6.80"
                class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-[13px] focus:outline-none focus:border-mauve transition"
              />
            </div>
            <div>
              <label class="block text-[11px] font-medium text-ink-muted mb-1">Fee Rocket ($/unidad)</label>
              <input
                v-model.number="form.fee_envio"
                type="number"
                step="0.01"
                min="0"
                placeholder="4.50"
                class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-[13px] focus:outline-none focus:border-mauve transition"
              />
            </div>
          </div>
          <p v-if="form.precio > 0 && form.costo_unitario > 0" class="text-[11px] text-ink-faint mt-2">
            Margen neto:
            <span
              class="font-mono tabular font-medium"
              :style="(form.precio - form.costo_unitario - form.fee_envio) / form.precio < 0.1
                ? { color: 'var(--rose-dot)' }
                : { color: 'var(--emerald-dot)' }"
            >
              ${{ (form.precio - form.costo_unitario - form.fee_envio).toFixed(2) }}
              ({{ (((form.precio - form.costo_unitario - form.fee_envio) / form.precio) * 100).toFixed(1) }}%)
            </span>
          </p>
        </div>

        <!-- Bundle upgrade -->
        <div class="pt-2 border-t hairline">
          <label class="flex items-center gap-2 cursor-pointer">
            <input v-model="form.es_bundle" type="checkbox" class="rounded" />
            <span class="text-[12px] font-medium">Este producto es un bundle (upgrade)</span>
          </label>
          <p class="text-[11px] text-ink-faint mt-1">
            Cuando el cliente elige el producto base en el formulario público, se le sugiere este bundle.
          </p>
          <div v-if="form.es_bundle" class="mt-3">
            <label class="block text-[11px] font-medium text-ink-muted mb-1">
              Se sugiere cuando el cliente elige:
            </label>
            <select
              v-model="form.bundle_upgrade_desde"
              class="w-full px-3 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy text-[13px] focus:outline-none focus:border-mauve transition"
            >
              <option value="">— Elegir producto base —</option>
              <option v-for="p in productosBase" :key="p.id" :value="p.id">
                {{ p.nombre }} (${{ Number(p.precio).toFixed(2) }})
              </option>
            </select>
            <p v-if="productosBase.length === 0" class="text-[11px] mt-1" style="color: var(--amber-fg);">
              No hay productos base disponibles (todos son bundles o están inactivos).
            </p>
          </div>
        </div>

        <!-- Icono -->
        <div>
          <label class="block text-sm font-bold text-navy mb-1">Icono (clase CSS)</label>
          <input
            v-model="form.icono"
            type="text"
            placeholder="fas fa-tint"
            class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition"
          />
          <p class="text-[11px] text-ink-faint mt-1">Opcional. Emoji o clase CSS (ej: 💧, fas fa-tint).</p>
        </div>

        <!-- Botones -->
        <div class="flex justify-end gap-3 pt-2">
          <button
            type="button"
            @click="modalVisible = false"
            class="px-4 py-2 rounded-lg font-bold border border-lavanda-medio text-navy hover:bg-lavanda transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="px-6 py-2 rounded-lg font-bold bg-mauve text-white hover:opacity-90 transition shadow-sm"
          >
            {{ editando ? 'Guardar Cambios' : 'Crear Producto' }}
          </button>
        </div>
      </form>
    </Dialog>
  </div>
</template>
