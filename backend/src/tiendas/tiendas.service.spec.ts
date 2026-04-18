import { NotFoundException } from '@nestjs/common';
import { TiendasService } from './tiendas.service';
import { SupabaseService } from '../supabase/supabase.service';

// Helper para construir un "query builder" de Supabase encadenable con respuesta mock
function mockQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, jest.Mock> = {};
  // Métodos que devuelven el propio builder (chainable)
  ['select', 'insert', 'update', 'eq', 'order'].forEach((m) => {
    builder[m] = jest.fn().mockReturnValue(builder);
  });
  // Métodos terminales que devuelven la respuesta
  builder.single = jest.fn().mockResolvedValue(result);
  // `order` es a veces terminal (awaited), a veces encadena. Para cubrir el caso
  // de findAll que no llama .single(), hacemos que order también sea thenable.
  builder.order.mockImplementation(() => ({
    ...builder,
    then: (fn: (v: unknown) => unknown) => Promise.resolve(fn(result)),
  }));
  return builder;
}

describe('TiendasService', () => {
  let service: TiendasService;
  let supabase: { getClient: jest.Mock };
  let from: jest.Mock;

  beforeEach(() => {
    from = jest.fn();
    supabase = { getClient: jest.fn().mockReturnValue({ from }) };
    service = new TiendasService(supabase as unknown as SupabaseService);
  });

  describe('findOne', () => {
    it('devuelve la tienda cuando existe', async () => {
      const tienda = { id: 'abc', nombre: 'Skinna' };
      from.mockReturnValue(mockQueryBuilder({ data: tienda, error: null }));

      await expect(service.findOne('abc')).resolves.toEqual(tienda);
      expect(from).toHaveBeenCalledWith('tiendas');
    });

    it('lanza NotFoundException cuando no existe', async () => {
      from.mockReturnValue(mockQueryBuilder({ data: null, error: { code: 'PGRST116' } }));

      await expect(service.findOne('nope')).rejects.toThrow(NotFoundException);
    });
  });

  describe('create', () => {
    it('inserta y devuelve la nueva tienda', async () => {
      const nueva = { id: 'new-1', nombre: 'MaxiHogar' };
      from.mockReturnValue(mockQueryBuilder({ data: nueva, error: null }));

      await expect(service.create({ nombre: 'MaxiHogar' })).resolves.toEqual(nueva);
    });

    it('propaga el error de Supabase', async () => {
      const err = new Error('insert failed');
      from.mockReturnValue(mockQueryBuilder({ data: null, error: err }));

      await expect(service.create({ nombre: 'X' })).rejects.toBe(err);
    });
  });

  describe('update', () => {
    it('exige que la tienda exista antes de actualizar', async () => {
      // La primera llamada a `from()` es el findOne interno — simulamos que no existe
      from.mockReturnValueOnce(
        mockQueryBuilder({ data: null, error: { code: 'PGRST116' } }),
      );

      await expect(service.update('missing', { nombre: 'X' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
