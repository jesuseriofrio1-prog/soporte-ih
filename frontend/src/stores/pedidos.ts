import { defineStore } from 'pinia'
import { ref } from 'vue'
import pedidosService, {
  type Pedido,
  type FiltrosPedidos,
  type CreatePedidoPayload,
  type EstadoPedido,
} from '../services/pedidosService'

export const usePedidosStore = defineStore('pedidos', () => {
  const pedidos = ref<Pedido[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)
  const filtros = ref<FiltrosPedidos>({})

  async function fetchPedidos() {
    loading.value = true
    error.value = null
    try {
      pedidos.value = await pedidosService.getAll(filtros.value)
    } catch (e: any) {
      error.value = e.response?.data?.message || 'Error al cargar pedidos'
    } finally {
      loading.value = false
    }
  }

  async function crearPedido(payload: CreatePedidoPayload) {
    const nuevo = await pedidosService.create(payload)
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

  function setFiltro(key: keyof FiltrosPedidos, value: string | undefined) {
    filtros.value[key] = value || undefined
    fetchPedidos()
  }

  return { pedidos, loading, error, filtros, fetchPedidos, crearPedido, actualizarEstado, setFiltro }
})
