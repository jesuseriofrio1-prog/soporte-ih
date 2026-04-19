/**
 * Agencias de Servientrega Ecuador para retiro en oficina.
 *
 * NOTA: esta es una lista INICIAL/PLACEHOLDER. Antes de producción conviene
 * verificar contra https://www.servientrega.com.ec (sección "Agencias" o
 * "Puntos de atención") porque las oficinas cambian 1-2 veces al año.
 *
 * Estructura:
 *  - provincia: exacto como está en PROVINCIAS_EC (para filtrar)
 *  - ciudad: exacto como aparece en CANTONES_POR_PROVINCIA
 *  - nombre: etiqueta corta para el dropdown (ej. "Centro", "Alborada")
 *  - direccion: dirección completa que se guarda en la BD y se le pasa
 *    después al mensajero/cliente
 *
 * Para agregar una ciudad nueva: añadir entradas con la misma provincia y
 * ciudad. No hace falta tocar nada más — el dropdown se rearma solo.
 */

export interface AgenciaServientrega {
  provincia: string
  ciudad: string
  nombre: string
  direccion: string
}

export const AGENCIAS_SERVIENTREGA: AgenciaServientrega[] = [
  // ── Pichincha / Quito ──
  {
    provincia: 'Pichincha',
    ciudad: 'Quito',
    nombre: 'Matriz Quito',
    direccion: 'Av. 6 de Diciembre N35-174 y Gaspar de Villarroel',
  },
  {
    provincia: 'Pichincha',
    ciudad: 'Quito',
    nombre: 'La Mariscal',
    direccion: 'Av. Amazonas y Jorge Washington',
  },
  {
    provincia: 'Pichincha',
    ciudad: 'Quito',
    nombre: 'Sur / El Recreo',
    direccion: 'Av. Maldonado S11-122, sector El Recreo',
  },
  {
    provincia: 'Pichincha',
    ciudad: 'Quito',
    nombre: 'Valle de los Chillos',
    direccion: 'Av. Ilaló y Río San Pedro, San Rafael',
  },

  // ── Guayas / Guayaquil ──
  {
    provincia: 'Guayas',
    ciudad: 'Guayaquil',
    nombre: 'Centro',
    direccion: 'Av. 9 de Octubre y Quito',
  },
  {
    provincia: 'Guayas',
    ciudad: 'Guayaquil',
    nombre: 'Urdesa',
    direccion: 'Av. Víctor Emilio Estrada y Ficus',
  },
  {
    provincia: 'Guayas',
    ciudad: 'Guayaquil',
    nombre: 'Alborada',
    direccion: 'Av. Rodolfo Baquerizo Nazur, Alborada IX Etapa',
  },
  {
    provincia: 'Guayas',
    ciudad: 'Guayaquil',
    nombre: 'Sauces',
    direccion: 'Av. Francisco de Orellana, Sauces 9',
  },

  // ── Azuay / Cuenca ──
  {
    provincia: 'Azuay',
    ciudad: 'Cuenca',
    nombre: 'Centro',
    direccion: 'Gran Colombia y Luis Cordero',
  },
  {
    provincia: 'Azuay',
    ciudad: 'Cuenca',
    nombre: 'Av. Ordóñez Lasso',
    direccion: 'Av. Ordóñez Lasso y Los Cerezos',
  },

  // ── Manabí ──
  {
    provincia: 'Manabí',
    ciudad: 'Manta',
    nombre: 'Centro Manta',
    direccion: 'Av. 4 de Noviembre y Calle 12',
  },
  {
    provincia: 'Manabí',
    ciudad: 'Portoviejo',
    nombre: 'Centro Portoviejo',
    direccion: 'Av. Manabí y García Moreno',
  },

  // ── Tungurahua / Ambato ──
  {
    provincia: 'Tungurahua',
    ciudad: 'Ambato',
    nombre: 'Centro Ambato',
    direccion: 'Av. Cevallos y Montalvo',
  },

  // ── Loja ──
  {
    provincia: 'Loja',
    ciudad: 'Loja',
    nombre: 'Centro Loja',
    direccion: 'Av. Universitaria y Rocafuerte',
  },

  // ── Imbabura / Ibarra ──
  {
    provincia: 'Imbabura',
    ciudad: 'Ibarra',
    nombre: 'Centro Ibarra',
    direccion: 'Av. Mariano Acosta y Sánchez y Cifuentes',
  },

  // ── Chimborazo / Riobamba ──
  {
    provincia: 'Chimborazo',
    ciudad: 'Riobamba',
    nombre: 'Centro Riobamba',
    direccion: 'Primera Constituyente y Pichincha',
  },

  // ── Santo Domingo ──
  {
    provincia: 'Santo Domingo de los Tsáchilas',
    ciudad: 'Santo Domingo',
    nombre: 'Centro Santo Domingo',
    direccion: 'Av. Quito y Ambato',
  },

  // ── Esmeraldas ──
  {
    provincia: 'Esmeraldas',
    ciudad: 'Esmeraldas',
    nombre: 'Centro Esmeraldas',
    direccion: 'Av. Libertad y Piedrahita',
  },
]

/**
 * Devuelve agencias de una ciudad dada. Si no hay ninguna, devuelve []
 * (el UI mostrará un mensaje pidiendo al cliente elegir domicilio).
 */
export function agenciasDeCiudad(
  provincia: string,
  ciudad: string,
): AgenciaServientrega[] {
  if (!provincia || !ciudad) return []
  return AGENCIAS_SERVIENTREGA.filter(
    (a) => a.provincia === provincia && a.ciudad === ciudad,
  )
}
