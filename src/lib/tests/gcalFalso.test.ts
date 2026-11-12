/**
 * La doble guarda del desvío al Google FALSO de las e2e (`src/lib/gcalFalso.ts`).
 * Si alguna de estas falla, la app podría mandar tokens a un servidor que no es
 * Google, o hablar con el falso en producción.
 */
import { describe, it, expect, afterEach, vi } from 'vitest'
import { rootUrlGoogleFalso } from '@/lib/gcalFalso'

function entorno(v: Record<string, string | undefined>): void {
  vi.stubEnv('NODE_ENV', v.NODE_ENV ?? 'test')
  vi.stubEnv('VERCEL_ENV', v.VERCEL_ENV ?? '')
  vi.stubEnv('GCAL_FALSO_URL', v.GCAL_FALSO_URL ?? '')
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', v.NEXT_PUBLIC_SUPABASE_URL ?? '')
}
const LOCAL = { GCAL_FALSO_URL: 'http://127.0.0.1:3998', NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1:54321' }

afterEach(() => { vi.unstubAllEnvs() })

describe('rootUrlGoogleFalso — doble guarda', () => {
  it('desarrollo + Supabase local + destino local: desvía (con barra final)', () => {
    entorno({ ...LOCAL, NODE_ENV: 'development' })
    expect(rootUrlGoogleFalso()).toBe('http://127.0.0.1:3998/')
  })

  it('sin la variable: Google de verdad', () => {
    entorno({ ...LOCAL, GCAL_FALSO_URL: '' })
    expect(rootUrlGoogleFalso()).toBeNull()
  })

  it('NODE_ENV=production: NUNCA, aunque todo lo demás sea local', () => {
    entorno({ ...LOCAL, NODE_ENV: 'production' })
    expect(rootUrlGoogleFalso()).toBeNull()
  })

  it('VERCEL_ENV=production: nunca', () => {
    entorno({ ...LOCAL, VERCEL_ENV: 'production' })
    expect(rootUrlGoogleFalso()).toBeNull()
  })

  it('Supabase que no es local: nunca', () => {
    entorno({ ...LOCAL, NEXT_PUBLIC_SUPABASE_URL: 'https://qpnegmmpneseirfyplbf.supabase.co' })
    expect(rootUrlGoogleFalso()).toBeNull()
    entorno({ ...LOCAL, NEXT_PUBLIC_SUPABASE_URL: '' })
    expect(rootUrlGoogleFalso()).toBeNull()
    entorno({ ...LOCAL, NEXT_PUBLIC_SUPABASE_URL: 'http://127.0.0.1.ejemplo.com:54321' })
    expect(rootUrlGoogleFalso()).toBeNull()
  })

  it('destino que no es local (los tokens irían en Authorization): nunca', () => {
    entorno({ ...LOCAL, GCAL_FALSO_URL: 'https://google-falso.ejemplo.com/' })
    expect(rootUrlGoogleFalso()).toBeNull()
    entorno({ ...LOCAL, GCAL_FALSO_URL: 'no es una url' })
    expect(rootUrlGoogleFalso()).toBeNull()
    entorno({ ...LOCAL, GCAL_FALSO_URL: 'file:///etc/passwd' })
    expect(rootUrlGoogleFalso()).toBeNull()
  })

  it('en el cliente de Calendar: con la guarda cerrada no se pasa rootUrl', async () => {
    const fuente = await import('node:fs').then((fs) => fs.readFileSync('src/lib/gcal.ts', 'utf8'))
    // El único sitio que construye el cliente de Calendar pasa por la guarda.
    expect(fuente.match(/google\.calendar\(/g)).toHaveLength(1)
    expect(fuente).toContain("...(rootUrl ? { rootUrl } : {})")
    expect(fuente).toContain('const rootUrl = rootUrlGoogleFalso()')
  })
})
