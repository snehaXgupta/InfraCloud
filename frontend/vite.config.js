import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
const API_TARGET = process.env.VITE_DEV_API_TARGET || 'http://127.0.0.1:5000'

export default defineConfig({
  plugins: [react()],
  server: {
    // Same-origin API in dev, matching production where the API serves the built app
    proxy: {
      '/api': API_TARGET,
      '/ingest': API_TARGET,
      '/ws': { target: API_TARGET, ws: true },
    },
  },
})
