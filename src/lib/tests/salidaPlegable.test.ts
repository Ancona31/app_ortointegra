import { describe, expect, it } from 'vitest'
import { destinoFuera, focoPliega, SELECTOR_CAPAS, type Destino } from '@/components/documentos/salidaPlegable'

/** Un nodo de mentira: su nombre y los selectores de capa que lo contienen. */
const nodo = (nombre: string, capa = false): Destino & { nombre: string } =>
  ({ nombre, closest: (sel: string) => (capa && sel === SELECTOR_CAPAS ? {} : null) })
const seccion = new Set(['label-casilla', 'casilla', 'parrafo'])
const dentro = (t: { nombre: string }) => seccion.has(t.nombre)

describe('destinoFuera', () => {
  it('lo de la sección (también el texto de una casilla) no está fuera', () => {
    expect(destinoFuera(nodo('label-casilla'), dentro)).toBe(false)
    expect(destinoFuera(nodo('parrafo'), dentro)).toBe(false)
  })
  it('lo de fuera sí, salvo que sea una capa o abra una', () => {
    expect(destinoFuera(nodo('titulo-de-la-pagina'), dentro)).toBe(true)
    expect(destinoFuera(nodo('menu-plantillas', true), dentro)).toBe(false)
  })
  it('sin destino, no pliega', () => {
    expect(destinoFuera<ReturnType<typeof nodo>>(null, dentro)).toBe(false)
  })
  it('las capas incluyen lo que abre una (aria-haspopup)', () => {
    expect(SELECTOR_CAPAS).toContain('[aria-haspopup]')
    expect(SELECTOR_CAPAS).toContain('[role="listbox"]')
  })
})

describe('focoPliega — el defecto del texto de la casilla', () => {
  it('con el puntero pulsado, el foco que se va al panel de fuera NO pliega', () => {
    // pointerdown en el <label>: el navegador enfoca el panel (tabIndex −1), fuera.
    expect(focoPliega(true, true)).toBe(false)
  })
  it('con el teclado (Tab que sale), sí pliega', () => {
    expect(focoPliega(false, true)).toBe(true)
    expect(focoPliega(false, false)).toBe(false)
  })
})
