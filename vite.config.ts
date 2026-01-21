import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'https://public.api.bondsports.co',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/v1'),
        headers: {
          'x-api-key': 'zhoZODDEKuaexCBkvumrU7c84TbC3zsC4hENkjlz'
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
})
