#!/usr/bin/env python3
"""Fetch all Servientrega agencies by province and parse into structured JSON."""
import json
import re
import urllib.request
import urllib.parse

PROVINCIAS = [
    'AZUAY', 'BOLIVAR', 'CANAR', 'CARCHI', 'CHIMBORAZO', 'COTOPAXI',
    'EL ORO', 'ESMERALDAS', 'GALAPAGOS', 'GUAYAS', 'IMBABURA', 'LOJA',
    'LOS RIOS', 'MANABI', 'MORONA SANTIAGO', 'NAPO', 'ORELLANA', 'PASTAZA',
    'PICHINCHA', 'SANTA ELENA', 'SANTO DOMINGO', 'SUCUMBIOS', 'TUNGURAHUA',
    'ZAMORA CHINCHIPE',
]

URL = 'https://www.servientrega.com.ec/PuntoEmision/ConsultaPuntoEmision4'

all_agencies = []
for prov in PROVINCIAS:
    data = json.dumps({'provincia': prov}).encode('utf-8')
    req = urllib.request.Request(
        URL, data=data,
        headers={
            'Content-Type': 'application/json; charset=utf-8',
            'X-Requested-With': 'XMLHttpRequest',
            'User-Agent': 'Mozilla/5.0',
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            rows = json.loads(resp.read().decode('utf-8'))
    except Exception as e:
        print(f'FAIL {prov}: {e}')
        continue

    count = 0
    for row in rows:
        text = row.get('Text', '')
        # Extract col1 (name), col2 (direccion), lat/lng
        m1 = re.search(r'class="cell100 column1[^"]*">([^<]+)</td>', text)
        m2 = re.search(r'class="cell100 column2[^"]*">([^<]+)</td>', text)
        mll = re.search(r"GeneraDetalle\('(-?[\d.]+)','(-?[\d.]+)'\)", text)
        if not (m1 and m2):
            continue
        full_name = m1.group(1).strip()
        direccion = m2.group(1).strip()
        # Split "CIUDAD_NOMBRE" into city + office name
        if '_' in full_name:
            ciudad, nombre = full_name.split('_', 1)
        else:
            ciudad = full_name
            nombre = full_name
        entry = {
            'provincia': prov,
            'ciudad': ciudad.strip(),
            'nombre': nombre.strip(),
            'direccion': direccion,
        }
        if mll:
            try:
                entry['lat'] = float(mll.group(1))
                entry['lng'] = float(mll.group(2))
            except ValueError:
                pass
        all_agencies.append(entry)
        count += 1
    print(f'{prov}: {count}')

with open('/tmp/agencias.json', 'w') as f:
    json.dump(all_agencies, f, ensure_ascii=False, indent=2)

print(f'\nTOTAL: {len(all_agencies)} agencias')
