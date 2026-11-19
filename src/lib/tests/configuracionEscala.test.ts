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
