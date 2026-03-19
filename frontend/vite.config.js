import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: process.env.GITHUB_PAGES ? '/CommonCare/' : '/',
  plugins: [react()],
  server: {
    host: true,          // Expose to Docker host
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://backend:5000', // Docker service name
        changeOrigin: true
      }
    }
  }
})
