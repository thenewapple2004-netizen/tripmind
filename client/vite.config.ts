import path from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The browser only ever talks to this dev server. Requests under /api are
// forwarded to the Trip Service, so no CORS configuration is needed.
//   - Docker Compose sets API_PROXY_TARGET=http://trip-service:8000
//   - Running `npm run dev` on the host falls back to the published port.
const apiTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:8001'

// Bind mounts on macOS/Windows don't always deliver file events to the container.
const usePolling = process.env.VITE_USE_POLLING === 'true'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, 'src') },
  },
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    watch: usePolling ? { usePolling: true, interval: 300 } : undefined,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
