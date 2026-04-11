const CACHE = 'spinus-v2'
const PRECACHE = ['/inicio', '/documentos', '/offline']

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

  // No interceptar API routes, Supabase ni servicios externos
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) return

  // ASSETS: cache-first
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/fonts/')) {
    e.respondWith(
      caches.match(e.request).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(e.request, clone))
          }
          return res
        }).catch(() => new Response('Offline', { status: 503 }))
      })
    )
    return
  }

  // NAVEGACIÓN: network-first
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone))
        }
        return res
      }).catch(() =>
        caches.match(e.request).then(cached => cached || caches.match('/offline'))
          .then(r => r || new Response('Offline', { status: 503 }))
      )
    )
    return
  }
})
