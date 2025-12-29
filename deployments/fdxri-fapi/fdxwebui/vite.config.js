import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3030,
    host: '0.0.0.0', // Listen on all interfaces
    // Serve callback.html at /callback for OAuth redirect
    fs: {
      strict: false
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3010',
        changeOrigin: true
      },
      '/dpop': {
        target: 'http://localhost:3010',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/dpop/, '')
      },
      '/keycloak': {
        target: 'http://localhost:8180',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/keycloak/, '')
      },
      '/fdxfapi': {
        target: 'http://tyk-gateway.localhost:8080',
        changeOrigin: true
      },
      '/fdxapi': {
        target: 'http://tyk-gateway.localhost:8080',
        changeOrigin: true
      },
      '/fdxri': {
        target: 'http://tyk-gateway.localhost:8080',
        changeOrigin: true
      },
      '/account-information': {
        target: 'http://tyk-gateway.localhost:8080',
        changeOrigin: true
      }
    }
  }
})

