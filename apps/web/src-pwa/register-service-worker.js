import { register } from 'register-service-worker'

function emitPwaEvent (name, detail = {}) {
  if (typeof window === 'undefined') {
    return
  }

  window.dispatchEvent(new CustomEvent(name, { detail }))
}

// The ready(), registered(), cached(), updatefound() and updated()
// events passes a ServiceWorkerRegistration instance in their arguments.
// ServiceWorkerRegistration: https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration

register(process.env.SERVICE_WORKER_FILE, {
  // The registrationOptions object will be passed as the second argument
  // to ServiceWorkerContainer.register()
  // https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerContainer/register#Parameter

  // registrationOptions: { scope: './' },

  ready (registration) {
    emitPwaEvent('pwa-ready', { registration })
  },

  registered (registration) {
    emitPwaEvent('pwa-registered', { registration })
  },

  cached (registration) {
    emitPwaEvent('pwa-cached', { registration })
  },

  updatefound (registration) {
    emitPwaEvent('pwa-update-found', { registration })
  },

  updated (registration) {
    emitPwaEvent('pwa-update-ready', { registration })
  },

  offline () {
    // console.log('No internet connection found. App is running in offline mode.')
  },

  error (/* err */) {
    // console.error('Error during service worker registration:', err)
  }
})
