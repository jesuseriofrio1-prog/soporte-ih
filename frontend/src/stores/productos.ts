import { defineStore } from 'pinia'
import { ref } from 'vue'
import productosService, {
  type Producto,
  type CreateProductoPayload,
  type UpdateProductoPayload,
} from '../services/productosService'
import { useTiendaStore } from './tienda'

export const useProductosStore = defineStore('productos', () => {
  const productos = ref<Producto[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchProductos(activo?: boolean) {
    const tiendaStore = useTiendaStore()
    const tiendaId = tiendaStore.tiendaActiva?.id
    if (!tiendaId) return

    loading.value = true
    error.value = null
    try {
      productos.value = await productosService.getAll(tiendaId, activo)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message || 'Error al cargar productos'
    } finally {
      loading.value = false
    }
  }

  async function crearProducto(payload: CreateProductoPayload) {
    const tiendaStore = useTiendaStore()
    const nuevo = await productosService.create({ ...payload, tienda_id: tiendaStore.tiendaActiva?.id ?? payload.tienda_id })
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

  async function subirFoto(id: string, file: File) {
    const { foto_url } = await productosService.subirFoto(id, file)
    const idx = productos.value.findIndex((p) => p.id === id)
    if (idx !== -1) productos.value[idx] = { ...productos.value[idx], foto_url }
    return foto_url
  }

  async function borrarFoto(id: string) {
    await productosService.borrarFoto(id)
    const idx = productos.value.findIndex((p) => p.id === id)
    if (idx !== -1) productos.value[idx] = { ...productos.value[idx], foto_url: null }
  }

  return {
    productos, loading, error,
    fetchProductos, crearProducto, editarProducto, eliminarProducto,
    subirFoto, borrarFoto,
  }
})
