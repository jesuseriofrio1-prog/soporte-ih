import { defineStore } from 'pinia'
import { ref } from 'vue'
import productosService, {
  type Producto,
  type CreateProductoPayload,
  type UpdateProductoPayload,
} from '../services/productosService'

export const useProductosStore = defineStore('productos', () => {
  const productos = ref<Producto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchProductos(activo?: boolean) {
    loading.value = true
    error.value = null
    try {
      productos.value = await productosService.getAll(activo)
    } catch (e: any) {
      error.value = e.response?.data?.message || 'Error al cargar productos'
    } finally {
      loading.value = false
    }
  }

  async function crearProducto(payload: CreateProductoPayload) {
    const nuevo = await productosService.create(payload)
    productos.value.unshift(nuevo)
    return nuevo
  }

  async function editarProducto(id: string, payload: UpdateProductoPayload) {
    const actualizado = await productosService.update(id, payload)
    const idx = productos.value.findIndex((p) => p.id === id)
    if (idx !== -1) productos.value[idx] = actualizado
    return actualizado
  }

  async function eliminarProducto(id: string) {
    const eliminado = await productosService.remove(id)
    const idx = productos.value.findIndex((p) => p.id === id)
    if (idx !== -1) productos.value.splice(idx, 1)
    return eliminado
  }

  return { productos, loading, error, fetchProductos, crearProducto, editarProducto, eliminarProducto }
})
