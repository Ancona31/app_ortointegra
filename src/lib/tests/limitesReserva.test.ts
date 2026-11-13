/** limitesReserva.test.ts — agenda D5: la llave del límite nunca lleva la IP ni el dispositivo en claro. */
import { describe, it, expect, beforeAll, vi } from 'vitest'

const llamadas: { p_clave: string; p_ruta: string; p_limite: number; p_ventana_min: number }[] = []
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({
    rpc: (_n: string, args: { p_clave: string; p_ruta: string; p_limite: number; p_ventana_min: number }) => {
      llamadas.push(args)
      return { single: async () => ({ data: { bloqueado: args.p_ruta.includes(':disp:'), restantes: 0 }, error: null }) }
    },
  }),
}))

beforeAll(() => { process.env.RESERVA_SECRETO = 'ab'.repeat(32) })

const { dentroDeLimites, dispositivoDe, ipDe, llaveLimite, seudonimoRed } = await import('@/lib/reserva/limitesReserva')

describe('limitesReserva', () => {
  it('la IP sale de x-real-ip y si no del primer x-forwarded-for', () => {
    expect(ipDe(new Headers({ 'x-real-ip': '1.2.3.4', 'x-forwarded-for': '9.9.9.9' }))).toBe('1.2.3.4')
    expect(ipDe(new Headers({ 'x-forwarded-for': '5.6.7.8, 10.0.0.1' }))).toBe('5.6.7.8')
    expect(ipDe(new Headers())).toBe('')
  })
  it('la llave es reserva:<acción>:<sujeto>:<hmac> y no contiene la IP', () => {
    const s = seudonimoRed('ip', '203.0.113.7')
    expect(s).toMatch(/^[0-9a-f]{64}$/)
    const llave = llaveLimite('reservar', 'ip', s ?? '')
    expect(llave).toBe(`reserva:reservar:ip:${s}`)
    expect(llave).not.toContain('203.0.113.7')
    expect(llaveLimite('reservar', 'ip', '203.0.113.7')).toBeNull()
  })
  it('consume todos los límites de la acción y falla si uno bloquea; p_clave nunca es la IP', async () => {
    llamadas.length = 0
    const ok = await dentroDeLimites('reservar', { ip: seudonimoRed('ip', '1.2.3.4'), disp: seudonimoRed('disp', 'x'.repeat(32)), enlace: 'f'.repeat(64) })
    expect(ok).toBe(false)
    expect(llamadas.map(l => l.p_ruta.split(':').slice(0, 3).join(':'))).toEqual(['reserva:reservar:ip', 'reserva:reservar:disp', 'reserva:reservar:enlace'])
    expect(llamadas.every(l => l.p_clave === 'reserva' && !l.p_ruta.includes('1.2.3.4'))).toBe(true)
    expect(llamadas.map(l => [l.p_limite, l.p_ventana_min])).toEqual([[6, 60], [4, 60], [30, 1440]])
  })
  it('confirmar (E3): 30 por IP y 10 por enlace cada hora, con su propia llave', async () => {
    llamadas.length = 0
    expect(await dentroDeLimites('confirmar', { ip: 'c'.repeat(64), enlace: 'd'.repeat(64) })).toBe(true)
    expect(llamadas.map(l => [l.p_ruta.split(':').slice(0, 3).join(':'), l.p_limite, l.p_ventana_min]))
      .toEqual([['reserva:confirmar:ip', 30, 60], ['reserva:confirmar:enlace', 10, 60]])
  })
  it('un sujeto que no aplica (enlace único: sin tope por enlace) no se cuenta ni bloquea', async () => {
    llamadas.length = 0
    expect(await dentroDeLimites('reservar', { ip: seudonimoRed('ip', '1.2.3.4'), enlace: undefined })).toBe(true)
    expect(llamadas.map(l => l.p_ruta.split(':')[2])).toEqual(['ip'])
  })
  it('sin seudónimo (sin secreto) falla cerrado sin llamar', async () => {
    llamadas.length = 0
    expect(await dentroDeLimites('turnos', { ip: null })).toBe(false)
    expect(llamadas).toHaveLength(0)
  })
  it('la cookie de dispositivo: se conserva si tiene forma, si no se crea', () => {
    const nueva = dispositivoDe(undefined)
    expect(nueva.nuevo).toBe(true)
    expect(nueva.id).toMatch(/^[A-Za-z0-9_-]{32}$/)
    expect(dispositivoDe(nueva.id)).toEqual({ id: nueva.id, nuevo: false })
    expect(dispositivoDe('corta').nuevo).toBe(true)
  })
  it('sincronizar (seg1): 60 cada 10 min por clínica, con la llave de 64 hex y sin el id en claro', async () => {
    llamadas.length = 0
    const { seudonimoClinica } = await import('@/lib/reserva/limitesReserva')
    const id = '33333333-3333-4333-8333-333333333333'
    expect(await dentroDeLimites('sincronizar', { clinica: seudonimoClinica(id) })).toBe(true)
    expect(llamadas.map(l => [l.p_ruta.split(':').slice(0, 3).join(':'), l.p_limite, l.p_ventana_min]))
      .toEqual([['reserva:sincronizar:clinica', 60, 10]])
    expect(llamadas[0]?.p_ruta).not.toContain(id)
  })
})
