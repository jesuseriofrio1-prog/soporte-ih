import { readFileSync } from 'fs';
import { join } from 'path';
import { parseRocketExcel } from './rocket-excel.parser';

describe('parseRocketExcel (Excel real de Rocket)', () => {
  const buffer = readFileSync(join(__dirname, '__fixtures__', 'rocket-sample.xlsx'));

  it('parsea las 2 filas del Excel sin errores', async () => {
    const { rows, errors, skippedByEstado } = await parseRocketExcel(buffer);
    expect(errors).toEqual([]);
    expect(skippedByEstado).toEqual([]);
    expect(rows).toHaveLength(2);
  });

  it('mapea los campos básicos de la fila 1 (ID 71528, En ruta)', async () => {
    const { rows } = await parseRocketExcel(buffer);
    const r = rows.find((x) => x.externalOrderId === '71528');
    expect(r).toBeDefined();
    expect(r!.tracking).toBe('185910452');
    expect(r!.estado).toBe('En ruta');
    expect(r!.estadoMapped).toBe('EN_RUTA');
    expect(r!.tipoEntrega).toBe('DOMICILIO');
    expect(r!.transportadora).toBe('Servientrega');
    expect(r!.productoNombre).toBe('DEPILADOR IPL DE CUERPO');
    expect(r!.unidades).toBe(1);
    expect(r!.precio).toBe(39.99);
    expect(r!.clienteNombre).toBe('Génesis Tamara guacon lazo');
    expect(r!.direccion).toBe('Colinas de la alborada');
    expect(r!.ciudad).toBe('GUAYAQUIL');
    expect(r!.provincia).toBe('Guayas');
    expect(r!.telefono).toBe('0980464071');
    expect(r!.fechaPedido).toBe('13-04-2026');
    expect(r!.esCarrito).toBe(false);
  });

  it('mapea la fila 2 (ID 72082, Entregado)', async () => {
    const { rows } = await parseRocketExcel(buffer);
    const r = rows.find((x) => x.externalOrderId === '72082');
    expect(r).toBeDefined();
    expect(r!.tracking).toBe('185910453');
    expect(r!.estadoMapped).toBe('ENTREGADO');
    expect(r!.clienteNombre).toBe('Jenny Silvana Cabrera Morocho');
    expect(r!.ciudad).toBe('CUENCA');
    expect(r!.provincia).toBe('Azuay');
  });

  it('lanza error si el buffer no es un xlsx válido', async () => {
    await expect(parseRocketExcel(Buffer.from('no soy excel'))).rejects.toThrow();
  });
});
