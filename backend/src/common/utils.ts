/** Normalizar teléfono ecuatoriano: quitar espacios/guiones, 0 inicial → 593 */
export function normalizarTelefono(telefono: string): string {
  let limpio = telefono.replace(/[\s\-\+]/g, '');
  if (limpio.startsWith('0')) {
    limpio = '593' + limpio.slice(1);
  }
  return limpio;
}
