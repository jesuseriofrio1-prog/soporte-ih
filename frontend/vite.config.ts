import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  server: {
    // En dev, el backend NestJS corre en :3000 y el frontend Vite en :5173.
    // Este proxy evita CORS y permite usar /api como path relativo en el
    // código, igual que en producción (deploy unificado).
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
