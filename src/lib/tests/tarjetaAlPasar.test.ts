import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CLAVE_TARJETA_AL_PASAR, ESPERA_ABRIR_MS, MARGEN_CERRAR_MS, crearVigiaAlPasar, guardarTarjetaAlPasar,
  leerTarjetaAlPasar, type AlmacenTarjetaAlPasar, type VigiaAlPasar,
} from '@/lib/agenda/tarjetaAlPasar'

/* T3 · El vigía de la tarjeta al pasar el ratón, con el reloj falso de Vitest.
   MUTACIONES (comprobadas en rojo): no reiniciar la cuenta en cada movimiento
   (`armar` sólo al entrar) → «la quietud se reinicia»; quitar `botones !== 0`
   → «con un botón pulsado no se arma»; quitar `desarmada` → «tras pulsar no se
   arma»; cerrar sin margen → «cruzar a la tarjeta no la cierra»; no cerrar con
   botón pulsado → «un arrastre cierra la abierta». */

const reloj = {
  poner: (fn: () => void, ms: number) => setTimeout(fn, ms),
  quitar: (asa: ReturnType<typeof setTimeout>): void => clearTimeout(asa),
}

function montar(puede = true): { v: VigiaAlPasar; abrir: ReturnType<typeof vi.fn>; cerrar: ReturnType<typeof vi.fn>; permitir: (s: boolean) => void } {
  let permitido = puede
  const abrir = vi.fn()
  const cerrar = vi.fn()
  const v = crearVigiaAlPasar({ puedeAbrir: () => permitido, abrir, cerrar }, reloj)
  return { v, abrir, cerrar, permitir: (s) => { permitido = s } }
}

beforeEach(() => { vi.useFakeTimers() })
afterEach(() => { vi.useRealTimers() })

describe('crearVigiaAlPasar', () => {
  it('abre tras un segundo de quietud sobre la cita, no antes', () => {
    const { v, abrir } = montar()
    v.mover('a', 0)
    vi.advanceTimersByTime(ESPERA_ABRIR_MS - 1)
    expect(abrir).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(abrir).toHaveBeenCalledWith('a')
  })

  it('la quietud se reinicia con cada movimiento', () => {
    const { v, abrir } = montar()
    v.mover('a', 0)
    vi.advanceTimersByTime(800)
    v.mover('a', 0)
    vi.advanceTimersByTime(800)
    expect(abrir).not.toHaveBeenCalled()
    vi.advanceTimersByTime(200)
    expect(abrir).toHaveBeenCalledTimes(1)
  })

  it('salir antes del segundo no abre nada', () => {
    const { v, abrir } = montar()
    v.mover('a', 0)
    vi.advanceTimersByTime(500)
    v.mover(null, 0)
    vi.advanceTimersByTime(2000)
    expect(abrir).not.toHaveBeenCalled()
  })

  it('con un botón pulsado (arrastre o estiramiento) no se arma', () => {
    const { v, abrir } = montar()
    v.mover('a', 1)
    vi.advanceTimersByTime(3000)
    expect(abrir).not.toHaveBeenCalled()
  })

  it('tras pulsar sobre la cita no se arma hasta salir de ella', () => {
    const { v, abrir } = montar()
    v.mover('a', 0)
    v.pulsar()
    v.mover('a', 0)
    vi.advanceTimersByTime(3000)
    expect(abrir).not.toHaveBeenCalled()
    v.mover(null, 0)
    v.mover('a', 0)
    vi.advanceTimersByTime(ESPERA_ABRIR_MS)
    expect(abrir).toHaveBeenCalledWith('a')
  })

  it('pregunta `puedeAbrir` al disparar (diálogo abierto, preferencia apagada…)', () => {
    const { v, abrir, permitir } = montar(false)
    v.mover('a', 0)
    vi.advanceTimersByTime(ESPERA_ABRIR_MS)
    expect(abrir).not.toHaveBeenCalled()
    permitir(true)
    v.mover('a', 0)
    vi.advanceTimersByTime(ESPERA_ABRIR_MS)
    expect(abrir).toHaveBeenCalledTimes(1)
  })

  it('salir de la cita cierra tras el margen; cruzar a la tarjeta no la cierra', () => {
    const { v, cerrar } = montar()
    v.mover('a', 0)
    vi.advanceTimersByTime(ESPERA_ABRIR_MS)
    v.mover(null, 0)
    vi.advanceTimersByTime(MARGEN_CERRAR_MS - 50)
    v.entrarTarjeta()
    vi.advanceTimersByTime(1000)
    expect(cerrar).not.toHaveBeenCalled()
    v.salirTarjeta()
    vi.advanceTimersByTime(MARGEN_CERRAR_MS)
    expect(cerrar).toHaveBeenCalledTimes(1)
  })

  it('volver a la cita dentro del margen no cierra', () => {
    const { v, cerrar } = montar()
    v.mover('a', 0)
    vi.advanceTimersByTime(ESPERA_ABRIR_MS)
    v.mover(null, 0)
    vi.advanceTimersByTime(100)
    v.mover('a', 0)
    vi.advanceTimersByTime(2000)
    expect(cerrar).not.toHaveBeenCalled()
  })

  it('una vez soltada (fijada con un clic) ya no la cierra al salir', () => {
    const { v, cerrar } = montar()
    v.mover('a', 0)
    vi.advanceTimersByTime(ESPERA_ABRIR_MS)
    v.soltar()
    v.mover(null, 0)
    vi.advanceTimersByTime(2000)
    expect(cerrar).not.toHaveBeenCalled()
  })

  it('un arrastre (botón pulsado) cierra la abierta al momento', () => {
    const { v, cerrar } = montar()
    v.mover('a', 0)
    vi.advanceTimersByTime(ESPERA_ABRIR_MS)
    v.pulsar()
    v.mover('a', 1)
    expect(cerrar).toHaveBeenCalledTimes(1)
  })

  it('pasar a otra cita cierra la primera y arma la segunda', () => {
    const { v, abrir, cerrar } = montar()
    v.mover('a', 0)
    vi.advanceTimersByTime(ESPERA_ABRIR_MS)
    v.mover('b', 0)
    vi.advanceTimersByTime(MARGEN_CERRAR_MS)
    expect(cerrar).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(ESPERA_ABRIR_MS - MARGEN_CERRAR_MS)
    expect(abrir).toHaveBeenLastCalledWith('b')
  })

  it('destruir no deja nada programado', () => {
    const { v, abrir } = montar()
    v.mover('a', 0)
    v.destruir()
    vi.advanceTimersByTime(3000)
    expect(abrir).not.toHaveBeenCalled()
  })
})

describe('la preferencia', () => {
  function almacen(inicial: Record<string, string> = {}): AlmacenTarjetaAlPasar & { datos: Record<string, string> } {
    const datos = { ...inicial }
    return { datos, getItem: (c) => datos[c] ?? null, setItem: (c, v) => { datos[c] = v } }
  }
  const roto: AlmacenTarjetaAlPasar = {
    getItem: () => { throw new Error('bloqueado') },
    setItem: () => { throw new Error('bloqueado') },
  }

  it('encendida por omisión, sin almacén y con almacén bloqueado', () => {
    expect(leerTarjetaAlPasar(almacen())).toBe(true)
    expect(leerTarjetaAlPasar(null)).toBe(true)
    expect(leerTarjetaAlPasar(roto)).toBe(true)
  })

  it('se apaga y se enciende, y un almacén bloqueado no rompe', () => {
    const a = almacen()
    guardarTarjetaAlPasar(a, false)
    expect(a.datos[CLAVE_TARJETA_AL_PASAR]).toBe('no')
    expect(leerTarjetaAlPasar(a)).toBe(false)
    guardarTarjetaAlPasar(a, true)
    expect(leerTarjetaAlPasar(a)).toBe(true)
    expect(() => guardarTarjetaAlPasar(roto, false)).not.toThrow()
  })
})
