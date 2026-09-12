import { NextResponse } from 'next/server'

const MANIFEST = JSON.stringify({
  id: '/',
  name: 'Spinus®',
  short_name: 'Spinus',
  description: 'Sistema de gestión clínica — Cirugía de Columna, Traumatología y Ortopedia',
  start_url: '/inicio',
  scope: '/',
  display: 'standalone',
  orientation: 'portrait-primary',
  background_color: '#f0f4f8',
  theme_color: '#1a3a5c',
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
