import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import tiendasService, { type Tienda, type CreateTiendaPayload, type UpdateTiendaPayload } from '../services/tiendasService'

const STORAGE_KEY = 'soporte_ih_tienda_activa'

export const useTiendaStore = defineStore('tienda', () => {
  const tiendas = ref<Tienda[]>([])
  const tiendaActivaId = ref<string | null>(localStorage.getItem(STORAGE_KEY))
  const loading = ref(false)

  const tiendaActiva = computed(() =>
    tiendas.value.find((t) => t.id === tiendaActivaId.value) || tiendas.value[0] || null
  )

  async function fetchTiendas() {
    loading.value = true
    try {
      tiendas.value = await tiendasService.getAll()

      // Si no hay tienda seleccionada o la seleccionada ya no existe, usar la primera
      if (!tiendaActivaId.value || !tiendas.value.find((t) => t.id === tiendaActivaId.value)) {
        if (tiendas.value.length > 0) {
          tiendaActivaId.value = tiendas.value[0].id
          localStorage.setItem(STORAGE_KEY, tiendas.value[0].id)
        }
      }
    } finally {
      loading.value = false
    }
  }

  function setTiendaActiva(id: string) {
    tiendaActivaId.value = id
    localStorage.setItem(STORAGE_KEY, id)
  }

  async function crearTienda(payload: CreateTiendaPayload) {
    const nueva = await tiendasService.create(payload)
    tiendas.value.push(nueva)
    return nueva
  }

  async function editarTienda(id: string, payload: UpdateTiendaPayload) {
    const actualizada = await tiendasService.update(id, payload)
    const idx = tiendas.value.findIndex((t) => t.id === id)
    if (idx !== -1) tiendas.value[idx] = actualizada
    return actualizada
  }

  return {
    tiendas,
    tiendaActivaId,
    tiendaActiva,
    loading,
    fetchTiendas,
    setTiendaActiva,
    crearTienda,
    editarTienda,
  }
})
