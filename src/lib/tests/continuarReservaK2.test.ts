/**
 * K2 (puntos 8, 9 y 10 de Angel), lo que se puede probar sin navegador:
 * - punto 9: la URL de «Continuar mi reserva» (código en el FRAGMENTO, nunca en
 *   la consulta) y el botón en el correo, con el código aún visible;
 * - punto 10: lo que se guarda por pestaña (nunca nombre, teléfono ni código)
 *   y el código del fragmento, que se quita de la barra de direcciones;
 * - punto 8: `?paso=confirmar` exacto.
 * MUTACIONES (comprobadas en rojo): el código en `?codigo=` en vez de
 * `#codigo=`; `guardar` con la persona; `codigoDelFragmento` sin
 * `replaceState`; `esPasoConfirmar` que acepte cualquier valor; `fichaPara`
 * sin mirar el correo; `codigoPendiente` sin los 10 min; `pasoAlRestaurar`
 * que lleve al código con la ficha vigente.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { urlDeReservaConCodigo } from '@/lib/confirmacion/enlaceConfirmacion'
import { correoCodigo } from '@/lib/reserva/correosReserva'
import { esPasoConfirmar } from '@/lib/confirmacion/vistaConfirmacion'
import {
  codigoDelFragmento, codigoPendiente, fichaPara, guardar, pasoAlRestaurar, recuperar, type Continuidad,
} from '@/app/reservar/[codigo]/continuidadReserva'

const ENLACE = 'AbCdEfGhIjKlMnOpQrStUv'
const ORIGEN = 'ZyXwVuTsRqPoNmLkJiHgFe'

describe('punto 9: «Continuar mi reserva»', () => {
  beforeEach(() => { vi.stubEnv('NEXT_PUBLIC_APP_URL', 'https://spinus.prueba') })
  afterEach(() => { vi.unstubAllEnvs() })
  it('el código va en el fragmento; el origen (E6), en la consulta si tiene forma', () => {
    expect(urlDeReservaConCodigo(ENLACE, '012345', null)).toBe(`https://spinus.prueba/reservar/${ENLACE}#codigo=012345`)
    expect(urlDeReservaConCodigo(ENLACE, '012345', ORIGEN)).toBe(`https://spinus.prueba/reservar/${ENLACE}?origen=${ORIGEN}#codigo=012345`)
    expect(urlDeReservaConCodigo(ENLACE, '012345', 'x"><b>')).toBe(`https://spinus.prueba/reservar/${ENLACE}#codigo=012345`)
  })
  it('sin forma, sin URL', () => {
    expect(urlDeReservaConCodigo('corto', '012345', null)).toBeNull()
    expect(urlDeReservaConCodigo(ENLACE, '12345', null)).toBeNull()
  })
  it('el correo lleva el botón y el código sigue visible, en HTML y en texto; nada clínico', () => {
    const url = urlDeReservaConCodigo(ENLACE, '012345', null)
    const c = correoCodigo('Dra. Uno', '012345', { url })
    expect(c.html).toContain(`href="https://spinus.prueba/reservar/${ENLACE}#codigo=012345"`)
    expect(c.html).toContain('Continuar mi reserva')
    expect(c.html).toContain('012345')
    expect(c.texto).toContain(`Continuar mi reserva: ${url}`)
    expect(c.texto).toContain('es 012345')
    const sin = correoCodigo('Dra. Uno', '012345')
    expect(sin.html).not.toContain('Continuar mi reserva')
  })
})

describe('punto 10: lo que se guarda por pestaña', () => {
  const almacen = new Map<string, string>()
  beforeEach(() => {
    almacen.clear()
    vi.stubGlobal('sessionStorage', {
      getItem: (k: string) => almacen.get(k) ?? null, setItem: (k: string, v: string) => { almacen.set(k, v) }, removeItem: (k: string) => { almacen.delete(k) },
    })
  })
  afterEach(() => { vi.unstubAllGlobals() })
  const c: Continuidad = {
    consultorioId: 'c1', tipoId: 't1', turno: { inicio: '2026-12-01T15:00:00Z', fin: '2026-12-01T15:30:00Z' }, clientId: 'id',
    envio: { correo: 'ana@x.mx', en: 1 }, reenviarDesde: 2, ficha: { valor: 'f', correo: 'ana@x.mx', hasta: 3 },
  }
  it('sólo lo mínimo: sin nombre, sin teléfono, sin el código; y vuelve igual', () => {
    guardar(ENLACE, c)
    const crudo = almacen.get(`spinus.reserva.${ENLACE}`) ?? ''
    expect(Object.keys(JSON.parse(crudo)).sort()).toEqual(['clientId', 'consultorioId', 'envio', 'ficha', 'guardadoEn', 'reenviarDesde', 'tipoId', 'turno'])
    expect(recuperar(ENLACE)).toEqual(c)
  })
  it('caduca a los 30 min y lo roto no se usa', () => {
    guardar(ENLACE, c)
    expect(recuperar(ENLACE, Date.now() + 31 * 60_000)).toBeNull()
    almacen.set(`spinus.reserva.${ENLACE}`, JSON.stringify({ ...c, envio: { correo: 5 }, guardadoEn: Date.now() }))
    expect(recuperar(ENLACE)).toBeNull()
  })
})

describe('punto 9: el código del fragmento', () => {
  afterEach(() => { vi.unstubAllGlobals() })
  function ventana(hash: string) {
    const replaceState = vi.fn()
    vi.stubGlobal('window', { location: { hash, pathname: `/reservar/${ENLACE}`, search: '' }, history: { state: null, replaceState } })
    return replaceState
  }
  it('lo lee y lo quita de la barra sin recargar', () => {
    const replaceState = ventana('#codigo=012345')
    expect(codigoDelFragmento()).toBe('012345')
    expect(replaceState).toHaveBeenCalledWith(null, '', `/reservar/${ENLACE}`)
  })
  it('sin forma, nada (y no toca la barra)', () => {
    const replaceState = ventana('#codigo=12ab56')
    expect(codigoDelFragmento()).toBeNull()
    expect(replaceState).not.toHaveBeenCalled()
  })
})

describe('punto 8: ?paso=confirmar', () => {
  it('sólo el valor exacto', () => {
    expect(esPasoConfirmar('confirmar')).toBe(true)
    for (const v of [undefined, '', 'Confirmar', 'cancelar', ['confirmar']]) expect(esPasoConfirmar(v)).toBe(false)
  })
})

describe('punto 10: cuándo se reusa lo pedido', () => {
  const T = 1_000_000_000_000
  const envio = { correo: 'Ana@X.mx', en: T - 60_000 }
  const ficha = { valor: 'f', correo: 'ana@x.mx', hasta: T + 60_000 }
  const base: Continuidad = { consultorioId: 'c', tipoId: 't', turno: null, clientId: 'i', envio, reenviarDesde: 0, ficha: null }
  it('la ficha vale sólo para su correo y mientras no vence', () => {
    expect(fichaPara(ficha, ' ana@x.mx ', T)).toBe('f')
    expect(fichaPara(ficha, 'otro@x.mx', T)).toBeNull()
    expect(fichaPara(ficha, 'ana@x.mx', T + 120_000)).toBeNull()
  })
  it('un código pedido hace menos de 10 min a ese correo está pendiente', () => {
    expect(codigoPendiente(envio, 'ana@x.mx', T)).toBe(true)
    expect(codigoPendiente(envio, 'otro@x.mx', T)).toBe(false)
    expect(codigoPendiente(envio, 'ana@x.mx', T + 10 * 60_000)).toBe(false)
  })
  it('al restaurar: código pendiente → código; ya verificado → datos; vencido → datos', () => {
    expect(pasoAlRestaurar(base, T)).toEqual({ paso: 'codigo', verificado: false })
    expect(pasoAlRestaurar({ ...base, ficha }, T)).toEqual({ paso: 'datos', verificado: true })
    expect(pasoAlRestaurar(base, T + 10 * 60_000)).toEqual({ paso: 'datos', verificado: false })
  })
})
