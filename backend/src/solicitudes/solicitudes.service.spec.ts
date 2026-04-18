import { SolicitudesService } from './solicitudes.service';

/**
 * Tests de shape para los endpoints públicos. Propósito: asegurar que
 * los datos expuestos al cliente final nunca incluyan UUIDs internos
 * u otros campos que no deberían ser públicos.
 */

interface MockBuilder {
  select: jest.Mock;
  eq: jest.Mock;
  order: jest.Mock;
  maybeSingle: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
}

function makeMockQuery(result: { data: unknown; error: unknown }) {
  const builder: MockBuilder = {
    select: jest.fn(),
    eq: jest.fn(),
    order: jest.fn(),
    maybeSingle: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  };
  // Todos los métodos encadenables devuelven el mismo builder, salvo el terminal.
  builder.select.mockReturnValue(builder);
  builder.eq.mockReturnValue(builder);
  builder.order.mockResolvedValue(result);
  builder.maybeSingle.mockResolvedValue(result);
  return builder;
}

describe('SolicitudesService — endpoints públicos', () => {
  let service: SolicitudesService;
  let tiendaBuilder: MockBuilder;
  let productosBuilder: MockBuilder;

  const tiendaRow = {
    id: '00000000-0000-0000-0000-000000000001',
    slug: 'skinna',
    nombre: 'Skinna',
    logo_url: null,
    color_primario: '#030363',
    color_secundario: '#C49BC2',
    color_fondo: '#E6E6FB',
  };

  const productoRow = {
    id: '9e6843bd-2fe0-4cb6-bf4f-c47f366fa116',
    slug: 'depiladora-ipl',
    nombre: 'Depiladora IPL',
    precio: 39.99,
    icono: null,
  };

  beforeEach(() => {
    tiendaBuilder = makeMockQuery({ data: tiendaRow, error: null });
    productosBuilder = makeMockQuery({ data: [productoRow], error: null });

    const supabaseMock = {
      getClient: jest.fn().mockReturnValue({
        from: jest.fn((tabla: string) => {
          if (tabla === 'tiendas') return tiendaBuilder;
          if (tabla === 'productos') return productosBuilder;
          return makeMockQuery({ data: null, error: null });
        }),
      }),
    };

    service = new SolicitudesService(supabaseMock as never);
  });

  describe('tiendaPublica', () => {
    it('NUNCA incluye el UUID interno en la respuesta pública', async () => {
      const tienda = await service.tiendaPublica('skinna');
      expect(tienda).not.toHaveProperty('id');
    });

    it('incluye solo los campos de branding esperados', async () => {
      const tienda = await service.tiendaPublica('skinna');
      expect(Object.keys(tienda).sort()).toEqual([
        'color_fondo',
        'color_primario',
        'color_secundario',
        'logo_url',
        'nombre',
        'slug',
      ]);
    });

    it('devuelve 404 si la tienda no existe', async () => {
      tiendaBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.tiendaPublica('no-existe')).rejects.toThrow(
        /no existe o está inactiva/,
      );
    });
  });

  describe('tiendaConCatalogo', () => {
    it('la tienda en la respuesta tampoco incluye id', async () => {
      const result = await service.tiendaConCatalogo('skinna');
      expect(result.tienda).not.toHaveProperty('id');
    });

    it('el catálogo expone sólo id, slug, nombre, precio, icono', async () => {
      const result = await service.tiendaConCatalogo('skinna');
      expect(result.catalogo).toHaveLength(1);
      expect(Object.keys(result.catalogo[0]).sort()).toEqual([
        'icono',
        'id',
        'nombre',
        'precio',
        'slug',
      ]);
    });

    it('no expone campos sensibles del producto (stock, tienda_id, activo)', async () => {
      const result = await service.tiendaConCatalogo('skinna');
      const prod = result.catalogo[0] as Record<string, unknown>;
      expect(prod).not.toHaveProperty('stock');
      expect(prod).not.toHaveProperty('tienda_id');
      expect(prod).not.toHaveProperty('activo');
      expect(prod).not.toHaveProperty('created_at');
    });
  });

  describe('tiendaConProducto', () => {
    it('la tienda sigue sin incluir id', async () => {
      productosBuilder.maybeSingle.mockResolvedValueOnce({
        data: productoRow,
        error: null,
      });
      const result = await service.tiendaConProducto('skinna', 'depiladora-ipl');
      expect(result.tienda).not.toHaveProperty('id');
      expect(result.producto).toHaveProperty('id'); // el producto sí necesita id
    });
  });
});
