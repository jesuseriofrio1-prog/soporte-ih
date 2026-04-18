import { defineStore } from 'pinia'
import { ref } from 'vue'
import pedidosService, {
  type Pedido,
  type CreatePedidoPayload,
  type EstadoPedido,
} from '../services/pedidosService'
import { useTiendaStore } from './tienda'

/**
 * Store de pedidos — trae TODOS los pedidos de la tienda activa y deja
 * el filtrado a la vista. Con volumen moderado (<2k pedidos) esto es más
 * simple y más honesto para los conteos de chips que mandar cada filtro
 * al backend. Si creciera mucho, volver a paginación server-side.
 */
export const usePedidosStore = defineStore('pedidos', () => {
  const pedidos = ref<Pedido[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchPedidos() {
    loading.value = true
    error.value = null
    try {
      const tiendaStore = useTiendaStore()
      pedidos.value = await pedidosService.getAll({ tienda_id: tiendaStore.tiendaActiva?.id })
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message || 'Error al cargar pedidos'
    } finally {
      loading.value = false
    }
  }

  async function crearPedido(payload: CreatePedidoPayload) {
    const tiendaStore = useTiendaStore()
    const nuevo = await pedidosService.create({
      ...payload,
      tienda_id: tiendaStore.tiendaActiva?.id ?? payload.tienda_id,
    })
    pedidos.value.unshift(nuevo)
    return nuevo
  }

  async function actualizarEstado(id: string, nuevoEstado: EstadoPedido, nota?: string) {
    const actualizado = await pedidosService.cambiarEstado(id, nuevoEstado, nota)
    const idx = pedidos.value.findIndex((p) => p.id === id)
    if (idx !== -1) {
      // Preservar los joins que la respuesta de cambiarEstado no trae
      pedidos.value[idx] = { ...pedidos.value[idx], ...actualizado }
    }
    return actualizado
  }

  return { pedidos, loading, error, fetchPedidos, crearPedido, actualizarEstado }
})
