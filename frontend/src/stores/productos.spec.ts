import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

/**
 * Mock del service ANTES de importar el store. Vitest hoistea vi.mock al
 * top del archivo compilado, así que no importa el orden aquí.
 */
vi.mock('../services/productosService', () => {
  return {
    default: {
      getAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      remove: vi.fn(),
    },
  }
})

// Mock del store de tienda para no depender de la API real.
vi.mock('./tienda', () => {
  return {
    useTiendaStore: () => ({
      tiendaActiva: { id: 'tienda-uuid', slug: 'skinna', nombre: 'Skinna' },
      tiendaActivaId: 'tienda-uuid',
    }),
  }
})

import productosService from '../services/productosService'
import { useProductosStore } from './productos'

const mockedService = vi.mocked(productosService)

function makeProducto(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'p1',
    slug: 'depiladora-ipl',
    nombre: 'Depiladora IPL',
    stock: 10,
    precio: 39.99,
    icono: null,
    activo: true,
    tienda_id: 'tienda-uuid',
    ...overrides,
  } as unknown as Awaited<ReturnType<typeof productosService.getAll>>[number]
}

describe('useProductosStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('fetchProductos', () => {
    it('llena la lista con los productos del service', async () => {
      mockedService.getAll.mockResolvedValueOnce([makeProducto()])
      const store = useProductosStore()

      await store.fetchProductos()

      expect(mockedService.getAll).toHaveBeenCalledWith('tienda-uuid', undefined)
      expect(store.productos).toHaveLength(1)
      expect(store.productos[0].nombre).toBe('Depiladora IPL')
      expect(store.loading).toBe(false)
      expect(store.error).toBeNull()
    })

    it('acepta filtro activo=true', async () => {
      mockedService.getAll.mockResolvedValueOnce([])
      const store = useProductosStore()
      await store.fetchProductos(true)
      expect(mockedService.getAll).toHaveBeenCalledWith('tienda-uuid', true)
    })

    it('captura errores y los expone en store.error', async () => {
      mockedService.getAll.mockRejectedValueOnce({
        response: { data: { message: 'Error del servidor' } },
      })
      const store = useProductosStore()
      await store.fetchProductos()
      expect(store.error).toBe('Error del servidor')
      expect(store.loading).toBe(false)
    })
  })

  describe('crearProducto', () => {
    it('hace unshift del producto nuevo al principio', async () => {
      const existente = makeProducto({ id: 'p1', nombre: 'Viejo' })
      const nuevo = makeProducto({ id: 'p2', nombre: 'Nuevo' })
      mockedService.getAll.mockResolvedValueOnce([existente])
      mockedService.create.mockResolvedValueOnce(nuevo)

      const store = useProductosStore()
      await store.fetchProductos()
      expect(store.productos[0].id).toBe('p1')

      await store.crearProducto({ nombre: 'Nuevo', slug: 'nuevo', precio: 10, stock: 1 })
      expect(store.productos[0].id).toBe('p2')
      expect(store.productos).toHaveLength(2)
    })
  })

  describe('editarProducto', () => {
    it('reemplaza el producto en su posición', async () => {
      const prod = makeProducto({ id: 'p1', nombre: 'Antes' })
      mockedService.getAll.mockResolvedValueOnce([prod])
      mockedService.update.mockResolvedValueOnce({ ...prod, nombre: 'Después' })

      const store = useProductosStore()
      await store.fetchProductos()
      await store.editarProducto('p1', { nombre: 'Después' })

      expect(store.productos[0].nombre).toBe('Después')
      expect(store.productos).toHaveLength(1)
    })
  })

  describe('eliminarProducto', () => {
    it('quita el producto de la lista', async () => {
      mockedService.getAll.mockResolvedValueOnce([
        makeProducto({ id: 'p1' }),
        makeProducto({ id: 'p2' }),
      ])
      mockedService.remove.mockResolvedValueOnce(undefined)

      const store = useProductosStore()
      await store.fetchProductos()
      await store.eliminarProducto('p1')

      expect(store.productos).toHaveLength(1)
      expect(store.productos[0].id).toBe('p2')
    })
  })
})
