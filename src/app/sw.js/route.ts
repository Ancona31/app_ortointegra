import { NextResponse } from 'next/server'

const SW_CONTENT = `const CACHE = 'spinus-v5.1'
const FONT_CACHE = 'spinus-pdf-fonts-v1'

const PRECACHE = [
  '/inicio',
  '/dashboard',
  '/agenda',
  '/estadisticas',
  '/documentos',
  '/pacientes',
  '/pacientes/nuevo',
  '/expediente',
  '/expediente/_',
  '/expediente/_/nueva-nota',
  '/expediente/_/editar',
  '/expediente/_/documentos',
  '/expediente/_/laboratorios/nuevo',
  '/expediente/_/laboratorios/_',
  '/expediente/_/consulta/_',
  '/suplementacion',
  '/offline',
  '/logo.png',
  '/icon-192.png',
]

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
      Promise.all(
        keys
          .filter(k => k !== CACHE && k !== FONT_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  // Guarda: solo cachear requests GET. Evita "HEAD is unsupported" en cache.put
  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)

  // APIs y cross-origin: pass-through (nunca cachear)
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) return

  // ASSETS: cache-first (fuentes, estáticos, iconos)
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.match(/\\.(png|jpg|svg|ico|woff2?)$/)
  ) {
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

  // NAVEGACIÓN: Stale-While-Revalidate para rutas de la app
  if (e.request.mode === 'navigate') {
    // Refresh manual (Ctrl+Shift+R): bypass cache, forzar red
    const isForceRefresh = e.request.cache === 'no-cache' ||
      (e.request.headers.get('cache-control') || '').includes('no-cache')

    if (isForceRefresh) {
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

    // Stale-While-Revalidate: servir cache instantáneo, refrescar en background
    e.respondWith(
      caches.match(e.request).then(cached => {
        const fetchPromise = fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(e.request, clone))
          }
          return res
        }).catch(() => null)

        // Si hay cache, servir inmediato (stale) y actualizar en background
        if (cached) {
          fetchPromise // fire-and-forget: actualiza cache en background
          return cached
        }

        // Sin cache: esperar la red, fallback a /offline
        return fetchPromise.then(res => {
          if (res) return res
          return caches.match('/offline')
            .then(r => r || new Response('Offline', { status: 503 }))
        })
      })
    )
    return
  }
})`

export async function GET() {
  return new NextResponse(SW_CONTENT, {
    headers: {
      'Content-Type': 'application/javascript',
      'Service-Worker-Allowed': '/',
      'Cache-Control': 'no-cache',
    },
  })
}
