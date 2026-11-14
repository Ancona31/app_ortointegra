import { describe, expect, it } from 'vitest'
import { desplazarListaAHoy, desplazarListaAHoyEstable, type RaizLista } from '@/lib/agenda/listaHoy'

/**
 * F1.12 · la lista de Semana del teléfono abre en hoy. Una lista de mentira con
 * lo que hace el navegador: el `scrollTop` se recorta al alto de ESE momento.
 * Las cabeceras de día crecen de 17 a 38 px en el segundo cuadro (medido el
 * 2026-11-14), así que con hoy cerca del final la primera vuelta se queda corta.
 */
function listaQueCrece(dias: string[], filasPorDia: number) {
  const visible = 649
  let altoCabecera = 17
  let scrollTop = 0
  const altoFila = 44
  const posDe = (i: number): number => i * (altoCabecera + filasPorDia * altoFila)
  const alto = (): number => posDe(dias.length)
  const desplazador = {
    get scrollTop() { return scrollTop },
    set scrollTop(v: number) { scrollTop = Math.max(0, Math.min(v, alto() - visible)) },
    get scrollHeight() { return alto() },
    getBoundingClientRect: () => ({ top: 100 }),
  }
  const cabeceras = dias.map((d, i) => ({
    getAttribute: (n: string) => (n === 'data-date' ? d : null),
    getBoundingClientRect: () => ({ top: 100 + posDe(i) - scrollTop }),
  }))
  const raiz: RaizLista = {
    querySelector: () => desplazador,
    querySelectorAll: () => cabeceras,
  }
  const cabeceraArriba = (i: number): number => cabeceras[i].getBoundingClientRect().top - 100
  const crecer = (): void => { altoCabecera = 38 }
  const alFondo = (): boolean => scrollTop >= alto() - visible
  return { raiz, cabeceraArriba, crecer, alFondo }
}

const DIAS = ['2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14']

describe('F1.12 · desplazar la lista de Semana a hoy', () => {
  it('a hoy, de una vez, si la lista ya tiene su alto', () => {
    const l = listaQueCrece(DIAS, 5)
    expect(desplazarListaAHoy(l.raiz, '2026-11-11')).toBe(true)
    expect(l.cabeceraArriba(2)).toBe(0)
  })

  it('sin un día de hoy o posterior, no mueve nada (y queda pendiente)', () => {
    const l = listaQueCrece(DIAS, 5)
    let fin: boolean | null = null
    desplazarListaAHoyEstable(l.raiz, '2026-11-20', r => { fin = r }, f => f())
    expect(fin).toBe(false)
  })

  it('con hoy al final y la lista creciendo tras el primer cuadro, repite hasta el fondo de verdad', () => {
    const l = listaQueCrece(DIAS, 5)
    const cuadros: (() => void)[] = []
    let llego = false
    desplazarListaAHoyEstable(l.raiz, '2026-11-14', r => { llego = r }, f => { cuadros.push(f) })
    l.crecer()
    while (cuadros.length) cuadros.shift()?.()
    expect(llego).toBe(true)
    // El sábado no puede subir del todo (no hay más lista): la lista queda en su fondo REAL.
    expect(l.alFondo()).toBe(true)
  })

  it('una sola vuelta (lo de antes) se queda a medio camino: es el defecto', () => {
    const l = listaQueCrece(DIAS, 5)
    desplazarListaAHoy(l.raiz, '2026-11-14')
    l.crecer()
    expect(l.alFondo()).toBe(false)
  })
})
