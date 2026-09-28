import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {adminIsolationPlugin} from './scripts/admin/isolation.mjs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))

// Build config for https://yanier88.github.io/abilene-vibes-admin/
export default defineConfig({
  base: '/abilene-vibes-admin/',
  publicDir: false,
  plugins: [react(), adminIsolationPlugin()],
  build: {
    outDir: 'dist-admin',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        admin: resolve(__dirname, 'admin.html'),
      },
    },
  },
})
