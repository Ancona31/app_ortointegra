import { describe, expect, it, vi } from 'vitest'
import { manejarTeclaAtajo, type EventoTecla } from '@/app/(app)/agenda/useAtajosAgenda'

const CUERPO: EventTarget = { addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => true }

function tecla(key: string, extra: Partial<EventoTecla> = {}): EventoTecla & { prevenida: boolean } {
  const e = {
    key, ctrlKey: false, altKey: false, metaKey: false, isComposing: false, target: CUERPO,
    defaultPrevented: false, repeat: false, prevenida: false,
    preventDefault() { e.prevenida = true },
    ...extra,
  }
  return e
}

describe('manejarTeclaAtajo', () => {
  it('un atajo se consume y llama a la acción', () => {
    const alAccion = vi.fn()
    const e = tecla('t')
    expect(manejarTeclaAtajo(e, false, alAccion)).toBe('hoy')
    expect(alAccion).toHaveBeenCalledWith('hoy')
    expect(e.prevenida).toBe(true)
  })
  it('una tecla que no es atajo no se consume', () => {
    const alAccion = vi.fn()
    const e = tecla('x')
    expect(manejarTeclaAtajo(e, false, alAccion)).toBeNull()
    expect(e.prevenida).toBe(false)
    expect(alAccion).not.toHaveBeenCalled()
  })
  it('la repetición de tecla y lo ya consumido por otro se ignoran', () => {
    const alAccion = vi.fn()
    expect(manejarTeclaAtajo(tecla('j', { repeat: true }), false, alAccion)).toBeNull()
    expect(manejarTeclaAtajo(tecla('j', { defaultPrevented: true }), false, alAccion)).toBeNull()
    expect(alAccion).not.toHaveBeenCalled()
  })
  it('con una capa abierta no hace nada', () => {
    const alAccion = vi.fn()
    expect(manejarTeclaAtajo(tecla('t'), true, alAccion)).toBeNull()
    expect(alAccion).not.toHaveBeenCalled()
  })
})
