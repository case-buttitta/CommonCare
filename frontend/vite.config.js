import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const pkg = require('./package.json')
const commitSha = (process.env.RAILWAY_GIT_COMMIT_SHA || process.env.GITHUB_SHA || '').slice(0, 7)

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __BUILD_SHA__: JSON.stringify(commitSha || 'local'),
  },
  base: process.env.GITHUB_PAGES ? '/CommonCare/' : '/',
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true
      }
    }
  }
})
