import { NextResponse } from 'next/server'

/**
 * BUILD_ID único por deploy. Estable durante toda la vida del deploy en Vercel.
 * Se inyecta en el template string del SW para nombrar el cache.
 * Garantiza coherencia HTML ↔ chunks: cada deploy tiene su propio cache,
 * el SW viejo se desactiva y su cache es borrado automáticamente en activate.
 */
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || 'dev-local'

const SW_CONTENT = `const CACHE = 'spinus-${BUILD_ID}'
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

  // ── CAPTURA TOTAL DE CHUNKS JS — Cache-First con retry 100ms ──
  // Los chunks de _next/static/chunks son CRÍTICOS para evitar ChunkLoadError.
  // Estrategia:
  //   1. Buscar en cache con ignoreSearch: true (matchea archivo.js?v=1 con archivo.js)
  //   2. Si hay match → servir instantáneo, NO ir a red
  //   3. Si no hay match → red → cachear → servir
  //   4. Si red falla, retry tras 100ms (tolera glitches transitorios)
  //   5. Si red falla ambos intentos → 404 (no 503) para retry natural de Next.js
  if (
    url.pathname.startsWith('/_next/static/chunks/') ||
    url.pathname.match(/\\/_next\\/static\\/.*\\.(js|css|json)$/)
  ) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(cached => {
        // Cache hit → servir inmediato sin tocar red
        if (cached) return cached

        // Helper: intenta el fetch y cachea si ok
        const tryFetch = () => fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {})
          }
          return res
        })

        // Cache miss → primer intento de red, con retry de 100ms si falla
        return tryFetch().catch(() =>
          new Promise(resolve => setTimeout(resolve, 100))
            .then(() => tryFetch())
            .catch(() => new Response('', { status: 404, statusText: 'Not Found' }))
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

  // ── NAVEGACIÓN: Network-First con fallback a cache ──
  // Crítico: NO usamos Stale-While-Revalidate aquí porque actualizar el HTML
  // en background causaba desajuste con los chunks cacheados (HTML nuevo con
  // refs a chunks que nunca se descargaron). Ahora: siempre red primero
  // cuando hay conexión → HTML y chunks del MISMO deploy. Offline: cache
  // que siempre corresponde al deploy que el usuario visitó online.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {})
        }
        return res
      }).catch(() =>
        // Red caída → cache del mismo deploy (coherente con chunks cacheados)
        caches.match(e.request, { ignoreSearch: true })
          .then(cached => cached || caches.match('/offline'))
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
