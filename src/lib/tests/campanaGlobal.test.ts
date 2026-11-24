/**
 * Avisos globales (2026-11-24) · lo puro de la campana de toda la app.
 * MUTACIONES (comprobadas en rojo): `etiquetaCampanaGlobal` sin el número;
 * `useAvisosClinica` ignorando `pedir` (la global volvería a `GET /api/avisos`).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { etiquetaCampanaGlobal, SONDEO_MS } from '@/components/avisos/CampanaAvisos'
import { AVISO_RECIENTE_MS } from '@/lib/avisos/avisosClinica'

const leer = (ruta: string): string => readFileSync(new URL(`../../${ruta}`, import.meta.url), 'utf8')

describe('campana global', () => {
  it('el número va en el nombre del botón, no sólo en el dibujo', () => {
    expect(etiquetaCampanaGlobal(null)).toBe('Avisos')
    expect(etiquetaCampanaGlobal(0)).toBe('Avisos')
    expect(etiquetaCampanaGlobal(3)).toBe('Avisos (3 sin revisar)')
  })
  it('el sondeo no es más lento que la ventana de «recién llegado»: si lo fuera, se perderían burbujas', () => {
    expect(SONDEO_MS).toBeLessThanOrEqual(AVISO_RECIENTE_MS)
  })
  it('lee directo bajo RLS: ni `/api/avisos` ni cliente de servicio', () => {
    const codigo = leer('components/avisos/CampanaAvisos.tsx')
    expect(codigo).toContain('leerAvisosClinica(createClient(), clinicaId)')
    expect(codigo).not.toContain("fetch('/api/avisos'")
    expect(leer('lib/avisos/avisosServidor.ts')).not.toMatch(/^import .*(supabase\/admin|server-only|next\/headers)/m)
  })
  it('el gancho usa la lectura que le pasan', () => {
    expect(leer('hooks/useAvisosClinica.ts')).toContain('void pedir().then')
  })
  it('en /agenda la global se calla (ruta exacta) y el layout sólo la monta con la v2', () => {
    expect(leer('components/avisos/CampanaGlobal.tsx')).toContain("if (pathname === '/agenda') return null")
    expect(leer('app/(app)/layout.tsx')).toContain('{avisosGlobales && <CampanaGlobal />}')
  })
})
