import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'fs'

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
        // When running in Docker container, use service name 'keycloak'
        // When running locally (npm run dev), use 'localhost'
        // Check if we're in Docker by looking for container environment
        target: process.env.KEYCLOAK_PROXY_TARGET || 
                (fs.existsSync('/.dockerenv') 
                  ? 'http://keycloak:8180' 
                  : 'http://localhost:8180'),
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/keycloak/, '')
      },
      '/fdxfapi': {
        // Use Docker service name when in container, hostname when local
        target: process.env.TYK_GATEWAY_PROXY_TARGET || 
                (fs.existsSync('/.dockerenv') 
                  ? 'http://tyk-gateway:8080' 
                  : 'http://tyk-gateway.localhost:8080'),
        changeOrigin: true
      },
      '/fdxapi': {
        target: process.env.TYK_GATEWAY_PROXY_TARGET || 
                (fs.existsSync('/.dockerenv') 
                  ? 'http://tyk-gateway:8080' 
                  : 'http://tyk-gateway.localhost:8080'),
        changeOrigin: true
      },
      '/fdxri': {
        target: process.env.TYK_GATEWAY_PROXY_TARGET || 
                (fs.existsSync('/.dockerenv') 
                  ? 'http://tyk-gateway:8080' 
                  : 'http://tyk-gateway.localhost:8080'),
        changeOrigin: true
      },
      '/account-information': {
        target: process.env.TYK_GATEWAY_PROXY_TARGET || 
                (fs.existsSync('/.dockerenv') 
                  ? 'http://tyk-gateway:8080' 
                  : 'http://tyk-gateway.localhost:8080'),
        changeOrigin: true
      }
    }
  }
})

