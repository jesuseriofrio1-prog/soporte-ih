#!/usr/bin/env python3
"""Generate TypeScript data file from fetched Servientrega agencies."""
import json
import unicodedata

with open('/tmp/agencias.json') as f:
    raw = json.load(f)

# Normalize our canonical provinces/cantones (accents/case stripped).
PROVINCIA_MAP = {
    'AZUAY': 'Azuay', 'BOLIVAR': 'Bolívar', 'CANAR': 'Cañar',
    'CARCHI': 'Carchi', 'CHIMBORAZO': 'Chimborazo', 'COTOPAXI': 'Cotopaxi',
    'EL ORO': 'El Oro', 'ESMERALDAS': 'Esmeraldas', 'GALAPAGOS': 'Galápagos',
    'GUAYAS': 'Guayas', 'IMBABURA': 'Imbabura', 'LOJA': 'Loja',
    'LOS RIOS': 'Los Ríos', 'MANABI': 'Manabí',
    'MORONA SANTIAGO': 'Morona Santiago', 'NAPO': 'Napo',
    'ORELLANA': 'Orellana', 'PASTAZA': 'Pastaza', 'PICHINCHA': 'Pichincha',
    'SANTA ELENA': 'Santa Elena',
    'SANTO DOMINGO': 'Santo Domingo de los Tsáchilas',
    'SUCUMBIOS': 'Sucumbíos', 'TUNGURAHUA': 'Tungurahua',
    'ZAMORA CHINCHIPE': 'Zamora Chinchipe',
}

# Servientrega ciudad → canonical cantón (cases where Servientrega uses
# parroquia/barrio name instead of cantón).
CIUDAD_REMAP = {
    # Pichincha: varias parroquias de Quito salen nombradas aparte.
    'SANGOLQUI': 'Rumiñahui',
    'SAN RAFAEL': 'Rumiñahui',
    'LA SEXTA': 'Quito',
    'MITAD DEL MUNDO': 'Quito',
    'TUMBACO': 'Quito',
    'CUMBAYA': 'Quito',
    'CALDERON': 'Quito',
    'ALOAG': 'Mejía',
    'MACHACHI': 'Mejía',
    'ASCAZUBI': 'Cayambe',
    'PV MALDONADO': 'Pedro Vicente Maldonado',
    'PEDRO VICENTE MALDONADO': 'Pedro Vicente Maldonado',
    'PUERTO QUITO': 'Puerto Quito',
    'LOS BANCOS': 'San Miguel de los Bancos',
    # Azuay
    'PONCE ENRIQUEZ': 'Camilo Ponce Enríquez',
    'ONA': 'Oña',
    'SIGSIG': 'Sígsig',
    'GIRON': 'Girón',
    # Bolívar
    'SAN MIGUEL DE BOLIVAR': 'San Miguel',
    'ECHEANDIA': 'Echeandía',
    # Cañar
    'CANAR': 'Cañar', 'BIBLIAN': 'Biblián', 'TAMBO': 'El Tambo',
    'JAVIER LOYOLA': 'Azogues', 'COCHANCAY': 'La Troncal',
    # Carchi
    'SAN GABRIEL': 'Montúfar', 'TULCAN': 'Tulcán',
    # Chimborazo
    'ALAUSI': 'Alausí', 'CUMANDA': 'Cumandá', 'EL GUANO': 'Guano',
    'YARUQUIES': 'Riobamba',
    # Cotopaxi
    'LA MANA': 'La Maná', 'PUJILI': 'Pujilí', 'SAQUISILI': 'Saquisilí',
    'EL CORAZON': 'Pangua', 'LASSO': 'Latacunga',
    # El Oro
    'EL CAMBIO': 'Machala', 'LA VICTORIA': 'Santa Rosa',
    'MARCABELI': 'Marcabelí', 'HUERTAS': 'Zaruma', 'PACCHA': 'Atahualpa',
    'PINAS': 'Piñas',
    # Esmeraldas
    'BORBON': 'Eloy Alfaro', 'CHAMANGA': 'Muisne', 'LAGARTO': 'Rioverde',
    'MOMPICHE': 'Muisne', 'LA UNION (QUININDE)': 'Quinindé',
    'QUININDE': 'Quinindé',
    # Galápagos
    'SAN CRISTOBAL': 'San Cristóbal', 'SANTA CRUZ': 'Santa Cruz',
    # Imbabura
    'ATUNTAQUI': 'Antonio Ante', 'URCUQUI': 'San Miguel de Urcuquí',
    'SAN ANTONIO DE IBARRA': 'Ibarra',
    # Loja
    'CARIAMANGA': 'Calvas', 'PALTAS': 'Paltas', 'ALAMOR': 'Puyango',
    'GONZANAMA': 'Gonzanamá', 'MACARA': 'Macará',
    # Los Ríos
    'LA 14 VIA EL PARAISO': 'Babahoyo', 'LA UNION (BABAHOYO)': 'Babahoyo',
    'MATA DE CACAO': 'Buena Fe', 'PATRICIA PILAR': 'Buena Fe',
    # Manabí
    'BAHIA DE CARAQUEZ': 'Sucre', 'CALCETA': 'Bolívar',
    'CALDERON (MANABI)': 'Portoviejo', 'CHARAPOTO': 'Sucre',
    'JARAMIJO': 'Jaramijó', 'JIPIJAPA': 'Jipijapa', 'JUNIN': 'Junín',
    # Morona
    'LIMON INDANZA': 'Limón Indanza', 'SUCUA': 'Sucúa',
    'MACAS': 'Morona',
    # Napo
    # Orellana
    'EL COCA': 'Orellana', 'JOYA DE LOS SACHAS': 'La Joya de los Sachas',
    # Santa Elena
    'SALINAS (SANTA ELENA)': 'Salinas', 'MONTANITA': 'Santa Elena',
    'SAN PABLO (SANTA ELENA)': 'Santa Elena', 'MANGLARALTO': 'Santa Elena',
    'ANCON': 'Santa Elena', 'BALLENITA': 'Santa Elena',
    'CHANDUY': 'Santa Elena', 'MUEY': 'Salinas',
    # Sucumbíos
    'JIVINO VERDE': 'Shushufindi', 'PACAYACU': 'Lago Agrio',
    # Tungurahua
    'BANOS': 'Baños de Agua Santa', 'PILLARO': 'Píllaro',
    'QUISAPINCHA': 'Ambato',
}


def strip_accents(s):
    return ''.join(
        c for c in unicodedata.normalize('NFD', s)
        if unicodedata.category(c) != 'Mn'
    )


def title_case(s):
    """Title-case an uppercase Spanish name, preserving common preps."""
    lower_words = {'de', 'del', 'la', 'el', 'los', 'las', 'y', 'e'}
    parts = s.lower().split()
    out = []
    for i, w in enumerate(parts):
        if i > 0 and w in lower_words:
            out.append(w)
        else:
            out.append(w[:1].upper() + w[1:])
    return ' '.join(out)


def normalize_ciudad(prov_canonical, ciudad_raw):
    """Map Servientrega ciudad to canonical cantón. Returns None to drop."""
    key = ciudad_raw.strip().upper()
    if key in CIUDAD_REMAP:
        return CIUDAD_REMAP[key]
    # Default: title-case the raw name. If it matches a known cantón
    # (we don't have the list here so we accept it) it'll show in dropdown.
    return title_case(key)


# Clean addresses: title-case + collapse spaces.
def clean_address(s):
    s = ' '.join(s.split())
    return title_case(s)


entries = []
for r in raw:
    prov = PROVINCIA_MAP.get(r['provincia'])
    if not prov:
        continue
    ciudad = normalize_ciudad(prov, r['ciudad'])
    if not ciudad:
        continue
    entry = {
        'provincia': prov,
        'ciudad': ciudad,
        'nombre': title_case(r['nombre']),
        'direccion': clean_address(r['direccion']),
    }
    if 'lat' in r and 'lng' in r:
        entry['lat'] = r['lat']
        entry['lng'] = r['lng']
    entries.append(entry)

# Sort by provincia, ciudad, nombre for stable diffs.
entries.sort(key=lambda e: (e['provincia'], e['ciudad'], e['nombre']))

# Emit TypeScript.
header = '''/**
 * Agencias de Servientrega Ecuador para retiro en oficina.
 *
 * Generado automáticamente desde servientrega.com.ec/PuntoEmision
 * (endpoint /PuntoEmision/ConsultaPuntoEmision4). Para regenerar, ver
 * scripts/fetch-servientrega.py.
 *
 * Las ciudades están normalizadas al formato cantonal que usamos en
 * ecuador-geo.ts (ej. "Sangolquí" → "Rumiñahui") para que el dropdown
 * del formulario filtre correctamente.
 */

export interface AgenciaServientrega {
  provincia: string
  ciudad: string
  nombre: string
  direccion: string
  lat?: number
  lng?: number
}

export const AGENCIAS_SERVIENTREGA: AgenciaServientrega[] = [
'''

body_lines = []
for e in entries:
    parts = [
        f"    provincia: {json.dumps(e['provincia'], ensure_ascii=False)},",
        f"    ciudad: {json.dumps(e['ciudad'], ensure_ascii=False)},",
        f"    nombre: {json.dumps(e['nombre'], ensure_ascii=False)},",
        f"    direccion: {json.dumps(e['direccion'], ensure_ascii=False)},",
    ]
    if 'lat' in e:
        parts.append(f"    lat: {e['lat']}, lng: {e['lng']},")
    body_lines.append('  {\n' + '\n'.join(parts) + '\n  },')

footer = ''']

/**
 * Devuelve agencias de una ciudad dada. Si no hay ninguna, devuelve []
 * y el UI muestra un mensaje pidiendo usar domicilio.
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
'''

out = header + '\n'.join(body_lines) + '\n' + footer

with open('/Users/jesuseriofrio/Documents/soporte-ih/frontend/src/data/servientrega-agencias.ts', 'w') as f:
    f.write(out)

print(f'Wrote {len(entries)} agencies')
# Summary by province
from collections import Counter
c = Counter(e['provincia'] for e in entries)
for p, n in sorted(c.items()):
    print(f'  {p}: {n}')
