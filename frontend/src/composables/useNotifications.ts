import { getToken, onMessage } from 'firebase/messaging'
import { getMessagingInstance } from '../firebase'
import { useToast } from 'vue-toastification'
import api from '../services/api'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''

/**
 * Clave de localStorage que recuerda con qué tienda se registró el
 * token actual. Si el admin cambia de tienda activa volvemos a registrar
 * para que las alertas de la nueva tienda sí lleguen a este navegador.
 */
const FCM_REGISTERED_TIENDA_KEY = 'soporte_ih_fcm_registered_tienda'

/**
 * Pide permiso de notificaciones, obtiene FCM token y lo registra en el
 * backend asociado a la tienda activa. Si el mismo navegador cambia de
 * tienda, el token se reasigna (upsert onConflict: token en el backend).
 */
export async function requestPermission(tiendaId: string) {
  try {
    if (!tiendaId) return

    // Si ya registramos este tab con esta tienda, evita re-llamar al backend.
    if (localStorage.getItem(FCM_REGISTERED_TIENDA_KEY) === tiendaId) return

    const messaging = await getMessagingInstance()
    if (!messaging) return

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const token = await getToken(messaging, { vapidKey: VAPID_KEY })
    if (!token) return

    await api.post('/notifications/register-token', { token, tienda_id: tiendaId })
    localStorage.setItem(FCM_REGISTERED_TIENDA_KEY, tiendaId)
  } catch (error) {
    console.error('Error al registrar notificaciones:', error)
  }
}

/** Escucha mensajes en foreground y muestra toast */
export async function onMessageReceived() {
  const messaging = await getMessagingInstance()
  if (!messaging) return

  const toast = useToast()

  onMessage(messaging, (payload) => {
    const titulo = payload.notification?.title || 'Soporte IH'
    const cuerpo = payload.notification?.body || ''

    toast.info(`${titulo}: ${cuerpo}`, {
      timeout: 6000,
    })
  })
}
