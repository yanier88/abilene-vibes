import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Capacitor } from '@capacitor/core'
import './index.css'

if (Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios') {
  document.documentElement.classList.add('capacitor-ios-safe-area')
  const viewport = document.querySelector('meta[name="viewport"]')
  if (viewport && !viewport.content.includes('viewport-fit=')) {
    viewport.content += ', viewport-fit=cover'
  }
}

const localTestRequested = import.meta.env.VITE_APPLE_IAP_LOCAL_TEST === 'true' && Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'
const root = createRoot(document.getElementById('root'))
if (localTestRequested) {
  import('./native/AppleIAPLocalTest.jsx').then(({ default: AppleIAPLocalTest }) => root.render(<AppleIAPLocalTest />))
} else {
  import('./App.jsx').then(({ default: App }) => root.render(<StrictMode><App /></StrictMode>))
}

if (!localTestRequested && 'serviceWorker' in navigator) {
  let refreshing = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) {
      return
    }

    refreshing = true
    window.location.reload()
  })

  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).then((registration) => {
      registration.update()

      if (registration.waiting) {
        registration.waiting.postMessage({ type: 'SKIP_WAITING' })
      }

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing

        worker?.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            worker.postMessage({ type: 'SKIP_WAITING' })
          }
        })
      })
    })
  })
}
