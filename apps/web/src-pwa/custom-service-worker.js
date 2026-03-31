/* eslint-env serviceworker */

// Force-clear any broken cached assets from previous bad builds
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) => Promise.all(names.map((name) => caches.delete(name))))
  )
})

import { clientsClaim } from 'workbox-core'
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { registerRoute, NavigationRoute } from 'workbox-routing'

clientsClaim()

let currentClientState = {
  conversationId: null,
  visible: false,
}

precacheAndRoute(self.__WB_MANIFEST)
cleanupOutdatedCaches()

if (process.env.MODE !== 'ssr' || process.env.PROD) {
  registerRoute(
    new NavigationRoute(
      createHandlerBoundToURL(process.env.PWA_FALLBACK_HTML),
      { denylist: [new RegExp(process.env.PWA_SERVICE_WORKER_REGEX), /workbox-(.)*\.js$/] }
    )
  )
}

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting()
    return
  }

  if (event.data?.type === 'CLIENT_STATE') {
    currentClientState = {
      conversationId: event.data.conversationId || null,
      visible: event.data.visible === true,
    }
  }
})

self.addEventListener('push', (event) => {
  if (!event.data) {
    return
  }

  event.waitUntil((async () => {
    const payload = event.data.json()
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const sameConversationVisible = currentClientState.visible === true
      && currentClientState.conversationId !== null
      && String(currentClientState.conversationId) === String(payload.conversationId || '')

    if (sameConversationVisible) {
      for (const client of allClients) {
        client.postMessage({ type: 'push-received-in-foreground', payload })
      }
      return
    }

    const title = payload.title || 'Aeris replied'
    const options = {
      body: payload.body || '',
      icon: '/icons/icon-192x192.png',
      badge: '/icons/favicon-96x96.png',
      data: {
        url: payload.url || '/',
        conversationId: payload.conversationId || null,
        userId: payload.userId || null,
      },
      tag: payload.tag || undefined,
      renotify: true,
    }

    await self.registration.showNotification(title, options)
  })())
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = event.notification.data?.url || '/'

  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const absoluteUrl = new URL(targetUrl, self.location.origin).href

    for (const client of allClients) {
      if ('focus' in client) {
        await client.focus()
        client.postMessage({ type: 'open-url', url: absoluteUrl })
        return
      }
    }

    if (self.clients.openWindow) {
      await self.clients.openWindow(absoluteUrl)
    }
  })())
})
