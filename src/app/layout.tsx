import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Spinus® — Dr. Angel M. Ancona Pérez',
  description: 'Sistema de gestión clínica — Cirugía de Columna, Traumatología y Ortopedia',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <head>
        <meta name="theme-color" content="#1a3a5c" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Spinus" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-full antialiased">
        {children}
      </body>
    </html>
  )
}
