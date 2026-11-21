import { describe, expect, it } from 'vitest'
import {
  bordeDeInsets, clasificarFormato, SCRIPT_SONDA_FORMATO, EVENTO_FORMATO,
  type Formato, type Insets, type Pantalla,
} from '@/lib/formatoPantalla'

/* Los cinco formatos de `kit/IMPLEMENTACION.md`, con sus franjas, más los
   bordes de cada corte. */
const CASOS: ReadonlyArray<[string, number, Insets, Formato]> = [
  ['Duo cerrado', 466, { top: 0, right: 84, bottom: 34, left: 0 }, 'ext'],
  ['iPhone vertical', 393, { top: 59, right: 0, bottom: 34, left: 0 }, 'tel'],
  ['Duo abierto horizontal', 951, { top: 0, right: 84, bottom: 34, left: 0 }, 'ih'],
  ['Duo abierto vertical', 669, { top: 82, right: 0, bottom: 0, left: 0 }, 'iv'],
  ['computadora', 1280, { top: 0, right: 0, bottom: 0, left: 0 }, 'esc'],
  ['Duo girado 180°', 466, { top: 0, right: 0, bottom: 34, left: 84 }, 'ext'],
  ['lateral justo en 700', 700, { top: 0, right: 84, bottom: 0, left: 0 }, 'ih'],
  ['lateral en 699', 699, { top: 0, right: 84, bottom: 0, left: 0 }, 'ext'],
  ['sin lateral en 599', 599, { top: 0, right: 0, bottom: 0, left: 0 }, 'tel'],
  ['sin lateral en 600', 600, { top: 0, right: 0, bottom: 0, left: 0 }, 'iv'],
  ['1023 con franja', 1023, { top: 0, right: 59, bottom: 0, left: 0 }, 'ih'],
  ['1024 con franja', 1024, { top: 0, right: 59, bottom: 0, left: 0 }, 'esc'],
]

const SIN: Insets = { top: 0, right: 0, bottom: 0, left: 0 }

/* El aparato real: con la franja a un lado, iOS la deja FUERA del viewport y
   los insets laterales valen 0; la franja se deduce de `window.screen`. */
const CASOS_PANTALLA: ReadonlyArray<[string, number, Insets, Pantalla, Formato, string]> = [
  ['Duo cerrado real', 382, SIN, { width: 466, height: 678 }, 'ext', 'derecha'],
  ['Duo abierto horizontal real', 867, SIN, { width: 669, height: 951 }, 'ih', 'derecha'],
  ['Duo abierto vertical real', 669, { top: 82, right: 0, bottom: 0, left: 0 }, { width: 669, height: 951 }, 'iv', 'arriba'],
  ['Duo cerrado con inset (emulado)', 466, { top: 0, right: 84, bottom: 34, left: 0 }, { width: 466, height: 678 }, 'ext', 'derecha'],
  ['Duo abierto horizontal con inset (emulado)', 951, { top: 0, right: 84, bottom: 34, left: 0 }, { width: 669, height: 951 }, 'ih', 'derecha'],
  ['iPhone vertical', 393, { top: 59, right: 0, bottom: 34, left: 0 }, { width: 393, height: 852 }, 'tel', 'arriba'],
  ['iPhone horizontal (cover)', 852, { top: 0, right: 59, bottom: 21, left: 59 }, { width: 393, height: 852 }, 'ih', 'derecha'],
  ['iPhone horizontal sin insets', 852, SIN, { width: 393, height: 852 }, 'iv', 'ninguno'],
  ['Android vertical', 412, SIN, { width: 412, height: 915 }, 'tel', 'ninguno'],
  ['Android horizontal', 915, SIN, { width: 915, height: 412 }, 'iv', 'ninguno'],
  ['computadora', 1440, SIN, { width: 1920, height: 1080 }, 'esc', 'ninguno'],
  ['computadora con ventana estrecha', 1000, SIN, { width: 1920, height: 1080 }, 'iv', 'ninguno'],
  ['computadora a 1840 en 1920', 1840, SIN, { width: 1920, height: 1080 }, 'esc', 'ninguno'],
  ['diferencia 59: no es franja', 407, SIN, { width: 466, height: 678 }, 'tel', 'ninguno'],
  ['diferencia 121: no es franja', 345, SIN, { width: 466, height: 678 }, 'tel', 'ninguno'],
  ['diferencia 60: franja', 406, SIN, { width: 466, height: 678 }, 'ext', 'derecha'],
  ['diferencia 120: franja', 346, SIN, { width: 466, height: 678 }, 'ext', 'derecha'],
]

interface Entorno { atributos: Map<string, string>; eventos: string[]; oyentes: string[] }

/** Corre la cadena de la sonda con un `document`/`window` mínimos de mentira. */
function correrSonda(ancho: number, i: Insets, previo?: Map<string, string>, pantalla?: Pantalla): Entorno {
  const atributos = previo ?? new Map<string, string>()
  const eventos: string[] = []
  const oyentes: string[] = []
  const html = {
    getAttribute: (n: string): string | null => atributos.get(n) ?? null,
    setAttribute: (n: string, v: string): void => { atributos.set(n, v) },
  }
  const sonda = { style: { cssText: '' }, parentNode: { removeChild: (): void => {} } }
  const documento = { documentElement: html, body: { appendChild: (): void => {} }, createElement: () => sonda }
  const ventana = {
    innerWidth: ancho,
    screen: pantalla,
    addEventListener: (n: string): void => { oyentes.push(n) },
    dispatchEvent: (e: { type: string }): void => { eventos.push(e.type) },
  }
  const estilo = () => ({
    paddingTop: `${i.top}px`, paddingRight: `${i.right}px`, paddingBottom: `${i.bottom}px`, paddingLeft: `${i.left}px`,
  })
  class EventoFalso { type: string; constructor(t: string) { this.type = t } }
  const correr = new Function('document', 'window', 'getComputedStyle', 'CustomEvent', 'requestAnimationFrame', SCRIPT_SONDA_FORMATO)
  correr(documento, ventana, estilo, EventoFalso, undefined)
  return { atributos, eventos, oyentes }
}

describe('formatoPantalla: la tabla de PLAN §2.5', () => {
  it.each(CASOS)('%s (%i px) → %s', (_n, ancho, insets, formato) => {
    expect(clasificarFormato(ancho, insets)).toBe(formato)
  })

  it('el borde: lateral antes que arriba; sin nada, «ninguno»', () => {
    expect(bordeDeInsets({ top: 0, right: 84, bottom: 34, left: 0 })).toBe('derecha')
    expect(bordeDeInsets({ top: 0, right: 0, bottom: 34, left: 84 })).toBe('izquierda')
    expect(bordeDeInsets({ top: 59, right: 0, bottom: 34, left: 0 })).toBe('arriba')
    expect(bordeDeInsets({ top: 0, right: 0, bottom: 34, left: 0 })).toBe('ninguno')
  })

  it.each(CASOS_PANTALLA)('con pantalla: %s (%i px) → %s, %s', (_n, ancho, insets, pantalla, formato, borde) => {
    expect(clasificarFormato(ancho, insets, pantalla)).toBe(formato)
    expect(bordeDeInsets(insets, ancho, pantalla)).toBe(borde)
  })
})

describe('formatoPantalla: la sonda en línea dice lo mismo que la función', () => {
  it.each(CASOS)('%s (%i px)', (_n, ancho, insets, formato) => {
    const { atributos, eventos } = correrSonda(ancho, insets)
    expect(atributos.get('data-formato')).toBe(formato)
    expect(atributos.get('data-borde-sistema')).toBe(bordeDeInsets(insets))
    expect(eventos).toEqual([EVENTO_FORMATO])
  })

  it.each(CASOS_PANTALLA)('con pantalla: %s (%i px)', (_n, ancho, insets, pantalla, formato, borde) => {
    const { atributos } = correrSonda(ancho, insets, undefined, pantalla)
    expect(atributos.get('data-formato')).toBe(formato)
    expect(atributos.get('data-borde-sistema')).toBe(borde)
  })

  it('escucha giro, redimensión y regreso a la página', () => {
    const { oyentes } = correrSonda(466, CASOS[0][2])
    expect(oyentes).toEqual(expect.arrayContaining(['resize', 'orientationchange', 'pageshow']))
  })

  it('si nada cambia, no reescribe ni avisa', () => {
    const previo = new Map([['data-formato', 'esc'], ['data-borde-sistema', 'ninguno']])
    const { eventos } = correrSonda(1280, { top: 0, right: 0, bottom: 0, left: 0 }, previo)
    expect(eventos).toEqual([])
  })

  it('no lanza aunque falte todo: va dentro de un try', () => {
    const correr = new Function('document', 'window', SCRIPT_SONDA_FORMATO)
    expect(() => correr(undefined, undefined)).not.toThrow()
  })
})
