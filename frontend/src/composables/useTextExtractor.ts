import type { Producto } from '../services/productosService'

export interface DatosExtraidos {
  cliente_nombre: string | null
  cliente_telefono: string | null
  direccion: string | null
  producto_id: string | null
  producto_nombre: string | null
  guia: string | null
  monto: number | null
}

/** Extraer teléfono ecuatoriano del texto */
function extraerTelefono(texto: string): string | null {
  // Patrones: 09XXXXXXXX, +593 9XXXXXXXX, 593XXXXXXXXX
  const patrones = [
    /(?:\+?593)\s*0?(\d{9})/,           // +593 991234567 o 593991234567
    /(0\d{9})/,                          // 0991234567
    /(\d{10})/,                          // 0991234567 sin contexto
  ]

  for (const patron of patrones) {
    const match = texto.match(patron)
    if (match) {
      let num = match[1] || match[0]
      num = num.replace(/\s/g, '')
      if (num.startsWith('0')) return num
      if (num.length === 9) return '0' + num
      return num
    }
  }
  return null
}

/** Extraer nombre del texto */
function extraerNombre(texto: string, telefono: string | null): string | null {
  const lineas = texto.split('\n').map(l => l.trim()).filter(Boolean)

  // Buscar después de "soy", "me llamo", "nombre:"
  // Usamos [ \t] en vez de \s para NO saltar newlines: así "soy Juan\nquiero"
  // sólo captura "Juan". Limitamos a 2-4 palabras consecutivas para no
  // arrastrar más de lo razonable en una sola línea.
  const NOMBRE_2_4 =
    '([A-ZÁÉÍÓÚÑa-záéíóúñ]+(?:[ \\t]+[A-ZÁÉÍÓÚÑa-záéíóúñ]+){1,3})'
  const patronesNombre = [
    new RegExp(`(?:soy|me llamo|nombre:?)[ \\t]+${NOMBRE_2_4}`, 'i'),
    new RegExp(`(?:cliente:?)[ \\t]+${NOMBRE_2_4}`, 'i'),
  ]

  for (const patron of patronesNombre) {
    const match = texto.match(patron)
    if (match) {
      return match[1].trim()
    }
  }

  // Si la primera línea parece un nombre (2+ palabras, sin números, < 40 chars)
  if (lineas.length > 0) {
    const primera = lineas[0]
      .replace(/^(hola|buenos? d[ií]as?|buenas? tardes?|buenas? noches?)[,!.\s]*/i, '')
      .trim()

    if (primera && /^[A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,40}$/.test(primera) && primera.includes(' ')) {
      return primera
    }
  }

  // Texto antes del teléfono si es corto
  if (telefono) {
    const idx = texto.indexOf(telefono)
    if (idx > 3) {
      const antes = texto.substring(0, idx).trim()
        .replace(/[,\-:]/g, '').trim()
      if (/^[A-ZÁÉÍÓÚÑa-záéíóúñ\s]{3,40}$/.test(antes) && antes.includes(' ')) {
        return antes
      }
    }
  }

  return null
}

/** Extraer dirección del texto */
function extraerDireccion(texto: string): string | null {
  // Buscar después de palabras clave de dirección
  const patronesDireccion = [
    /(?:direcci[oó]n:?|enviar a:?|env[ií]o a:?|entregar en:?|domicilio:?)\s*(.{10,100})/i,
    /(?:calle|av\.?|avenida|cdla\.?|ciudadela|sector|barrio|urbanizaci[oó]n|mz\.?|manzana|villa|conjunto|edificio)\s+.{5,80}/i,
    /(?:agencia)\s+.{5,60}/i,
  ]

  for (const patron of patronesDireccion) {
    const match = texto.match(patron)
    if (match) {
      const dir = (match[1] || match[0]).trim()
        .replace(/[,.]$/, '').trim()
      if (dir.length >= 8) return dir
    }
  }

  return null
}

/** Match de producto contra lista — primero exacto, luego fuzzy */
function extraerProducto(texto: string, productos: Producto[]): { id: string; nombre: string } | null {
  if (productos.length === 0) return null

  const textoLower = texto.toLowerCase()

  // 1. Buscar nombre completo del producto en el texto (match exacto)
  for (const prod of productos) {
    if (textoLower.includes(prod.nombre.toLowerCase())) {
      return { id: prod.id, nombre: prod.nombre }
    }
  }

  // 2. Buscar por slug (sin guiones)
  for (const prod of productos) {
    const slugSinGuiones = prod.slug.replace(/-/g, ' ')
    if (textoLower.includes(slugSinGuiones)) {
      return { id: prod.id, nombre: prod.nombre }
    }
  }

  // 3. Fuzzy match — buscar productos donde 2+ palabras coinciden
  let mejorMatch: { id: string; nombre: string; score: number } | null = null

  for (const prod of productos) {
    const palabras = prod.nombre.toLowerCase().split(/\s+/)
    let score = 0
    let matches = 0

    for (const palabra of palabras) {
      // Umbral de 3 chars para evitar falsos positivos como "de" → "deportivos".
      if (palabra.length >= 3 && textoLower.includes(palabra)) {
        score += palabra.length
        matches++
      }
    }

    // Solo aceptar si al menos 1 palabra matchea
    if (matches >= 1 && score > 0 && (!mejorMatch || score > mejorMatch.score)) {
      mejorMatch = { id: prod.id, nombre: prod.nombre, score }
    }
  }

  return mejorMatch ? { id: mejorMatch.id, nombre: mejorMatch.nombre } : null
}

/** Extraer número de guía */
function extraerGuia(texto: string): string | null {
  const patrones = [
    /(?:gu[ií]a:?\s*)(\S{6,20})/i,
    /(?:tracking:?\s*)(\S{6,20})/i,
    /(?:SRV[- ]?\d{4,12})/i,
    /\b(\d{9,12})\b/,  // número de 9-12 dígitos que no sea teléfono
  ]

  // Primero extraer teléfono para excluirlo
  const telefono = extraerTelefono(texto)

  for (const patron of patrones) {
    const match = texto.match(patron)
    if (match) {
      const guia = (match[1] || match[0]).trim()
      // No confundir con teléfono
      if (telefono && guia.includes(telefono.replace(/^0/, ''))) continue
      return guia
    }
  }

  return null
}

/** Extraer monto/precio */
function extraerMonto(texto: string): number | null {
  const patrones = [
    /\$\s*(\d+(?:[.,]\d{1,2})?)/,
    /(\d+(?:[.,]\d{1,2})?)\s*(?:d[oó]lares|usd)/i,
    /(?:precio|monto|total|valor|costo):?\s*\$?\s*(\d+(?:[.,]\d{1,2})?)/i,
  ]

  for (const patron of patrones) {
    const match = texto.match(patron)
    if (match) {
      return parseFloat(match[1].replace(',', '.'))
    }
  }

  return null
}

/** Función principal: extraer todos los datos de un mensaje de WhatsApp */
export function extraerDatosPedido(texto: string, productos: Producto[]): DatosExtraidos {
  const telefono = extraerTelefono(texto)
  const nombre = extraerNombre(texto, telefono)
  const direccion = extraerDireccion(texto)
  const producto = extraerProducto(texto, productos)
  const guia = extraerGuia(texto)
  const monto = extraerMonto(texto)

  return {
    cliente_nombre: nombre,
    cliente_telefono: telefono,
    direccion,
    producto_id: producto?.id || null,
    producto_nombre: producto?.nombre || null,
    guia,
    monto,
  }
}

/** Contar cuántos campos se extrajeron */
export function contarCamposExtraidos(datos: DatosExtraidos): number {
  let count = 0
  if (datos.cliente_nombre) count++
  if (datos.cliente_telefono) count++
  if (datos.direccion) count++
  if (datos.producto_id) count++
  if (datos.guia) count++
  if (datos.monto) count++
  return count
}
