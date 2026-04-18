import { describe, it, expect } from 'vitest'
import { extraerDatosPedido, contarCamposExtraidos } from './useTextExtractor'
import type { Producto } from '../services/productosService'

/**
 * Catálogo mínimo para los tests — los campos no usados por el extractor
 * (stock, precio, etc.) se castean para no obligar a llenar toda la
 * interface.
 */
const PRODUCTOS: Producto[] = [
  { id: 'p1', slug: 'depiladora-ipl', nombre: 'Depiladora IPL', stock: 10, precio: 39.99, icono: null, activo: true },
  { id: 'p2', slug: 'tobillera-compresion', nombre: 'Tobillera de compresión', stock: 5, precio: 12.5, icono: null, activo: true },
  { id: 'p3', slug: 'mascaraled', nombre: 'Mascara Facial LED', stock: 2, precio: 39.99, icono: null, activo: true },
] as unknown as Producto[]

describe('extraerDatosPedido', () => {
  describe('teléfono', () => {
    it('extrae teléfono con prefijo 09', () => {
      const d = extraerDatosPedido('Mi número es 0991234567', PRODUCTOS)
      expect(d.cliente_telefono).toBe('0991234567')
    })

    it('extrae teléfono con +593', () => {
      const d = extraerDatosPedido('contactame al +593 991234567', PRODUCTOS)
      expect(d.cliente_telefono).toBe('0991234567')
    })

    it('normaliza 593 sin + al formato local', () => {
      const d = extraerDatosPedido('593991234567', PRODUCTOS)
      expect(d.cliente_telefono).toBe('0991234567')
    })

    it('devuelve null cuando no hay teléfono', () => {
      const d = extraerDatosPedido('Hola quiero info', PRODUCTOS)
      expect(d.cliente_telefono).toBeNull()
    })
  })

  describe('nombre', () => {
    it('captura "soy Juan Pérez" en mensaje multi-línea', () => {
      const d = extraerDatosPedido('Hola soy Juan Pérez\nquiero pedir', PRODUCTOS)
      expect(d.cliente_nombre).toBe('Juan Pérez')
    })

    it('captura nombres de 3 palabras', () => {
      const d = extraerDatosPedido('soy Ana María Ortega\n0991234567', PRODUCTOS)
      expect(d.cliente_nombre).toBe('Ana María Ortega')
    })

    it('captura "me llamo María García"', () => {
      const d = extraerDatosPedido('me llamo María García', PRODUCTOS)
      expect(d.cliente_nombre).toBe('María García')
    })

    it('captura primera línea cuando parece nombre (2+ palabras)', () => {
      const texto = 'Ana Cristina López\n0991234567\nQuito'
      const d = extraerDatosPedido(texto, PRODUCTOS)
      expect(d.cliente_nombre).toBe('Ana Cristina López')
    })

    it('quita saludos como "Hola" antes del nombre', () => {
      const d = extraerDatosPedido('Hola, Carlos Mendoza\n0991234567', PRODUCTOS)
      expect(d.cliente_nombre).toBe('Carlos Mendoza')
    })

    it('no confunde una sola palabra con nombre', () => {
      const d = extraerDatosPedido('Hola\n0991234567', PRODUCTOS)
      expect(d.cliente_nombre).toBeNull()
    })
  })

  describe('dirección', () => {
    it('captura después de "dirección:"', () => {
      const d = extraerDatosPedido('Dirección: Av. 10 de Agosto N24-55 y Cordero', PRODUCTOS)
      expect(d.direccion).toContain('Av. 10 de Agosto')
    })

    it('detecta "Av." como inicio de dirección', () => {
      const d = extraerDatosPedido('Av. Amazonas 1234, Quito', PRODUCTOS)
      expect(d.direccion).toBeTruthy()
    })

    it('detecta "calle"', () => {
      const d = extraerDatosPedido('Calle García Moreno 456, centro', PRODUCTOS)
      expect(d.direccion).toBeTruthy()
    })
  })

  describe('producto', () => {
    it('match exacto por nombre', () => {
      const d = extraerDatosPedido('quiero una Depiladora IPL', PRODUCTOS)
      expect(d.producto_id).toBe('p1')
      expect(d.producto_nombre).toBe('Depiladora IPL')
    })

    it('match por slug sin guiones', () => {
      const d = extraerDatosPedido('me interesa la tobillera compresion', PRODUCTOS)
      expect(d.producto_id).toBe('p2')
    })

    it('fuzzy match con una palabra', () => {
      const d = extraerDatosPedido('quiero la mascara por favor', PRODUCTOS)
      expect(d.producto_id).toBe('p3')
    })

    it('devuelve null si no hay match', () => {
      const d = extraerDatosPedido('quiero zapatos deportivos', PRODUCTOS)
      expect(d.producto_id).toBeNull()
    })

    it('devuelve null si el catálogo está vacío', () => {
      const d = extraerDatosPedido('Depiladora IPL', [])
      expect(d.producto_id).toBeNull()
    })
  })

  describe('monto', () => {
    it('detecta "$29.99"', () => {
      const d = extraerDatosPedido('cuesta $29.99', PRODUCTOS)
      expect(d.monto).toBe(29.99)
    })

    it('detecta "40 dólares"', () => {
      const d = extraerDatosPedido('son 40 dólares', PRODUCTOS)
      expect(d.monto).toBe(40)
    })

    it('acepta coma como decimal', () => {
      const d = extraerDatosPedido('$12,50', PRODUCTOS)
      expect(d.monto).toBe(12.5)
    })
  })

  describe('integración', () => {
    it('extrae todos los campos de un mensaje realista', () => {
      const texto = `Hola, soy Ana María Ortega
0991234567
Dirección: Av. Amazonas N24-156 y Colón, Quito
Quiero la Depiladora IPL, cuesta $39.99`
      const d = extraerDatosPedido(texto, PRODUCTOS)
      expect(d.cliente_nombre).toBe('Ana María Ortega')
      expect(d.cliente_telefono).toBe('0991234567')
      expect(d.direccion).toContain('Amazonas')
      expect(d.producto_id).toBe('p1')
      expect(d.monto).toBe(39.99)
      expect(contarCamposExtraidos(d)).toBeGreaterThanOrEqual(5)
    })

    it('contarCamposExtraidos cuenta correctamente', () => {
      const d = extraerDatosPedido('0991234567', PRODUCTOS)
      // Sólo teléfono extraído
      expect(contarCamposExtraidos(d)).toBe(1)
    })
  })
})
