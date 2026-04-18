import api from './api'

export const CATEGORIAS = [
  'envio',
  'tracking',
  'novedad',
  'alerta',
  'upsell',
  'referido',
  'general',
  'libre',
] as const
export type CategoriaTemplate = typeof CATEGORIAS[number]

export const CATEGORIA_LABELS: Record<CategoriaTemplate, string> = {
  envio:    'Envío',
  tracking: 'Tracking',
  novedad:  'Novedad',
  alerta:   'Alerta',
  upsell:   'Upsell',
  referido: 'Referido',
  general:  'General',
  libre:    'Libre',
}

export interface WhatsAppTemplate {
  id: string
  tienda_id: string
  slug: string
  nombre: string
  mensaje: string
  categoria: CategoriaTemplate
  activo: boolean
  created_at: string
  updated_at: string
}

export interface CreateTemplatePayload {
  tienda_id: string
  slug: string
  nombre: string
  mensaje: string
  categoria?: CategoriaTemplate
  activo?: boolean
}

export interface UpdateTemplatePayload {
  nombre?: string
  mensaje?: string
  categoria?: CategoriaTemplate
  activo?: boolean
}

/**
 * Render client-side: mismo algoritmo que el service del backend.
 * Reemplaza {variable} por su valor o la deja visible si falta.
 */
export function renderTemplate(
  mensaje: string,
  variables: Record<string, string | number | null | undefined>,
): string {
  return mensaje.replace(/\{(\w+)\}/g, (match, key: string) => {
    const v = variables[key]
    if (v === undefined || v === null || v === '') return match
    return String(v)
  })
}

/** Extrae todos los `{var}` presentes en el texto. */
export function extraerVariables(mensaje: string): string[] {
  const regex = /\{(\w+)\}/g
  const set = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = regex.exec(mensaje)) !== null) set.add(m[1])
  return Array.from(set)
}

const templatesService = {
  async list(tiendaId: string, activos = false): Promise<WhatsAppTemplate[]> {
    const { data } = await api.get('/templates', {
      params: { tienda_id: tiendaId, activos: activos ? 'true' : undefined },
    })
    return data
  },

  async create(payload: CreateTemplatePayload): Promise<WhatsAppTemplate> {
    const { data } = await api.post('/templates', payload)
    return data
  },

  async update(id: string, tiendaId: string, payload: UpdateTemplatePayload): Promise<WhatsAppTemplate> {
    const { data } = await api.patch(`/templates/${id}`, payload, {
      params: { tienda_id: tiendaId },
    })
    return data
  },

  async remove(id: string, tiendaId: string): Promise<void> {
    await api.delete(`/templates/${id}`, { params: { tienda_id: tiendaId } })
  },
}

export default templatesService
