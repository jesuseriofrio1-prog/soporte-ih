import api from './api'

export interface DireccionParseada {
  provincia: string | null
  canton: string | null
  sector: string | null
  referencia: string | null
  completa: boolean
  problemas: string[]
  normalizada: string
}

const direccionesService = {
  async parse(texto: string): Promise<DireccionParseada> {
    const { data } = await api.post('/direcciones/parse', { texto })
    return data
  },
}

export default direccionesService
