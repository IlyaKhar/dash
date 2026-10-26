import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// В dev-режиме запросы к /api уходят на Go-сервер (по умолчанию :8080).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
})
