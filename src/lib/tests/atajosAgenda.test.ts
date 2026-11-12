import { describe, expect, it } from 'vitest'
import {
  accionDeTecla, ATAJOS, CLAVE_ATAJOS, esObjetivoEditable, guardarAtajosEncendidos, leerAtajosEncendidos,
  teclasDeAccion, type AlmacenPreferencia, type TeclaPulsada,
} from '@/lib/agenda/atajosAgenda'

/* Un objetivo de tecla de juguete. `EventTarget` sólo pide sus tres métodos. */
function objetivo(extra: Record<string, unknown>): EventTarget {
  return { addEventListener: () => undefined, removeEventListener: () => undefined, dispatchEvent: () => true, ...extra }
}

const CUERPO = objetivo({ tagName: 'BODY', isContentEditable: false })

function tecla(key: string, extra: Partial<TeclaPulsada> = {}): TeclaPulsada {
  return { key, ctrlKey: false, altKey: false, metaKey: false, isComposing: false, target: CUERPO, ...extra }
}

describe('accionDeTecla', () => {
  it('cada tecla de la tabla da su acción', () => {
    expect(accionDeTecla(tecla('t'), false)).toBe('hoy')
    expect(accionDeTecla(tecla('j'), false)).toBe('siguiente')
    expect(accionDeTecla(tecla('n'), false)).toBe('siguiente')
    expect(accionDeTecla(tecla('k'), false)).toBe('anterior')
    expect(accionDeTecla(tecla('p'), false)).toBe('anterior')
    expect(accionDeTecla(tecla('d'), false)).toBe('vista-dia')
    expect(accionDeTecla(tecla('s'), false)).toBe('vista-semana')
    expect(accionDeTecla(tecla('m'), false)).toBe('vista-mes')
    expect(accionDeTecla(tecla('c'), false)).toBe('agendar')
  })
  it('/ y ? valen con Mayús, que es como salen en el teclado español', () => {
    expect(accionDeTecla(tecla('/'), false)).toBe('buscar')
    expect(accionDeTecla(tecla('?'), false)).toBe('ayuda')
  })
  it('con Ctrl, Alt o Meta no actúa (AltGr llega como Ctrl+Alt)', () => {
    expect(accionDeTecla(tecla('t', { ctrlKey: true }), false)).toBeNull()
    expect(accionDeTecla(tecla('t', { altKey: true }), false)).toBeNull()
    expect(accionDeTecla(tecla('t', { metaKey: true }), false)).toBeNull()
  })
  it('durante una composición no actúa', () => {
    expect(accionDeTecla(tecla('t', { isComposing: true }), false)).toBeNull()
  })
  it('MUTACIÓN: con el foco en un campo editable no actúa', () => {
    for (const tagName of ['INPUT', 'SELECT', 'TEXTAREA', 'input']) {
      expect(accionDeTecla(tecla('j', { target: objetivo({ tagName }) }), false)).toBeNull()
    }
    expect(accionDeTecla(tecla('j', { target: objetivo({ tagName: 'DIV', isContentEditable: true }) }), false)).toBeNull()
  })
  it('con una capa abierta no actúa', () => {
    expect(accionDeTecla(tecla('t'), true)).toBeNull()
  })
  it('una tecla fuera de la tabla, o en mayúscula, no hace nada', () => {
    expect(accionDeTecla(tecla('x'), false)).toBeNull()
    expect(accionDeTecla(tecla('T'), false)).toBeNull()
  })
})

describe('esObjetivoEditable', () => {
  it('sin objetivo, o un objetivo sin etiqueta, no es editable', () => {
    expect(esObjetivoEditable(null)).toBe(false)
    expect(esObjetivoEditable(objetivo({}))).toBe(false)
    expect(esObjetivoEditable(CUERPO)).toBe(false)
  })
})

describe('teclasDeAccion y la tabla', () => {
  it('compone el valor de aria-keyshortcuts', () => {
    expect(teclasDeAccion('siguiente')).toBe('J N')
    expect(teclasDeAccion('hoy')).toBe('T')
  })
  it('ninguna tecla está repetida entre dos acciones', () => {
    const todas = ATAJOS.flatMap(a => a.teclas)
    expect(new Set(todas).size).toBe(todas.length)
  })
})

describe('la preferencia', () => {
  function almacen(inicial: Record<string, string> = {}): AlmacenPreferencia & { datos: Record<string, string> } {
    const datos = { ...inicial }
    return { datos, getItem: k => datos[k] ?? null, setItem: (k, v) => { datos[k] = v } }
  }
  it('encendidos por omisión, también sin almacén', () => {
    expect(leerAtajosEncendidos(almacen())).toBe(true)
    expect(leerAtajosEncendidos(null)).toBe(true)
  })
  it('apagar se guarda y se lee', () => {
    const a = almacen()
    guardarAtajosEncendidos(a, false)
    expect(a.datos[CLAVE_ATAJOS]).toBe('no')
    expect(leerAtajosEncendidos(a)).toBe(false)
  })
  it('un almacén que lanza (modo privado) no rompe', () => {
    const roto: AlmacenPreferencia = { getItem: () => { throw new Error('x') }, setItem: () => { throw new Error('x') } }
    expect(leerAtajosEncendidos(roto)).toBe(true)
    expect(() => guardarAtajosEncendidos(roto, false)).not.toThrow()
  })
})
