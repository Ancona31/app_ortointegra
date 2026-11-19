import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Tanda L, punto 12 de Angel: la letra de la configuración de la agenda (la página, sus pestañas y el
 * funnel) va en la MISMA escala que la página de reserva por enlace. La escala no se copia a mano: se lee
 * de la hoja de la reserva (`agendaPublica.css`), y todo tamaño de letra que escriban los archivos que
 * monta `/agenda/configuracion` tiene que estar en ella. Ningún 17, 19, 21, 22, 30 ni 32 de las maquetas.
 */
const RAIZ = path.resolve(__dirname, '../../..')
const CARPETA = 'src/components/agenda/configuracion'

/** Lo que pinta la configuración nueva (no la pantalla vieja `ConfiguracionCalendario`, sin montar). */
const MONTADOS = [
  'AvisoGuardado.tsx', 'BloqueEnlacesMedico.tsx', 'BloquesAvisos.tsx', 'BotonCopiar.tsx', 'CierrePrimeraVez.tsx', 'ConfiguracionAgenda.tsx',
  'ConfirmacionRestablecer.tsx', 'CrearEnlaceUnaVez.tsx', 'DialogoHorario.tsx', 'DuracionConsulta.tsx', 'DuracionEnConsultorio.tsx', 'EditorDias.tsx', 'EnlacesDeOtros.tsx',
  'FaltaParaEnlace.tsx', 'FilaEnlaceReserva.tsx', 'FormTipoCita.tsx',
  'Interruptor.tsx', 'PasoClinica.tsx', 'PasoDuracion.tsx', 'PasoHorario.tsx', 'PestanaConsulta.tsx', 'PestanaEnlace.tsx',
  'PestanaHorario.tsx', 'PestanaMasOpciones.tsx', 'PestanasConfiguracion.tsx', 'PrimeraVez.tsx', 'SelectorHuso.tsx',
  'estilosConfig.ts',
] as const

/** Las clases de tamaño de Tailwind, en píxeles (1rem = 16 px). */
const TAILWIND: Record<string, number> = { xs: 12, sm: 14, base: 16, lg: 18, xl: 20, '2xl': 24, '3xl': 30 }

function escalaDeLaReserva(): Set<number> {
  const css = readFileSync(path.join(RAIZ, 'src/components/agendaPublica/agendaPublica.css'), 'utf8')
  return new Set([...css.matchAll(/font-size:\s*([\d.]+)px/g)].map(m => Number(m[1])))
}

/** Cada tamaño de letra que escribe un archivo, con su clase: `text-[17px]` → 17, `text-sm` → 14. */
function tamanosDe(fuente: string): { clase: string; px: number }[] {
  const arbitrarios = [...fuente.matchAll(/\btext-\[([\d.]+)px\]/g)].map(m => ({ clase: m[0], px: Number(m[1]) }))
  const tailwind = [...fuente.matchAll(/\btext-(xs|sm|base|lg|xl|2xl|3xl)\b/g)].map(m => ({ clase: m[0], px: TAILWIND[m[1]] }))
  // Lo que la escala no puede medir en píxeles (rem, em, clamp, `style={{ fontSize }}`) cuenta como fuera.
  const otros = [...fuente.matchAll(/\btext-\[(?![\d.]+px\])(?!var\()(?!#)[^\]]+\]|fontSize|font-size/g)].map(m => ({ clase: m[0], px: NaN }))
  return [...arbitrarios, ...tailwind, ...otros]
}

describe('la escala de letra de la configuración de la agenda (tanda L, punto 12)', () => {
  const escala = escalaDeLaReserva()

  it('la hoja de la reserva da la escala de siempre', () => {
    expect([...escala].sort((a, b) => a - b)).toEqual([10.5, 11, 13, 13.5, 14, 15, 16, 18, 20, 24, 28])
  })

  it('lee los tamaños arbitrarios y los de Tailwind', () => {
    expect(tamanosDe('a text-[17px] b text-sm sm:text-[20px] text-[var(--x)] text-[#fff]').map(t => t.px)).toEqual([17, 20, 14])
    expect(tamanosDe('text-[1.05rem] style={{ fontSize: 17 }}').map(t => t.clase)).toEqual(['text-[1.05rem]', 'fontSize'])
  })

  it.each(MONTADOS)('%s sólo usa tamaños de la escala de la reserva', archivo => {
    const fuera = tamanosDe(readFileSync(path.join(RAIZ, CARPETA, archivo), 'utf8')).filter(t => !escala.has(t.px))
    expect(fuera.map(t => t.clase)).toEqual([])
  })
})

/**
 * Tanda M, punto 2 de Angel: en computadora (desde `sm`, 640 px) «títulos de sección 16 px, texto 13–14 px,
 * botones 13 px de letra y 40 px de alto, y los rellenos reducidos en proporción. En el teléfono, como está.»
 * Se mira línea a línea (cada clase va en una línea): lo de computadora es la variante `sm:` y, si no la hay,
 * la de teléfono. Lo de teléfono no se toca: sus controles siguen en 44 o más.
 */
const ESCRITORIO = new Set([11, 13, 14, 16, 18])
const PROPS_RELLENO = '(?:gap-x|gap-y|gap|px|py|pt|pb|pl|pr|p)'
/** Los rellenos del teléfono que ya tenían su propio número en computadora: se escala ese, no el del teléfono. */
const RELLENO_YA_DISTINTO: Record<string, Record<string, number>> = {
  'estilosConfig.ts': { 'p-[20px]': 24 }, // PANEL: 28 → 24
  // El diálogo: margen 24 → 20; cabecera, cuerpo y pie 28 → 24 a los lados; cabecera 20 → 16 arriba y abajo.
  'DialogoHorario.tsx': { 'p-[16px]': 20, 'px-[20px]': 24, 'py-[16px]': 16 },
}

/** 48 → 40: la proporción de los botones, al par más cercano. */
const escalado = (v: number): number => Math.round(v * 5 / 6 / 2) * 2

function lineasDeClases(fuente: string): string[] {
  return fuente.split('\n').filter(l => !/^\s*(\*|\/\/|\/\*)/.test(l))
}

/** La letra que ve la computadora en una línea: las `sm:text-[N]`, o las del teléfono si no hay. */
function letraEscritorio(linea: string): number[] {
  const sm = [...linea.matchAll(/\bsm:text-\[([\d.]+)px\]/g)].map(m => Number(m[1]))
  return sm.length ? sm : [...linea.matchAll(/(?<![:\w-])text-\[([\d.]+)px\]/g)].map(m => Number(m[1]))
}

/** Un control: lo que se pulsa (`cursor-pointer`), el enlace «Agenda» o un `<summary>`. */
const esControl = (l: string): boolean => /cursor-pointer|<Link href="\/agenda"|<summary/.test(l)

/** Lo que falla en una línea de control: alto 40 y letra 13 en computadora, 44 o más en el teléfono. */
function fallosDeControl(linea: string): string[] {
  // `min-h-[N]` o un alto fijo de control (`h-[44px]`, la ✕ del diálogo); el interruptor (`h-[30px]`) va aparte.
  const alto = [...linea.matchAll(/(?<![:\w-])(min-h|h)-\[(\d+)px\]/g)].filter(m => m[1] === 'min-h' || Number(m[2]) >= 44)
  if (!esControl(linea) || alto.length === 0) return []
  const fallos: string[] = []
  if (alto.some(m => Number(m[2]) < 44)) fallos.push(`teléfono ${alto.map(m => m[2]).join('/')} px de alto`)
  if (alto.some(m => !new RegExp(`\\bsm:${m[1]}-\\[40px\\]`).test(linea))) fallos.push('sin sm:min-h-[40px]')
  const letra = linea.match(/(?<![:\w-])text-\[([\d.]+)px\]/)
  if (letra && !/\bsm:text-\[13px\]/.test(linea)) fallos.push('sin sm:text-[13px]')
  return fallos
}

/** Lo que falla en los rellenos de una línea: cada uno de 14 o más, con su `sm:` reducido en proporción. */
function fallosDeRelleno(linea: string, yaDistinto: Record<string, number> = {}): string[] {
  const base = [...linea.matchAll(new RegExp(`(?<![\\w:\\-\\[])(${PROPS_RELLENO})-\\[(\\d+)px\\]`, 'g'))]
  return base.flatMap(m => {
    const v = Number(m[2])
    if (v < 14) return []
    const sm = linea.match(new RegExp(`\\bsm:${m[1]}-\\[(\\d+)px\\]`))
    const esperado = sm && yaDistinto[m[0]] === Number(sm[1]) ? yaDistinto[m[0]] : escalado(v)
    return sm && Number(sm[1]) === esperado ? [] : [`${m[0]} → sm:${m[1]}-[${esperado}px] (hay ${sm?.[0] ?? 'nada'})`]
  })
}

describe('la escala de computadora de la configuración (tanda M, punto 2)', () => {
  it('lee la letra, los controles y los rellenos', () => {
    expect(letraEscritorio('text-[15px] sm:text-[14px]')).toEqual([14])
    expect(letraEscritorio('text-[13.5px] font-semibold')).toEqual([13.5])
    expect(fallosDeControl('min-h-[44px] cursor-pointer text-[15px]')).toEqual(['sin sm:min-h-[40px]', 'sin sm:text-[13px]'])
    expect(fallosDeControl('min-h-[40px] sm:min-h-[40px] cursor-pointer text-[16px] sm:text-[13px]')).toEqual(['teléfono 40 px de alto'])
    expect(fallosDeControl('min-h-[44px] sm:min-h-[40px] cursor-pointer text-[14px] sm:text-[13px]')).toEqual([])
    expect(fallosDeControl('h-[44px] w-[44px] cursor-pointer')).toEqual(['sin sm:min-h-[40px]'])
    expect(fallosDeControl('h-[44px] sm:h-[40px] cursor-pointer')).toEqual([])
    expect(fallosDeControl('h-[30px] w-[52px] cursor-pointer')).toEqual([])
    expect(fallosDeRelleno('gap-[18px] px-[10px] py-[22px] sm:py-[20px]')).toEqual([
      'gap-[18px] → sm:gap-[16px] (hay nada)', 'py-[22px] → sm:py-[18px] (hay sm:py-[20px])'])
    expect(fallosDeRelleno('p-[20px] sm:p-[24px] px-[32px] sm:px-[26px]', { 'p-[20px]': 24 })).toEqual([])
    expect(fallosDeRelleno('p-[20px] sm:p-[24px]')).toEqual(['p-[20px] → sm:p-[16px] (hay sm:p-[24px])'])
  })

  it.each(MONTADOS)('%s: letra de computadora en 11, 13, 14, 16 o 18', archivo => {
    const fuera = lineasDeClases(readFileSync(path.join(RAIZ, CARPETA, archivo), 'utf8'))
      .flatMap(l => letraEscritorio(l).filter(px => !ESCRITORIO.has(px)).map(px => `${px} px en: ${l.trim().slice(0, 90)}`))
    expect(fuera).toEqual([])
  })

  it.each(MONTADOS)('%s: controles de 40 px y 13 px en computadora, 44 o más en el teléfono', archivo => {
    const fallos = lineasDeClases(readFileSync(path.join(RAIZ, CARPETA, archivo), 'utf8'))
      .flatMap(l => fallosDeControl(l).map(f => `${f}: ${l.trim().slice(0, 90)}`))
    expect(fallos).toEqual([])
  })

  it.each(MONTADOS)('%s: rellenos de computadora reducidos en proporción', archivo => {
    const fallos = lineasDeClases(readFileSync(path.join(RAIZ, CARPETA, archivo), 'utf8'))
      .flatMap(l => fallosDeRelleno(l, RELLENO_YA_DISTINTO[archivo]))
    expect(fallos).toEqual([])
  })

  it('el interruptor deja 40 px de toque en computadora (30 de dibujo + 5 fuera del borde) y 46 en el teléfono', () => {
    const linea = readFileSync(path.join(RAIZ, CARPETA, 'Interruptor.tsx'), 'utf8').split('\n').find(l => l.includes('h-[30px]')) ?? ''
    expect(linea).toMatch(/(?<![:\w-])before:-inset-y-\[9px\]/)
    expect(linea).toMatch(/\bsm:before:-inset-y-\[6px\]/)
  })
})
