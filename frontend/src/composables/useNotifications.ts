import { getToken, onMessage } from 'firebase/messaging'
import { getMessagingInstance } from '../firebase'
import { useToast } from 'vue-toastification'
import api from '../services/api'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || ''

/** Pide permiso de notificaciones, obtiene FCM token y lo registra en el backend */
export async function requestPermission() {
  try {
    // Verificar si ya se registró
    if (localStorage.getItem('soporte_ih_fcm_registered') === 'true') return

    const messaging = await getMessagingInstance()
    if (!messaging) return

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return

    const token = await getToken(messaging, { vapidKey: VAPID_KEY })
    if (!token) return

    // Guardar y registrar en backend
    localStorage.setItem('soporte_ih_fcm_token', token)

    await api.post('/notifications/register-token', { token })
    localStorage.setItem('soporte_ih_fcm_registered', 'true')
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
