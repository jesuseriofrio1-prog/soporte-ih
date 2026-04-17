import { defineStore } from 'pinia'
import { ref } from 'vue'
import clientesService, {
  type Cliente,
  type ClienteDetalle,
} from '../services/clientesService'
import { useTiendaStore } from './tienda'

export const useClientesStore = defineStore('clientes', () => {
  const clientes = ref<Cliente[]>([])
  const clienteActivo = ref<ClienteDetalle | null>(null)
  const loading = ref(false)
  const loadingDetalle = ref(false)
  const error = ref<string | null>(null)

  async function fetchClientes(q?: string) {
    const tiendaStore = useTiendaStore()
    const tiendaId = tiendaStore.tiendaActiva?.id
    if (!tiendaId) return

    loading.value = true
    error.value = null
    try {
      clientes.value = await clientesService.getAll(tiendaId, q)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message || 'Error al cargar clientes'
    } finally {
      loading.value = false
    }
  }

  async function fetchClienteDetalle(id: string) {
    loadingDetalle.value = true
    error.value = null
    try {
      const data = await clientesService.getById(id)
      clienteActivo.value = data
      return data
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message || 'Error al cargar detalle del cliente'
      throw e
    } finally {
      loadingDetalle.value = false
    }
  }

  return { clientes, clienteActivo, loading, loadingDetalle, error, fetchClientes, fetchClienteDetalle }
})
