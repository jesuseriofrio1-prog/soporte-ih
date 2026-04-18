import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  sugerirPlantilla,
  generarMensaje,
  abrirWhatsApp,
  PLANTILLA_LABELS,
} from './useWhatsApp'

describe('sugerirPlantilla', () => {
  it.each([
    ['PENDIENTE', 'NUEVO'],
    ['CONFIRMADO', 'NUEVO'],
    ['EN_PREPARACION', 'NUEVO'],
    ['ENVIADO', 'NUEVO'],
    ['EN_RUTA', 'REPARTO'],
    ['RETIRO_EN_AGENCIA', 'LLEGO_AGENCIA'],
    ['NOVEDAD', 'NOVEDAD_DOMICILIO'],
    ['NO_ENTREGADO', 'NOVEDAD_DOMICILIO'],
    ['ENTREGADO', 'LIBRE'],
    ['DEVUELTO', 'LIBRE'],
  ])('estado %s → plantilla %s', (estado, esperado) => {
    expect(sugerirPlantilla(estado)).toBe(esperado)
  })
})

describe('generarMensaje', () => {
  const datos = {
    nombre: 'María',
    producto: 'Depiladora IPL',
    guia: 'SRV-12345',
    tienda: 'Skinna',
    agencia: 'Quito Norte',
  }

  it('reemplaza variables en plantilla NUEVO', () => {
    const msg = generarMensaje('NUEVO', datos)
    expect(msg).toContain('María')
    expect(msg).toContain('Depiladora IPL')
    expect(msg).toContain('SRV-12345')
    expect(msg).toContain('Skinna')
    expect(msg).not.toContain('{nombre}')
    expect(msg).not.toContain('{guia}')
  })

  it('usa fallback "tu ciudad" cuando no hay agencia', () => {
    const msg = generarMensaje('LLEGO_AGENCIA', { ...datos, agencia: undefined })
    expect(msg).toContain('tu ciudad')
    expect(msg).not.toContain('{agencia}')
  })

  it('reemplaza TODAS las ocurrencias (g flag)', () => {
    // Forzamos una plantilla con múltiples placeholders idénticos
    const msg = generarMensaje('ALERTA', datos)
    // ALERTA menciona {nombre}, {tienda} y {guia} cada uno al menos una vez
    expect(msg.match(/\{nombre\}/)).toBeNull()
    expect(msg.match(/\{tienda\}/)).toBeNull()
  })
})

describe('PLANTILLA_LABELS', () => {
  it('todas las plantillas tienen label', () => {
    const plantillas: Array<keyof typeof PLANTILLA_LABELS> = [
      'NUEVO', 'REPARTO', 'LLEGO_AGENCIA', 'NOVEDAD_DOMICILIO', 'ALERTA', 'LIBRE',
    ]
    for (const p of plantillas) {
      expect(PLANTILLA_LABELS[p]).toBeTruthy()
      expect(PLANTILLA_LABELS[p].length).toBeGreaterThan(0)
    }
  })
})

describe('abrirWhatsApp (normalización de teléfono)', () => {
  beforeEach(() => {
    vi.mocked(window.open).mockClear()
  })

  function getOpenedUrl(): string {
    const openMock = vi.mocked(window.open)
    const call = openMock.mock.calls[0]
    return call ? (call[0] as string) : ''
  }

  it('convierte 09... a 593...', () => {
    abrirWhatsApp('0991234567', 'hola')
    expect(getOpenedUrl()).toContain('wa.me/593991234567')
  })

  it('respeta número que ya inicia con 593', () => {
    abrirWhatsApp('593991234567', 'hola')
    expect(getOpenedUrl()).toContain('wa.me/593991234567')
  })

  it('añade 593 a número ecuatoriano sin prefijo', () => {
    abrirWhatsApp('991234567', 'hola')
    expect(getOpenedUrl()).toContain('wa.me/593991234567')
  })

  it('quita caracteres no numéricos', () => {
    abrirWhatsApp('099-123 45 67', 'hola')
    expect(getOpenedUrl()).toContain('wa.me/593991234567')
  })

  it('encoda el mensaje en la URL', () => {
    abrirWhatsApp('0991234567', 'Hola María, ¿cómo estás?')
    const url = getOpenedUrl()
    expect(url).toContain('text=')
    expect(url).toContain('Hola%20Mar%C3%ADa')
  })
})
