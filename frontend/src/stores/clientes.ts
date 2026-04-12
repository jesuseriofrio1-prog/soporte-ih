import { defineStore } from 'pinia'
import { ref } from 'vue'
import clientesService, {
  type Cliente,
  type ClienteDetalle,
} from '../services/clientesService'

export const useClientesStore = defineStore('clientes', () => {
  const clientes = ref<Cliente[]>([])
  const clienteActivo = ref<ClienteDetalle | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchClientes(q?: string) {
    loading.value = true
    error.value = null
    try {
      clientes.value = await clientesService.getAll(q)
    } catch (e: any) {
      error.value = e.response?.data?.message || 'Error al cargar clientes'
    } finally {
      loading.value = false
    }
  }

  async function fetchClienteDetalle(id: string) {
    clienteActivo.value = null
    const data = await clientesService.getById(id)
    clienteActivo.value = data
    return data
  }

  return { clientes, clienteActivo, loading, error, fetchClientes, fetchClienteDetalle }
})
