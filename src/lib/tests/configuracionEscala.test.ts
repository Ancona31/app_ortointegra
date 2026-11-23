import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * B13 · AG9/AG10 (rediseño de la agenda; sustituye a la escala de la página de reserva de la tanda L, punto 12):
 * la letra de la configuración de la agenda (la página, sus pestañas y el asistente de primera vez) va en la
 * ESCALA DEL KIT, la de `src/app/sistema.css` (tipografía por rol y primitivas). La escala no se copia a mano: se
 * lee de esa hoja, y todo tamaño de letra que escriban los archivos que monta `/agenda/configuracion` tiene que
 * estar en ella. Ninguno por debajo de 12.
 *
 * Y las DOS ESCALAS DE TOQUE (tanda M, punto 2, ahora por FORMATO y no por ancho): la táctil (`ext`, `tel`, `iv`)
 * con controles de 44 o más, y la de computadora (`ih`, `esc`) con 36 o más, escrita como variantes `ih:` y `esc:`
 * (siempre las dos). Nada de `sm:`/`md:`/`lg:` en tamaños: desde 640 px la computadora alcanzaba al Duo abierto en
 * vertical (`iv`) y ahí TODOS los controles medían menos de 44.
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

function escalaDelKit(): Set<number> {
  const css = readFileSync(path.join(RAIZ, 'src/app/sistema.css'), 'utf8')
  return new Set([...css.matchAll(/font-size:\s*([\d.]+)px/g)].map(m => Number(m[1])))
}

/** Cada tamaño de letra que escribe un archivo, con su clase: `text-[17px]` → 17, `text-sm` → 14 (con o sin variante). */
function tamanosDe(fuente: string): { clase: string; px: number }[] {
  const arbitrarios = [...fuente.matchAll(/\btext-\[([\d.]+)px\]/g)].map(m => ({ clase: m[0], px: Number(m[1]) }))
  const tailwind = [...fuente.matchAll(/\btext-(xs|sm|base|lg|xl|2xl|3xl)\b/g)].map(m => ({ clase: m[0], px: TAILWIND[m[1]] }))
  // Lo que la escala no puede medir en píxeles (rem, em, clamp, `style={{ fontSize }}`) cuenta como fuera.
  const otros = [...fuente.matchAll(/\btext-\[(?![\d.]+px\])(?!var\()(?!#)[^\]]+\]|fontSize|font-size/g)].map(m => ({ clase: m[0], px: NaN }))
  return [...arbitrarios, ...tailwind, ...otros]
}

function lineasDeClases(fuente: string): string[] {
  return fuente.split('\n').filter(l => !/^\s*(\*|\/\/|\/\*)/.test(l))
}

/** Un tamaño escrito por ANCHO de ventana (`sm:text-…`, `md:h-…`, `lg:p-…`): la escala va por formato. */
const POR_ANCHO = /\b(?:sm|md|lg|xl):(?:text|min-h|h|p|px|py|pt|pb|pl|pr|gap|gap-x|gap-y)-\[/

/** Un control: lo que se pulsa (`cursor-pointer`, una primitiva `.k-b`/`.k-tab`), el enlace «Agenda» o un `<summary>`. */
const esControl = (l: string): boolean => /cursor-pointer|\bk-b\b|\bk-tab\b|<Link href="\/agenda"|<summary/.test(l)

/** Los altos de una línea por variante: `''` el de teléfono, `'ih'`, `'esc'`, `'iv'`. */
function altos(linea: string): { variante: string; px: number }[] {
  return [...linea.matchAll(/(?<![\w-])(?:(ih|iv|esc|ext|tel):)?(?:min-h|h)-\[(\d+)px\]/g)].map(m => ({ variante: m[1] ?? '', px: Number(m[2]) }))
}

/** Lo que falla en una línea de control: 44 en táctil; si lleva la escala de computadora, `ih:` y `esc:` con 36 o más. */
function fallosDeControl(linea: string): string[] {
  const a = altos(linea).filter(x => x.variante !== '' || x.px >= 40)
  if (!esControl(linea) || a.length === 0) return []
  const fallos: string[] = []
  const base = a.filter(x => x.variante === '' || x.variante === 'iv' || x.variante === 'ext' || x.variante === 'tel')
  if (base.some(x => x.px < 44)) fallos.push(`táctil ${base.map(x => x.px).join('/')} px de alto`)
  const ih = a.filter(x => x.variante === 'ih'); const esc = a.filter(x => x.variante === 'esc')
  if ([...ih, ...esc].some(x => x.px < 36)) fallos.push('computadora por debajo de 36')
  if ((ih.length > 0) !== (esc.length > 0)) fallos.push('la escala de computadora va en ih: y esc: a la vez')
  return fallos
}

describe('la escala de letra de la configuración de la agenda (B13 · AG9, la del kit)', () => {
  const escala = escalaDelKit()

  it('la hoja del kit da su escala, sin nada por debajo de 12', () => {
    expect([...escala].sort((a, b) => a - b)).toEqual([12, 13, 14, 15, 16, 17, 20, 26, 32])
  })

  it('lee los tamaños arbitrarios, los de Tailwind y los de cada formato', () => {
    expect(tamanosDe('a text-[17px] b text-sm esc:text-[20px] text-[var(--x)] text-[#fff]').map(t => t.px)).toEqual([17, 20, 14])
    expect(tamanosDe('text-[1.05rem] style={{ fontSize: 17 }}').map(t => t.clase)).toEqual(['text-[1.05rem]', 'fontSize'])
  })

  it.each(MONTADOS)('%s sólo usa tamaños de la escala del kit', archivo => {
    const fuera = tamanosDe(readFileSync(path.join(RAIZ, CARPETA, archivo), 'utf8')).filter(t => !escala.has(t.px))
    expect(fuera.map(t => t.clase)).toEqual([])
  })

  it('el bloque de la configuración en globals.css no escribe letra', () => {
    const css = readFileSync(path.join(RAIZ, 'src/app/globals.css'), 'utf8')
    const bloque = css.slice(css.indexOf('B13 · AG9/AG10 · CONFIGURACIÓN'), css.indexOf('AMPLIACIÓN DE LA HOJA DE TRADUCCIÓN'))
    expect(bloque.length).toBeGreaterThan(100)
    expect(bloque).not.toMatch(/font-size/)
  })
})

describe('las dos escalas de toque de la configuración (por formato: táctil 44, computadora 36)', () => {
  it('lee los controles', () => {
    expect(fallosDeControl('k-b k-b-prim h-[44px] ih:h-[36px] esc:h-[36px]')).toEqual([])
    expect(fallosDeControl('k-b h-[40px] ih:h-[36px] esc:h-[36px]')).toEqual(['táctil 40 px de alto'])
    expect(fallosDeControl('cursor-pointer min-h-[44px] ih:min-h-[36px]')).toEqual(['la escala de computadora va en ih: y esc: a la vez'])
    expect(fallosDeControl('cursor-pointer h-[44px] ih:h-[32px] esc:h-[32px]')).toEqual(['computadora por debajo de 36'])
    expect(fallosDeControl('cursor-pointer h-[44px] iv:h-[40px]')).toEqual(['táctil 44/40 px de alto'])
    expect(fallosDeControl('h-[30px] w-[52px] cursor-pointer')).toEqual([])
    expect(POR_ANCHO.test('min-h-[44px] sm:min-h-[40px]')).toBe(true)
    expect(POR_ANCHO.test('min-h-[44px] esc:min-h-[40px]')).toBe(false)
  })

  it.each(MONTADOS)('%s: ningún tamaño por ancho de ventana (sm:, md:…)', archivo => {
    const fuera = lineasDeClases(readFileSync(path.join(RAIZ, CARPETA, archivo), 'utf8')).filter(l => POR_ANCHO.test(l)).map(l => l.trim().slice(0, 90))
    expect(fuera).toEqual([])
  })

  it.each(MONTADOS)('%s: controles de 44 en táctil y de 36 o más en ih/esc', archivo => {
    const fallos = lineasDeClases(readFileSync(path.join(RAIZ, CARPETA, archivo), 'utf8'))
      .flatMap(l => fallosDeControl(l).map(f => `${f}: ${l.trim().slice(0, 90)}`))
    expect(fallos).toEqual([])
  })

  it('los botones de la configuración llevan las dos escalas', () => {
    const fuente = readFileSync(path.join(RAIZ, CARPETA, 'estilosConfig.ts'), 'utf8')
    for (const nombre of ['BOTON_AZUL', 'BOTON_BLANCO', 'BOTON_CHICO', 'BOTON_TEXTO']) {
      const linea = fuente.split('\n').find(l => l.startsWith(`export const ${nombre} =`)) ?? ''
      expect(linea, nombre).toMatch(/(?<![\w:-])h-\[44px\]/)
      expect(linea, nombre).toMatch(/\bih:h-\[36px\]/)
      expect(linea, nombre).toMatch(/\besc:h-\[36px\]/)
    }
  })

  it('el interruptor deja 46 px de toque en táctil (30 de dibujo + 8 fuera) y 40 en ih/esc', () => {
    const linea = readFileSync(path.join(RAIZ, CARPETA, 'Interruptor.tsx'), 'utf8').split('\n').find(l => l.includes('h-[30px]')) ?? ''
    expect(linea).toMatch(/(?<![:\w-])before:-inset-y-\[9px\]/)
    expect(linea).toMatch(/\bih:before:-inset-y-\[6px\]/)
    expect(linea).toMatch(/\besc:before:-inset-y-\[6px\]/)
    expect(linea).not.toMatch(/\bsm:/)
  })
})
