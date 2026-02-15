import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'

export default defineConfig({
  plugins: [preact()],
  root: 'src/client',
  build: {
    outDir: '../../dist',
    emptyOutDir: true
  },
  server: {
    port: 5174,
    proxy: {
      '/api': 'http://localhost:3333'
    }
  }
})
