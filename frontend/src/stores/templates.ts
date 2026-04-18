import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import templatesService, {
  type WhatsAppTemplate,
  type CreateTemplatePayload,
  type UpdateTemplatePayload,
} from '../services/templatesService'
import { useTiendaStore } from './tienda'

export const useTemplatesStore = defineStore('templates', () => {
  const templates = ref<WhatsAppTemplate[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchTemplates(soloActivos = false) {
    const tiendaStore = useTiendaStore()
    const tiendaId = tiendaStore.tiendaActiva?.id
    if (!tiendaId) return

    loading.value = true
    error.value = null
    try {
      templates.value = await templatesService.list(tiendaId, soloActivos)
    } catch (e: unknown) {
      const err = e as { response?: { data?: { message?: string } } }
      error.value = err.response?.data?.message || 'Error al cargar plantillas'
    } finally {
      loading.value = false
    }
  }

  async function crearTemplate(payload: Omit<CreateTemplatePayload, 'tienda_id'>) {
    const tiendaStore = useTiendaStore()
    const tiendaId = tiendaStore.tiendaActiva?.id
    if (!tiendaId) throw new Error('No hay tienda activa')
    const nuevo = await templatesService.create({ ...payload, tienda_id: tiendaId })
    templates.value.push(nuevo)
    return nuevo
  }

  async function actualizarTemplate(id: string, payload: UpdateTemplatePayload) {
    const tiendaStore = useTiendaStore()
    const tiendaId = tiendaStore.tiendaActiva?.id
    if (!tiendaId) throw new Error('No hay tienda activa')
    const actualizado = await templatesService.update(id, tiendaId, payload)
    const idx = templates.value.findIndex((t) => t.id === id)
    if (idx !== -1) templates.value[idx] = actualizado
    return actualizado
  }

  async function eliminarTemplate(id: string) {
    const tiendaStore = useTiendaStore()
    const tiendaId = tiendaStore.tiendaActiva?.id
    if (!tiendaId) throw new Error('No hay tienda activa')
    await templatesService.remove(id, tiendaId)
    const idx = templates.value.findIndex((t) => t.id === id)
    if (idx !== -1) templates.value.splice(idx, 1)
  }

  /** Templates activos, usados por el WhatsAppModal. */
  const activos = computed(() => templates.value.filter((t) => t.activo))

  /** Encuentra una plantilla por slug (para abrir WA directo desde botones). */
  function porSlug(slug: string): WhatsAppTemplate | null {
    return activos.value.find((t) => t.slug === slug) ?? null
  }

  return {
    templates, loading, error, activos,
    fetchTemplates, crearTemplate, actualizarTemplate, eliminarTemplate, porSlug,
  }
})
