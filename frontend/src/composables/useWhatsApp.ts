export type PlantillaWA = 'NUEVO' | 'REPARTO' | 'LLEGO_AGENCIA' | 'NOVEDAD_DOMICILIO' | 'ALERTA' | 'LIBRE'

export interface DatosPlantilla {
  nombre: string
  producto: string
  guia: string
  agencia?: string
}

const PLANTILLAS: Record<PlantillaWA, string> = {
  NUEVO:
    '¡Hola {nombre}! ✨ Tu rutina perfecta está en camino. 📦 Te confirmamos que tu *{producto}* de SKINNA ya salió de nuestra bodega y viaja hacia ti.\n\nPuedes seguir su recorrido en la web de Servientrega con esta guía: *{guia}*.\n\n¡Nos emociona mucho que lo pruebes! Si tienes alguna duda, aquí estamos para ayudarte. 💖',

  LLEGO_AGENCIA:
    '¡Hola {nombre}! Buenas noticias 🌟 Tu *{producto}* de SKINNA ya te está esperando en la agencia Servientrega de *{agencia}*.\n\nPuedes pasar a retirarlo desde hoy presentando tu cédula y este número de guía: *{guia}*.\n\n¡No dejes esperar a tu piel, ve por él! ✨',

  ALERTA:
    '¡Hola {nombre}! 🚨 Te escribimos del equipo de SKINNA porque notamos que tu *{producto}* sigue esperándote en Servientrega (*{agencia}*).\n\n¡Cuidado! El paquete lleva varios días allí y el sistema lo devolverá a nuestra bodega mañana. 😰 Por favor, ayúdanos retirándolo HOY con tu guía: *{guia}*.\n\n¿Tuviste algún inconveniente para ir? Avísanos de inmediato por aquí para intentar ayudarte. 🙏',

  NOVEDAD_DOMICILIO:
    '¡Hola {nombre}! 🛵 Los chicos de Servientrega intentaron entregar tu pedido de SKINNA, pero nos reportan un problema para ubicar la dirección.\n\nPor favor, confírmanos una referencia por este medio para coordinar un nuevo intento rápido. Tu guía es: *{guia}*.\n\n¡Queremos que tengas tu pedido cuanto antes! ✨',

  REPARTO:
    '¡Hola {nombre}! 🛵 ¡El gran día llegó! Tu *{producto}* de SKINNA está en reparto con los chicos de Servientrega y llegará a tu domicilio HOY. 🎉\n\nPor favor, asegúrate de estar pendiente del teléfono o de que haya alguien en casa para recibirlo (tu guía es: *{guia}*). ¡Ya casi tienes tu nueva rutina en tus manos! ✨',

  LIBRE:
    '¡Hola {nombre}! Te escribimos del equipo de SKINNA con respecto a tu pedido de *{producto}* (Guía: *{guia}*).\n\n...',
}

/** Etiquetas legibles para cada plantilla */
export const PLANTILLA_LABELS: Record<PlantillaWA, string> = {
  NUEVO: '📦 Pedido Enviado',
  REPARTO: '🛵 En Reparto Hoy',
  LLEGO_AGENCIA: '🌟 Llegó a Agencia',
  NOVEDAD_DOMICILIO: '🛵 Novedad Dirección',
  ALERTA: '🚨 Alerta Devolución',
  LIBRE: '✏️ Mensaje Libre',
}

/** Sugiere una plantilla según el estado del pedido */
export function sugerirPlantilla(estado: string): PlantillaWA {
  switch (estado) {
    case 'PENDIENTE':
    case 'CONFIRMADO':
    case 'EN_PREPARACION':
    case 'ENVIADO':
      return 'NUEVO'
    case 'RETIRO_EN_AGENCIA':
      return 'LLEGO_AGENCIA'
    case 'EN_RUTA':
      return 'REPARTO'
    case 'NOVEDAD':
    case 'NO_ENTREGADO':
      return 'NOVEDAD_DOMICILIO'
    default:
      return 'LIBRE'
  }
}

/** Genera el texto del mensaje reemplazando variables */
export function generarMensaje(plantilla: PlantillaWA, datos: DatosPlantilla): string {
  let texto = PLANTILLAS[plantilla]
  texto = texto.replace(/\{nombre\}/g, datos.nombre)
  texto = texto.replace(/\{producto\}/g, datos.producto)
  texto = texto.replace(/\{guia\}/g, datos.guia)
  texto = texto.replace(/\{agencia\}/g, datos.agencia || 'tu ciudad')
  return texto
}

/** Normaliza teléfono y abre WhatsApp Web */
export function abrirWhatsApp(telefono: string, mensaje: string) {
  // Quitar todo lo que no sea dígito
  let numero = telefono.replace(/\D/g, '')

  // Si empieza con 0, quitar y agregar 593
  if (numero.startsWith('0')) {
    numero = '593' + numero.slice(1)
  }

  // Si no empieza con 593, agregarlo
  if (!numero.startsWith('593')) {
    numero = '593' + numero
  }

  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensaje)}`
  window.open(url, '_blank')
}
