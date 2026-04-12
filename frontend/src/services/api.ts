import axios from 'axios'
import router from '../router'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

// Interceptor de request: añadir token de autenticación
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('skinna_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Interceptor de response: redirigir a login en caso de 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('skinna_token')
      router.push('/login')
    }
    return Promise.reject(error)
  },
)

export default api
