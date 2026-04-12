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
  // Guarda: solo cachear requests GET
  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)

  // APIs y cross-origin: pass-through (nunca cachear)
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) return

  // ── CAPTURA TOTAL DE CHUNKS JS — Cache-First ──
  // Los chunks de _next/static/chunks son CRÍTICOS para evitar ChunkLoadError.
  // Estrategia:
  //   1. Buscar en cache con ignoreSearch: true (matchea archivo.js?v=1 con archivo.js)
  //   2. Si hay match → servir instantáneo, NO ir a red
  //   3. Si no hay match → red → cachear → servir
  //   4. Si red falla offline + no cache → 404 (no 503) para retry natural de Next.js
  if (
    url.pathname.startsWith('/_next/static/chunks/') ||
    url.pathname.match(/\\/_next\\/static\\/.*\\.(js|css|json)$/)
  ) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(cached => {
        // Cache hit → servir inmediato sin tocar red
        if (cached) return cached

        // Cache miss → intentar red y cachear
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {})
          }
          return res
        }).catch(() =>
          new Response('', { status: 404, statusText: 'Not Found' })
        )
      })
    )
    return
  }

  // ── ASSETS ESTÁTICOS (fuentes, iconos, imágenes) — cache-first con ignoreSearch ──
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.match(/\\.(png|jpg|svg|ico|woff2?)$/)
  ) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(cached => {
        if (cached) return cached
        return fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {})
          }
          return res
        }).catch(() => new Response('', { status: 404, statusText: 'Not Found' }))
      })
    )
    return
  }

  // ── NAVEGACIÓN: Stale-While-Revalidate para rutas de la app ──
  if (e.request.mode === 'navigate') {
    // Refresh manual (Ctrl+Shift+R): bypass cache, forzar red
    const isForceRefresh = e.request.cache === 'no-cache' ||
      (e.request.headers.get('cache-control') || '').includes('no-cache')

    if (isForceRefresh) {
      e.respondWith(
        fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {})
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
            caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {})
          }
          return res
        }).catch(() => null)

        if (cached) {
          fetchPromise
          return cached
        }

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
