import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Spinus® — Dr. Angel M. Ancona Pérez',
  description: 'Sistema de gestión clínica — Cirugía de Columna, Traumatología y Ortopedia',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="h-full">
      <body className="min-h-full antialiased">{children}</body>
    </html>
  )
}
