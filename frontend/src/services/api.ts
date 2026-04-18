import axios from 'axios'

// Por defecto usa path relativo /api (deploy unificado en Vercel).
// En dev, Vite proxea /api → http://localhost:3000 (ver vite.config.ts).
// Puedes forzar otro endpoint con VITE_API_URL.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
})

export default api
