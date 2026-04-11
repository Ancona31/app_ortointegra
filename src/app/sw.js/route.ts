import { NextResponse } from 'next/server'

const SW_CONTENT = `const CACHE = 'spinus-v3'
const PRECACHE = [
  '/inicio',
  '/documentos',
  '/offline',
  '/fonts/Roboto-Regular.ttf',
  '/fonts/Roboto-Medium.ttf',
  '/fonts/Roboto-Bold.ttf',
  '/fonts/Roboto-Italic.ttf',
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
          .filter(k => k !== CACHE && k !== 'spinus-pdf-fonts-v1')
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)

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

  // NAVEGACIÓN: network-first con fallback a cache y /offline
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
