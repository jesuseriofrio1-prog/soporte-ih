<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useToast } from 'vue-toastification'
import Swal from 'sweetalert2'
import Dialog from 'primevue/dialog'
import { useProductosStore } from '../stores/productos'
import type { Producto } from '../services/productosService'

const toast = useToast()
const store = useProductosStore()

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
})

const formErrors = ref<Record<string, string>>({})

function abrirModalCrear() {
  editando.value = false
  productoEditId.value = null
  form.value = { nombre: '', slug: '', precio: 0, stock: 0, icono: '' }
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

  try {
    if (editando.value && productoEditId.value) {
      await store.editarProducto(productoEditId.value, {
        nombre: form.value.nombre,
        precio: form.value.precio,
        stock: form.value.stock,
        icono: form.value.icono || undefined,
      })
      toast.success('Producto actualizado')
    } else {
      await store.crearProducto({
        nombre: form.value.nombre,
        slug: form.value.slug,
        precio: form.value.precio,
        stock: form.value.stock,
        icono: form.value.icono || undefined,
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
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex justify-between items-center bg-white p-4 rounded-xl shadow-sm border border-lavanda-medio">
      <h3 class="text-xl font-bold text-navy">Inventario</h3>
      <button
        @click="abrirModalCrear"
        class="bg-mauve text-white px-4 py-2 rounded-lg font-bold hover:bg-navy transition flex items-center gap-2 shadow-sm"
      >
        <i class="pi pi-plus"></i> Añadir Producto
      </button>
    </div>

    <!-- Loading -->
    <div v-if="store.loading" class="text-center py-12">
      <i class="pi pi-spin pi-spinner text-4xl text-mauve"></i>
      <p class="text-navy/60 mt-2">Cargando productos...</p>
    </div>

    <!-- Grid de productos -->
    <div v-else class="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-4 gap-6">
      <div
        v-for="producto in store.productos"
        :key="producto.id"
        class="bg-white p-5 rounded-xl border border-lavanda-medio shadow-sm flex flex-col items-center text-center cursor-pointer hover:shadow-md transition group"
        @click="abrirModalEditar(producto)"
      >
        <!-- Icono -->
        <div class="w-20 h-20 bg-lavanda rounded-full flex items-center justify-center text-mauve text-3xl mb-4 border-2 border-white shadow-inner">
          <i :class="producto.icono || 'pi pi-box'"></i>
        </div>

        <!-- Info -->
        <p class="font-bold text-navy text-lg mb-1">{{ producto.nombre }}</p>
        <p class="text-sm text-navy/50 font-medium mb-3">{{ producto.slug }}</p>

        <!-- Divider + datos -->
        <div class="w-full flex justify-between border-t border-lavanda pt-3">
          <span class="text-sm font-bold text-mauve">Stock: {{ producto.stock }}</span>
          <span class="text-sm font-bold text-navy">${{ producto.precio.toFixed(2) }}</span>
        </div>

        <!-- Botón eliminar -->
        <button
          @click.stop="eliminar(producto)"
          class="mt-3 text-xs text-alerta/60 hover:text-alerta font-medium opacity-0 group-hover:opacity-100 transition"
        >
          <i class="pi pi-trash"></i> Eliminar
        </button>
      </div>
    </div>

    <!-- Vacío -->
    <div v-if="!store.loading && store.productos.length === 0" class="text-center py-12">
      <i class="pi pi-box text-5xl text-lavanda-medio"></i>
      <p class="text-navy/60 mt-3">No hay productos activos</p>
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

        <!-- Icono -->
        <div>
          <label class="block text-sm font-bold text-navy mb-1">Icono (clase CSS)</label>
          <input
            v-model="form.icono"
            type="text"
            placeholder="fas fa-tint"
            class="w-full px-4 py-2 border border-lavanda-medio rounded-lg bg-lavanda/30 text-navy focus:outline-none focus:border-mauve transition"
          />
          <p class="text-xs text-navy/40 mt-1">Clase FontAwesome o PrimeIcon (ej: fas fa-tint, pi pi-box)</p>
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
