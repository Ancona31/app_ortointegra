import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

/**
 * BUILD_ID único por deploy. Estable durante toda la vida del deploy en Vercel.
 * Se inyecta en el template string del SW para nombrar el cache.
 * Garantiza coherencia HTML ↔ chunks: cada deploy tiene su propio cache,
 * el SW viejo se desactiva y su cache es borrado automáticamente en activate.
 */
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) || 'dev-local'

/**
 * Paths relativos (sin hash) de los chunks que buscamos en .next/static/chunks/
 * Next.js 16 con App Router genera chunks con nombres tipo:
 *   app/(app)/documentos/page-{hash}.js
 *   app/(launcher)/inicio/page-{hash}.js
 *   app/(app)/expediente/[id]/nueva-nota/page-{hash}.js
 *
 * Cada prefix representa una ruta crítica. Escaneamos el filesystem en
 * build time y matcheamos por prefijo, ignorando el hash.
 */
const CRITICAL_CHUNK_PREFIXES = [
  'app/(launcher)/inicio/page-',
  'app/(launcher)/layout-',
  'app/(app)/dashboard/page-',
  'app/(app)/agenda/page-',
  'app/(app)/estadisticas/page-',
  'app/(app)/documentos/page-',
  'app/(app)/pacientes/page-',
  'app/(app)/pacientes/nuevo/page-',
  'app/(app)/expediente/page-',
  'app/(app)/expediente/[id]/page-',
  'app/(app)/expediente/[id]/nueva-nota/page-',
  'app/(app)/expediente/[id]/editar/page-',
  'app/(app)/expediente/[id]/documentos/page-',
  'app/(app)/expediente/[id]/laboratorios/nuevo/page-',
  'app/(app)/expediente/[id]/laboratorios/[labId]/page-',
  'app/(app)/expediente/[id]/consulta/[consultaId]/page-',
  'app/(app)/suplementacion/page-',
  'app/(app)/layout-',
  'app/layout-',
]

/**
 * Lee chunks críticos combinando 2 fuentes:
 *
 * 1. .next/build-manifest.json → rootMainFiles (webpack/framework/main-app)
 *    + polyfillFiles (los chunks compartidos por TODAS las rutas)
 *
 * 2. Escaneo del filesystem .next/static/chunks/ para encontrar los chunks
 *    específicos por ruta (page-{hash}.js, layout-{hash}.js) matcheando
 *    contra CRITICAL_CHUNK_PREFIXES.
 *
 * Degradación elegante: si falla, retorna [] y el SW degrada a solo-HTML.
 * El warm-up del launcher cubre los chunks en ese caso.
 */
function readCriticalChunks(): string[] {
  const chunks = new Set<string>()

  // ── Fuente 1: build-manifest.json (root chunks compartidos) ──
  try {
    const manifestPath = path.join(process.cwd(), '.next', 'build-manifest.json')
    if (fs.existsSync(manifestPath)) {
      const raw = fs.readFileSync(manifestPath, 'utf-8')
      const manifest = JSON.parse(raw) as {
        rootMainFiles?: string[]
        polyfillFiles?: string[]
      }
      if (Array.isArray(manifest.rootMainFiles)) {
        for (const f of manifest.rootMainFiles) {
          if (typeof f === 'string' && f.length > 0) {
            chunks.add('/_next/' + f)
          }
        }
      }
      if (Array.isArray(manifest.polyfillFiles)) {
        for (const f of manifest.polyfillFiles) {
          if (typeof f === 'string' && f.length > 0) {
            chunks.add('/_next/' + f)
          }
        }
      }
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[sw.js] Error leyendo build-manifest.json:',
      err instanceof Error ? err.message : err)
  }

  // ── Fuente 2: escaneo del filesystem para chunks por ruta ──
  try {
    const appChunksDir = path.join(process.cwd(), '.next', 'static', 'chunks')
    if (!fs.existsSync(appChunksDir)) {
      // eslint-disable-next-line no-console
      console.warn('[sw.js] .next/static/chunks/ no existe — SW degrada')
      return Array.from(chunks)
    }

    // Walker recursivo ligero
    const walk = (dir: string): string[] => {
      const results: string[] = []
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const full = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            results.push(...walk(full))
          } else if (entry.isFile() && entry.name.endsWith('.js')) {
            results.push(full)
          }
        }
      } catch {
        // carpeta inaccesible — continuar
      }
      return results
    }

    const allFiles = walk(appChunksDir)
    let routesFound = 0

    for (const prefix of CRITICAL_CHUNK_PREFIXES) {
      // Convertir el prefix en un path absoluto para comparación
      const prefixAbs = path.join(appChunksDir, prefix).replace(/\\/g, '/')
      const matching = allFiles.filter(f => {
        const normalized = f.replace(/\\/g, '/')
        return normalized.startsWith(prefixAbs)
      })

      if (matching.length > 0) routesFound++

      for (const abs of matching) {
        // Convertir a URL /_next/static/chunks/...
        const rel = path.relative(
          path.join(process.cwd(), '.next'),
          abs
        ).replace(/\\/g, '/')
        chunks.add('/_next/' + rel)
      }
    }

    // eslint-disable-next-line no-console
    console.log(
      `[sw.js] Precache scan: ${routesFound}/${CRITICAL_CHUNK_PREFIXES.length} prefixes matched, ${chunks.size} chunks totales`
    )
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[sw.js] Error escaneando chunks — SW degrada:',
      err instanceof Error ? err.message : err)
  }

  return Array.from(chunks)
}

const CRITICAL_CHUNKS = readCriticalChunks()

const SW_CONTENT = `const CACHE = 'spinus-${BUILD_ID}'
const FONT_CACHE = 'spinus-pdf-fonts-v1'

const PRECACHE_HTML = [
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

// Chunks JS extraídos del app-build-manifest.json en build time
const PRECACHE_CHUNKS = ${JSON.stringify(CRITICAL_CHUNKS)}

const PRECACHE = [...PRECACHE_HTML, ...PRECACHE_CHUNKS]

// ── INSTALL: descarga atómica suave con Promise.allSettled ──
// Un 404 en un chunk individual NO invalida el resto del cache
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(async cache => {
      const results = await Promise.allSettled(
        PRECACHE.map(async url => {
          const res = await fetch(url, { cache: 'reload' })
          if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url)
          await cache.put(url, res)
          return url
        })
      )

      const ok = results.filter(r => r.status === 'fulfilled').length
      const failed = results.filter(r => r.status === 'rejected').length
      // eslint-disable-next-line no-console
      console.log('[sw.js] Precache completado: ' + ok + ' OK, ' + failed + ' fallidos de ' + PRECACHE.length)

      if (failed > 0) {
        const failures = results
          .filter(r => r.status === 'rejected')
          .slice(0, 3)
          .map(r => (r.reason && r.reason.message) || 'unknown')
        // eslint-disable-next-line no-console
        console.warn('[sw.js] Ejemplos de fallos:', failures)
      }
    }).then(() => self.skipWaiting())
  )
})

// ── ACTIVATE: cleanup de caches de deploys anteriores ──
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

// ── Navigation Fallback: mapea URLs dinámicas a su template ──
function resolveTemplateUrl(pathname) {
  // /expediente/[id]/laboratorios/[labId]
  if (/^\\/expediente\\/[^/]+\\/laboratorios\\/[^/]+$/.test(pathname)) {
    // Excepción: /laboratorios/nuevo es su propio template
    if (/^\\/expediente\\/[^/]+\\/laboratorios\\/nuevo$/.test(pathname)) {
      return '/expediente/_/laboratorios/nuevo'
    }
    return '/expediente/_/laboratorios/_'
  }

  // /expediente/[id]/consulta/[consultaId]
  if (/^\\/expediente\\/[^/]+\\/consulta\\/[^/]+$/.test(pathname)) {
    return '/expediente/_/consulta/_'
  }

  // /expediente/[id]/(nueva-nota|editar|documentos)
  var m = pathname.match(/^\\/expediente\\/([^/]+)\\/(nueva-nota|editar|documentos)$/)
  if (m) return '/expediente/_/' + m[2]

  // /expediente/[id]
  if (/^\\/expediente\\/[^/]+$/.test(pathname)) {
    return '/expediente/_'
  }

  return null
}

// ── FETCH handler ──
self.addEventListener('fetch', (e) => {
  // Guarda: solo cachear requests GET
  if (e.request.method !== 'GET') return

  const url = new URL(e.request.url)

  // APIs y cross-origin: pass-through (nunca cachear)
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) return

  // ── CAPTURA TOTAL DE CHUNKS JS — Cache-First con retry 100ms ──
  if (
    url.pathname.startsWith('/_next/static/chunks/') ||
    url.pathname.match(/\\/_next\\/static\\/.*\\.(js|css|json)$/)
  ) {
    e.respondWith(
      caches.match(e.request, { ignoreSearch: true }).then(cached => {
        if (cached) return cached

        const tryFetch = () => fetch(e.request).then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {})
          }
          return res
        })

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

  // ── NAVEGACIÓN: Network-First con fallback a cache (y a template para rutas dinámicas) ──
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok) {
          const clone = res.clone()
          caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {})
        }
        return res
      }).catch(() =>
        caches.match(e.request, { ignoreSearch: true }).then(cached => {
          if (cached) return cached

          // Cache miss → buscar el template de la ruta dinámica
          const templateUrl = resolveTemplateUrl(url.pathname)
          if (templateUrl) {
            return caches.match(templateUrl, { ignoreSearch: true }).then(tplCached => {
              if (tplCached) return tplCached
              return caches.match('/offline')
            })
          }

          return caches.match('/offline')
        }).then(r => r || new Response('Offline', { status: 503 }))
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
