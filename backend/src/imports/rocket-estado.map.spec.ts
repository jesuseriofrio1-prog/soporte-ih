import { inferTipoEntrega, mapEstadoRocket } from './rocket-estado.map';

describe('mapEstadoRocket', () => {
  it('mapea estados simples', () => {
    expect(mapEstadoRocket('Entregado')?.estado).toBe('ENTREGADO');
    expect(mapEstadoRocket('En ruta')?.estado).toBe('EN_RUTA');
    expect(mapEstadoRocket('NOVEDAD')?.estado).toBe('NOVEDAD');
    expect(mapEstadoRocket('Enviado')?.estado).toBe('ENVIADO');
    expect(mapEstadoRocket('Preparado')?.estado).toBe('EN_PREPARACION');
  });

  it('ignora mayúsculas y espacios', () => {
    expect(mapEstadoRocket('  EN RUTA  ')?.estado).toBe('EN_RUTA');
    expect(mapEstadoRocket('entregado')?.estado).toBe('ENTREGADO');
  });

  it('mapea variantes con/sin acentos', () => {
    expect(mapEstadoRocket('Confirmado - Pendiente de preparación')?.estado).toBe('CONFIRMADO');
    expect(mapEstadoRocket('Confirmado - Pendiente de preparacion')?.estado).toBe('CONFIRMADO');
    expect(mapEstadoRocket('Devuelto - en tránsito')?.estado).toBe('DEVUELTO');
    expect(mapEstadoRocket('Devuelto - en transito')?.estado).toBe('DEVUELTO');
  });

  it('rechazado y no confirmable → NO_ENTREGADO', () => {
    expect(mapEstadoRocket('Rechazado')?.estado).toBe('NO_ENTREGADO');
    expect(mapEstadoRocket('NO Confirmable')?.estado).toBe('NO_ENTREGADO');
  });

  it('recogida en agencia → RETIRO_EN_AGENCIA', () => {
    expect(mapEstadoRocket('Recogida en Agencia')?.estado).toBe('RETIRO_EN_AGENCIA');
  });

  it('pedido aplazado → PENDIENTE con flag aplazado', () => {
    const r = mapEstadoRocket('Pedido aplazado');
    expect(r?.estado).toBe('PENDIENTE');
    expect(r?.aplazado).toBe(true);
  });

  it('carrito abandonado y duplicado se marcan como skip', () => {
    expect(mapEstadoRocket('Carrito abandonado')?.skip).toBe(true);
    expect(mapEstadoRocket('Duplicado')?.skip).toBe(true);
  });

  it('devuelve null para estados desconocidos', () => {
    expect(mapEstadoRocket('Inventado')).toBeNull();
    expect(mapEstadoRocket('')).toBeNull();
    expect(mapEstadoRocket(null)).toBeNull();
    expect(mapEstadoRocket(undefined)).toBeNull();
  });
});

describe('inferTipoEntrega', () => {
  it('Recogida en Agencia → AGENCIA', () => {
    expect(inferTipoEntrega('Recogida en Agencia')).toBe('AGENCIA');
    expect(inferTipoEntrega('recogida en agencia')).toBe('AGENCIA');
  });

  it('el resto → DOMICILIO', () => {
    expect(inferTipoEntrega('Entregado')).toBe('DOMICILIO');
    expect(inferTipoEntrega('En ruta')).toBe('DOMICILIO');
    expect(inferTipoEntrega(null)).toBe('DOMICILIO');
    expect(inferTipoEntrega('')).toBe('DOMICILIO');
  });
});
