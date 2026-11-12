/**
 * Las rutas públicas del middleware, vistas desde fuera: una petición SIN
 * cookie y sin sesión, ¿pasa o va a /login?
 *
 * Nació con C7 (bloque C de `mejora_agendaV2.md`), que hace pública
 * `/api/cron/google-sync` para Vercel Cron. Comprueba tres cosas:
 *   · la ruta nueva pasa, y SÓLO ella: es una entrada exacta, no un prefijo;
 *   · lo que ya era público lo sigue siendo, `/r/` incluida (es el QR impreso
 *     de la receta, `CLAUDE.md` QR-01);
 *   · lo que estaba protegido sigue protegido, `/api/cron/*` incluido.
 *
 * `@supabase/ssr` es un doble: `getClaims()` no devuelve sesión y no sale a la
 * red. Lo que decide aquí es la lista de rutas, no la verificación del JWT.
 */
import { describe, it, expect, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: null, error: null }) } }),
}))

const { middleware } = await import('@/middleware')

async function vaALogin(ruta: string, cookie?: string): Promise<boolean> {
  const headers = new Headers()
  if (cookie) headers.set('cookie', cookie)
  const res = await middleware(new NextRequest(`http://localhost${ruta}`, { headers }))
  const destino = res.headers.get('location')
  return res.status >= 300 && res.status < 400 && destino !== null && new URL(destino).pathname === '/login'
}

const PUBLICAS_DE_ANTES = [
  '/', '/forgot-password', '/reset-password', '/invitacion', '/auth/callback', '/auth/confirm-email',
  '/pricing', '/register', '/privacy', '/privacidad', '/terms', '/offline', '/demo/receta',
  '/r/ABC123', '/offline-mode', '/offline-setup', '/login',
  '/api/google/callback', '/api/stripe/webhook', '/api/stripe/checkout', '/api/stripe/portal',
  '/api/auth/registro', '/api/auth/email-hook', '/api/auth/verify-email', '/api/auth/audit-login',
  '/api/auth/rate-limit', '/api/auth/login', '/api/auth/reset-password', '/api/auth/aceptar-invitacion',
]

const PROTEGIDAS = [
  '/inicio', '/agenda', '/expediente/abc', '/dashboard',
  '/api/appointments', '/api/google/events', '/api/google/sync', '/api/google/connect',
  '/api/paciente/abc/exportar', '/api/admin/usuarios', '/api/health',
  // Vecinas de la ruta nueva: ninguna se abre por arrastre.
  '/api/cron', '/api/cron/', '/api/cron/otra', '/api/cron/google-sync-x', '/api/cron/google-sync/x',
  '/api/cron/google-syn', '/api/cron/Google-Sync', '/api/r/ABC123',
]

describe('middleware — rutas públicas (C7)', () => {
  it('/api/cron/google-sync pasa sin cookie y sin sesión', async () => {
    expect(await vaALogin('/api/cron/google-sync')).toBe(false)
    expect(await vaALogin('/api/cron/google-sync?x=1')).toBe(false)
  })

  it('lo que ya era público lo sigue siendo, /r/ incluida', async () => {
    for (const ruta of PUBLICAS_DE_ANTES) expect(await vaALogin(ruta), ruta).toBe(false)
  })

  it('lo protegido sigue yendo a /login sin cookie, incluidas las vecinas de la ruta nueva', async () => {
    for (const ruta of PROTEGIDAS) expect(await vaALogin(ruta), ruta).toBe(true)
  })

  it('una cookie que no es sesión (verifier de PKCE, o vacía) no abre nada', async () => {
    expect(await vaALogin('/api/appointments', 'sb-x-auth-token-code-verifier=abc')).toBe(true)
    expect(await vaALogin('/api/appointments', 'sb-x-auth-token=')).toBe(true)
  })
})

describe('middleware — reserva por enlace (D5)', () => {
  it('/reservar/<código> y /api/reservar/<código>/… pasan sin cookie', async () => {
    for (const ruta of ['/reservar/AbCdEfGhIjKlMnOpQrStUv', '/api/reservar/AbCdEfGhIjKlMnOpQrStUv',
      '/api/reservar/AbCdEfGhIjKlMnOpQrStUv/turnos?consultorio=x', '/api/reservar/x/codigo', '/api/reservar/x/verificar']) {
      expect(await vaALogin(ruta), ruta).toBe(false)
    }
  })

  it('el prefijo lleva barra: sus vecinas siguen protegidas', async () => {
    for (const ruta of ['/reservar', '/reservarx', '/reservas/x', '/api/reservar', '/api/reservarx', '/api/reserva/x',
      '/api/agenda/enlaces', '/agenda/reservar']) {
      expect(await vaALogin(ruta), ruta).toBe(true)
    }
  })

  it('/r/ sigue pública y no se confunde con /reservar/', async () => {
    expect(await vaALogin('/r/ABC123')).toBe(false)
    expect(await vaALogin('/rx/ABC123')).toBe(true)
  })
})
