import { resolve } from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  base: './',
  root: resolve(__dirname, 'src/renderer'),
  publicDir: resolve(__dirname, 'build'),
  plugins: [react()],
  resolve: {
    alias: {
      '@renderer': resolve(__dirname, 'src/renderer/src'),
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  server: {
    host: true,
    port: 4173
  },
  preview: {
    host: true,
    port: 4173
  },
  build: {
    outDir: resolve(__dirname, 'web-dist'),
    emptyOutDir: true,
    sourcemap: false
  }
})
