import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreatePedidoDto, TipoEntrega } from './create-pedido.dto';

function build(overrides: Partial<Record<keyof CreatePedidoDto, unknown>> = {}) {
  return plainToInstance(CreatePedidoDto, {
    cliente_nombre: 'María Pérez',
    cliente_telefono: '0987654321',
    producto_id: 'prod-123',
    guia: 'GUIA-00001',
    tipo_entrega: TipoEntrega.DOMICILIO,
    direccion: 'Av. Amazonas N10-23 y Naciones Unidas',
    monto: 29.99,
    tienda_id: '00000000-0000-0000-0000-000000000001',
    ...overrides,
  });
}

describe('CreatePedidoDto', () => {
  it('acepta un payload válido', async () => {
    const errors = await validate(build());
    expect(errors).toHaveLength(0);
  });

  it('rechaza tienda_id que no es UUID', async () => {
    const errors = await validate(build({ tienda_id: 'not-a-uuid' }));
    const tiendaError = errors.find((e) => e.property === 'tienda_id');
    expect(tiendaError).toBeDefined();
    expect(tiendaError!.constraints).toHaveProperty('matches');
  });

  it('acepta el UUID "nil" con sufijo usado por la tienda por defecto (00..001)', async () => {
    const errors = await validate(
      build({ tienda_id: '00000000-0000-0000-0000-000000000001' }),
    );
    expect(errors.find((e) => e.property === 'tienda_id')).toBeUndefined();
  });

  it('rechaza tipo_entrega fuera del enum', async () => {
    const errors = await validate(build({ tipo_entrega: 'CASA' as unknown as TipoEntrega }));
    expect(errors.find((e) => e.property === 'tipo_entrega')).toBeDefined();
  });

  it('rechaza monto negativo', async () => {
    const errors = await validate(build({ monto: -5 }));
    expect(errors.find((e) => e.property === 'monto')).toBeDefined();
  });

  it('rechaza monto no numérico', async () => {
    const errors = await validate(build({ monto: 'treinta' as unknown as number }));
    expect(errors.find((e) => e.property === 'monto')).toBeDefined();
  });

  it('rechaza nombre de cliente vacío', async () => {
    const errors = await validate(build({ cliente_nombre: '' }));
    expect(errors.find((e) => e.property === 'cliente_nombre')).toBeDefined();
  });

  it('rechaza teléfono de cliente vacío', async () => {
    const errors = await validate(build({ cliente_telefono: '' }));
    expect(errors.find((e) => e.property === 'cliente_telefono')).toBeDefined();
  });

  it('rechaza dirección vacía', async () => {
    const errors = await validate(build({ direccion: '' }));
    expect(errors.find((e) => e.property === 'direccion')).toBeDefined();
  });

  it('acepta campos opcionales ausentes', async () => {
    const errors = await validate(
      build({ canal_origen: undefined, notas: undefined }),
    );
    expect(errors).toHaveLength(0);
  });
});
