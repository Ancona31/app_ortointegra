import { describe, expect, it } from 'vitest'
import { desplazarListaAHoy, desplazarListaAHoyEstable, type DestinoLista, type RaizLista } from '@/lib/agenda/listaHoy'

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
    expect(desplazarListaAHoy(l.raiz, '2026-11-11')).toBe('hoy')
    expect(l.cabeceraArriba(2)).toBe(0)
  })

  /* H5 (AG-DT-69) · el domingo, con la semana ya pasada, no hay cabecera de hoy
     ni posterior: antes no movía nada y la lista abría en el LUNES (el defecto
     que F1.12 quitó). Ahora va al fondo, lo más cerca de hoy, y termina; repite
     mientras la lista crece, como con hoy al final.
     MUTACIÓN: devolver `false` sin mover cuando no hay destino → rojo. */
  it('sin un día de hoy o posterior (el domingo), al fondo de verdad, y termina', () => {
    const l = listaQueCrece(DIAS, 5)
    const cuadros: (() => void)[] = []
    let fin: DestinoLista | null = null
    desplazarListaAHoyEstable(l.raiz, '2026-11-15', r => { fin = r }, f => { cuadros.push(f) })
    l.crecer()
    while (cuadros.length) cuadros.shift()?.()
    expect(fin).toBe('fondo')
    expect(l.alFondo()).toBe(true)
  })

  /* H5 · con una fuente aún por llegar (Google), el fondo no se escribe: no toca
     la lista y queda pendiente, para no tironear después de quien se desplazó.
     MUTACIÓN: ignorar `alFondo` → rojo. */
  it('sin día de hoy en adelante y sin permiso para el fondo, no toca nada y queda pendiente', () => {
    const l = listaQueCrece(DIAS, 5)
    let fin: DestinoLista | null = null
    desplazarListaAHoyEstable(l.raiz, '2026-11-15', r => { fin = r }, f => f(), false)
    expect(fin).toBe(false)
    expect(l.cabeceraArriba(0)).toBe(0)
  })

  it('sin ninguna cabecera todavía, no mueve nada y queda pendiente', () => {
    const l = listaQueCrece([], 5)
    let fin: DestinoLista | null = null
    desplazarListaAHoyEstable(l.raiz, '2026-11-15', r => { fin = r }, f => f())
    expect(fin).toBe(false)
  })

  it('con hoy al final y la lista creciendo tras el primer cuadro, repite hasta el fondo de verdad', () => {
    const l = listaQueCrece(DIAS, 5)
    const cuadros: (() => void)[] = []
    let llego: DestinoLista = false
    desplazarListaAHoyEstable(l.raiz, '2026-11-14', r => { llego = r }, f => { cuadros.push(f) })
    l.crecer()
    while (cuadros.length) cuadros.shift()?.()
    expect(llego).toBe('hoy')
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
