import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'github-pages' ? '/abilene-vibes/' : '/',
  plugins: [react(), {
    name: 'explicit-native-local-test-marker',
    generateBundle() {
      if (process.env.VITE_APPLE_IAP_LOCAL_TEST === 'true') {
        this.emitFile({ type: 'asset', fileName: 'apple-iap-local-test.json', source: '{"enabled":true}' })
      }
    },
  }],
}))
