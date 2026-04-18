import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getMessaging, isSupported } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

// Inicializa Firebase solo si hay configuración válida. Si las env vars
// VITE_FIREBASE_* no están seteadas, todas las funciones de push quedan
// como no-op y la app funciona sin ellas.
const firebaseEnabled = !!firebaseConfig.apiKey && !!firebaseConfig.projectId

const app: FirebaseApp | null = firebaseEnabled ? initializeApp(firebaseConfig) : null

let messaging: ReturnType<typeof getMessaging> | null = null

if (app) {
  isSupported().then((supported) => {
    if (supported) {
      messaging = getMessaging(app)
    }
  })
}

export { app, messaging }

/** Obtener messaging de forma async. Devuelve null si Firebase no está configurado. */
export async function getMessagingInstance() {
  if (!app) return null
  const supported = await isSupported()
  if (!supported) return null
  return getMessaging(app)
}
