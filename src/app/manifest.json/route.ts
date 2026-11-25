import { NextResponse } from 'next/server'

const MANIFEST = JSON.stringify({
  id: '/',
  name: 'Spinus',
  short_name: 'Spinus',
  description: 'Sistema de gestión clínica — Cirugía de Columna, Traumatología y Ortopedia',
  start_url: '/inicio',
  scope: '/',
  display: 'standalone',
  /* Sin `orientation`: la app gira libre (Duo abierto en horizontal, iPhone en
     horizontal). iOS guarda el manifiesto al instalar, así que hay que
     reinstalar la PWA para notarlo. Los dos colores son los del kit del
     rediseño (`--fondo` y `--navy` de fábrica, `src/app/sistema.css`).
     ⚠️ `start_url` sigue en /inicio hasta que se retire el lanzador (B14). */
  background_color: '#F2F4F8',
  theme_color: '#1B2B4A',
  icons: [
    { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: '/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
})

export async function GET() {
  return new NextResponse(MANIFEST, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'public, max-age=86400',
    },
  })
}
