/**
 * Divisiones políticas de Ecuador: 24 provincias y sus cantones.
 *
 * "Ciudad" en el formulario = cantón (unidad de ruteo que usa Rocket /
 * Servientrega). Dentro de un cantón pueden existir parroquias rurales
 * que no están acá — para capturar eso usamos el campo "dirección" y
 * el map picker.
 *
 * Fuente: División política administrativa (INEC). Ordenado por provincia
 * y cantones en alfabético para que el dropdown sea buscable.
 */

export const PROVINCIAS_EC = [
  'Azuay',
  'Bolívar',
  'Cañar',
  'Carchi',
  'Chimborazo',
  'Cotopaxi',
  'El Oro',
  'Esmeraldas',
  'Galápagos',
  'Guayas',
  'Imbabura',
  'Loja',
  'Los Ríos',
  'Manabí',
  'Morona Santiago',
  'Napo',
  'Orellana',
  'Pastaza',
  'Pichincha',
  'Santa Elena',
  'Santo Domingo de los Tsáchilas',
  'Sucumbíos',
  'Tungurahua',
  'Zamora Chinchipe',
] as const

export type ProvinciaEC = (typeof PROVINCIAS_EC)[number]

export const CANTONES_POR_PROVINCIA: Record<ProvinciaEC, string[]> = {
  Azuay: [
    'Camilo Ponce Enríquez', 'Chordeleg', 'Cuenca', 'El Pan', 'Girón', 'Guachapala',
    'Gualaceo', 'Nabón', 'Oña', 'Paute', 'Pucará', 'San Fernando', 'Santa Isabel',
    'Sevilla de Oro', 'Sígsig',
  ],
  'Bolívar': [
    'Caluma', 'Chillanes', 'Chimbo', 'Echeandía', 'Guaranda', 'Las Naves', 'San Miguel',
  ],
  'Cañar': [
    'Azogues', 'Biblián', 'Cañar', 'Déleg', 'El Tambo', 'La Troncal', 'Suscal',
  ],
  Carchi: [
    'Bolívar', 'Espejo', 'Mira', 'Montúfar', 'San Pedro de Huaca', 'Tulcán',
  ],
  Chimborazo: [
    'Alausí', 'Chambo', 'Chunchi', 'Colta', 'Cumandá', 'Guamote', 'Guano', 'Pallatanga',
    'Penipe', 'Riobamba',
  ],
  Cotopaxi: [
    'La Maná', 'Latacunga', 'Pangua', 'Pujilí', 'Salcedo', 'Saquisilí', 'Sigchos',
  ],
  'El Oro': [
    'Arenillas', 'Atahualpa', 'Balsas', 'Chilla', 'El Guabo', 'Huaquillas', 'Las Lajas',
    'Machala', 'Marcabelí', 'Pasaje', 'Piñas', 'Portovelo', 'Santa Rosa', 'Zaruma',
  ],
  Esmeraldas: [
    'Atacames', 'Eloy Alfaro', 'Esmeraldas', 'Muisne', 'Quinindé', 'Rioverde',
    'San Lorenzo',
  ],
  'Galápagos': ['Isabela', 'San Cristóbal', 'Santa Cruz'],
  Guayas: [
    'Alfredo Baquerizo Moreno', 'Balao', 'Balzar', 'Colimes', 'Coronel Marcelino Maridueña',
    'Daule', 'Durán', 'El Empalme', 'El Triunfo', 'General Antonio Elizalde',
    'Guayaquil', 'Isidro Ayora', 'Lomas de Sargentillo', 'Milagro', 'Naranjal',
    'Naranjito', 'Nobol', 'Palestina', 'Pedro Carbo', 'Playas', 'Salitre',
    'Samborondón', 'Santa Lucía', 'Simón Bolívar', 'Yaguachi',
  ],
  Imbabura: [
    'Antonio Ante', 'Cotacachi', 'Ibarra', 'Otavalo', 'Pimampiro', 'San Miguel de Urcuquí',
  ],
  Loja: [
    'Calvas', 'Catamayo', 'Celica', 'Chaguarpamba', 'Espíndola', 'Gonzanamá', 'Loja',
    'Macará', 'Olmedo', 'Paltas', 'Pindal', 'Puyango', 'Quilanga', 'Saraguro', 'Sozoranga',
    'Zapotillo',
  ],
  'Los Ríos': [
    'Babahoyo', 'Baba', 'Buena Fe', 'Mocache', 'Montalvo', 'Palenque', 'Puebloviejo',
    'Quevedo', 'Quinsaloma', 'Urdaneta', 'Valencia', 'Ventanas', 'Vinces',
  ],
  'Manabí': [
    '24 de Mayo', 'Bolívar', 'Chone', 'El Carmen', 'Flavio Alfaro', 'Jama', 'Jaramijó',
    'Jipijapa', 'Junín', 'Manta', 'Montecristi', 'Olmedo', 'Paján', 'Pedernales',
    'Pichincha', 'Portoviejo', 'Puerto López', 'Rocafuerte', 'San Vicente', 'Santa Ana',
    'Sucre', 'Tosagua',
  ],
  'Morona Santiago': [
    'Gualaquiza', 'Huamboya', 'Limón Indanza', 'Logroño', 'Morona', 'Pablo Sexto',
    'Palora', 'San Juan Bosco', 'Santiago', 'Sucúa', 'Taisha', 'Tiwintza',
  ],
  Napo: [
    'Archidona', 'Carlos Julio Arosemena Tola', 'El Chaco', 'Quijos', 'Tena',
  ],
  Orellana: ['Aguarico', 'La Joya de los Sachas', 'Loreto', 'Orellana'],
  Pastaza: ['Arajuno', 'Mera', 'Pastaza', 'Santa Clara'],
  Pichincha: [
    'Cayambe', 'Mejía', 'Pedro Moncayo', 'Pedro Vicente Maldonado', 'Puerto Quito',
    'Quito', 'Rumiñahui', 'San Miguel de los Bancos',
  ],
  'Santa Elena': ['La Libertad', 'Salinas', 'Santa Elena'],
  'Santo Domingo de los Tsáchilas': ['La Concordia', 'Santo Domingo'],
  'Sucumbíos': [
    'Cascales', 'Cuyabeno', 'Gonzalo Pizarro', 'Lago Agrio', 'Putumayo', 'Shushufindi',
    'Sucumbíos',
  ],
  Tungurahua: [
    'Ambato', 'Baños de Agua Santa', 'Cevallos', 'Mocha', 'Patate', 'Pelileo',
    'Píllaro', 'Quero', 'Tisaleo',
  ],
  'Zamora Chinchipe': [
    'Centinela del Cóndor', 'Chinchipe', 'El Pangui', 'Nangaritza', 'Palanda',
    'Paquisha', 'Yacuambi', 'Yantzaza', 'Zamora',
  ],
}

/**
 * Convierte una provincia+ciudad en una query de geocoding para Google Maps.
 * Incluye "Ecuador" al final para evitar ambigüedad con cantones homónimos.
 */
export function geocodeQuery(provincia: string, ciudad: string): string {
  const parts = [ciudad, provincia, 'Ecuador'].filter(Boolean)
  return parts.join(', ')
}
