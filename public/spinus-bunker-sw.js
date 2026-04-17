/**
 * Spinus Bunker SW — Micro Service Worker con scope restringido.
 *
 * Scope: /offline-mode (SOLO esta ruta y sus assets)
 * NO intercepta: /dashboard, /expediente, /login, /api, ni nada más.
 *
 * Estrategia:
 *   - HTML (navigate): Stale-While-Revalidate (sirve cache + actualiza en background)
 *   - Assets (JS/CSS): Network-First con fallback a cache
 *   - Todo lo demás: pass-through
 */

var CACHE_NAME = 'spinus-bunker-v1'

self.addEventListener('install', function (e) {
  e.waitUntil(self.skipWaiting())
})

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.filter(function (k) { return k.startsWith('spinus-bunker-') && k !== CACHE_NAME })
            .map(function (k) { return caches.delete(k) })
      )
    }).then(function () { return self.clients.claim() })
  )
})

self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return

  var url = new URL(e.request.url)

  // Solo interceptar requests dentro del scope /offline-mode
  if (url.origin !== self.location.origin) return
  if (!url.pathname.startsWith('/offline-mode') && !url.pathname.startsWith('/_next/static/')) return

  // APIs: nunca interceptar
  if (url.pathname.startsWith('/api/')) return

  // Navegación (HTML): Stale-While-Revalidate
  if (e.request.mode === 'navigate') {
    e.respondWith(
      caches.open(CACHE_NAME).then(function (cache) {
        return cache.match(e.request).then(function (cached) {
          var fetchPromise = fetch(e.request).then(function (res) {
            if (res.ok) cache.put(e.request, res.clone())
            return res
          }).catch(function () {
            return cached
          })

          return cached || fetchPromise
        })
      })
    )
    return
  }

  // Assets (JS/CSS): Network-First con fallback a cache
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith(
      fetch(e.request).then(function (res) {
        if (res.ok) {
          var clone = res.clone()
          caches.open(CACHE_NAME).then(function (c) { c.put(e.request, clone) })
        }
        return res
      }).catch(function () {
        return caches.match(e.request, { ignoreSearch: true }).then(function (cached) {
          return cached || new Response('', { status: 404 })
        })
      })
    )
    return
  }
})
