import { normalizarTelefono } from './utils';

describe('normalizarTelefono', () => {
  it('convierte un celular ecuatoriano con 0 inicial a formato 593', () => {
    expect(normalizarTelefono('0987654321')).toBe('593987654321');
  });

  it('quita espacios', () => {
    expect(normalizarTelefono('0987 654 321')).toBe('593987654321');
  });

  it('quita guiones', () => {
    expect(normalizarTelefono('0987-654-321')).toBe('593987654321');
  });

  it('quita el signo +', () => {
    expect(normalizarTelefono('+593987654321')).toBe('593987654321');
  });

  it('mantiene números sin prefijo 0 tal cual si ya vienen con 593', () => {
    expect(normalizarTelefono('593987654321')).toBe('593987654321');
  });

  it('es idempotente para un número ya normalizado', () => {
    const normalizado = normalizarTelefono('0987654321');
    expect(normalizarTelefono(normalizado)).toBe(normalizado);
  });

  it('combina limpieza y prefijo', () => {
    expect(normalizarTelefono('+0987 654-321')).toBe('593987654321');
  });
});
