/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js')

// La config se inyecta al registrar el SW o se hardcodea aquí
// El admin debe reemplazar estos valores con los de su proyecto Firebase
firebase.initializeApp({
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
})

const messaging = firebase.messaging()

// Manejo de notificaciones en background
messaging.onBackgroundMessage((payload) => {
  const titulo = payload.notification?.title || 'SKINNA'
  const opciones = {
    body: payload.notification?.body || '',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
  }

  self.registration.showNotification(titulo, opciones)
})
