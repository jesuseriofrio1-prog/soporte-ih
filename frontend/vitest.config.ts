import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

// Config separada de vite.config.ts para que Vitest no cargue el plugin de
// Tailwind (no lo necesitamos en tests y encarece el arranque).
export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['src/**/*.spec.ts'],
    setupFiles: ['./src/test/setup.ts'],
  },
})
