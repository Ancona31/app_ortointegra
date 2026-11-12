import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  curvaToken, duracionMovimiento, duracionToken, esCambioDeFecha, fundirNavegacion, incumplimientosDeMovimiento,
  interpretarDuracion, prefiereMenosMovimiento, type AnimacionObservada,
} from '@/lib/agenda/movimientoAgenda'

/** Simula un navegador mínimo: tokens en la raíz y la preferencia de movimiento. */
function navegador(tokens: Record<string, string>, reducido = false): void {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: reducido }) })
  vi.stubGlobal('document', { documentElement: {} })
  vi.stubGlobal('getComputedStyle', () => ({ getPropertyValue: (k: string) => tokens[k] ?? '' }))
}

afterEach(() => { vi.unstubAllGlobals() })

describe('interpretarDuracion', () => {
  it('lee ms y s, con o sin cero delante', () => {
    expect(interpretarDuracion('120ms')).toBe(120)
    expect(interpretarDuracion(' .18s ')).toBe(180)
    expect(interpretarDuracion('0.01ms')).toBe(0.01)
  })
  it('devuelve null con lo que no es una duración', () => {
    expect(interpretarDuracion('')).toBeNull()
    expect(interpretarDuracion('rápido')).toBeNull()
    expect(interpretarDuracion('120')).toBeNull()
  })
})

describe('duracionToken y curvaToken', () => {
  it('sin navegador cae a los respaldos, que son la escala de la hoja', () => {
    expect(duracionToken('--ag-dur-micro')).toBe(120)
    expect(duracionToken('--ag-dur-base')).toBe(180)
    expect(duracionToken('--ag-dur-lento')).toBe(240)
    expect(curvaToken('--ag-ease')).toBe('cubic-bezier(.4, 0, .2, 1)')
  })
  it('con navegador lee el token computado', () => {
    navegador({ '--ag-dur-base': '200ms', '--ag-ease-out': 'linear' })
    expect(duracionToken('--ag-dur-base')).toBe(200)
    expect(curvaToken('--ag-ease-out')).toBe('linear')
  })
  it('un token ilegible no devuelve NaN: vuelve al respaldo', () => {
    navegador({ '--ag-dur-micro': 'nada' })
    expect(duracionToken('--ag-dur-micro')).toBe(120)
  })
})

describe('prefiereMenosMovimiento y duracionMovimiento', () => {
  it('sin window contesta que no', () => {
    expect(prefiereMenosMovimiento()).toBe(false)
  })
  it('con reduce la duración efectiva es 0', () => {
    navegador({ '--ag-dur-micro': '120ms' }, true)
    expect(prefiereMenosMovimiento()).toBe(true)
    expect(duracionMovimiento('--ag-dur-micro')).toBe(0)
  })
  it('sin reduce la duración efectiva es la del token', () => {
    navegador({ '--ag-dur-micro': '120ms' })
    expect(duracionMovimiento('--ag-dur-micro')).toBe(120)
  })
})

describe('incumplimientosDeMovimiento', () => {
  const buena: AnimacionObservada = { nombre: 'ag-entra', propiedades: ['opacity', 'transform'], duracionMs: 180, elemento: 'a.fc-event' }

  it('acepta opacidad y transform dentro del tope', () => {
    expect(incumplimientosDeMovimiento([buena])).toEqual([])
  })
  it('MUTACIÓN: una transición de width sembrada sale como incumplimiento', () => {
    const ancho: AnimacionObservada = { nombre: 'width', propiedades: ['width'], duracionMs: 120, elemento: 'div.ag-x' }
    const salida = incumplimientosDeMovimiento([buena, ancho])
    expect(salida).toHaveLength(1)
    expect(salida[0]).toContain('anima width')
  })
  it('lo que dura más de 240 ms incumple, aunque sólo anime opacidad', () => {
    const larga: AnimacionObservada = { ...buena, nombre: 'ag-pulso', duracionMs: 900 }
    expect(incumplimientosDeMovimiento([larga])[0]).toContain('dura 900 ms')
  })
  it('las excepciones son los dos bucles de carga: la barra y el giro del «guardando»', () => {
    const bucle: AnimacionObservada = { nombre: 'ag-barra-carga', propiedades: ['transform'], duracionMs: 1100, elemento: 'div' }
    const giro: AnimacionObservada = { nombre: 'spin', propiedades: ['transform'], duracionMs: 1000, elemento: 'svg' }
    expect(incumplimientosDeMovimiento([bucle, giro])).toEqual([])
    expect(incumplimientosDeMovimiento([{ ...bucle, nombre: 'ag-pulso' }])).toHaveLength(1)
  })
  it('CONTRASTE §5: el fondo, el borde y la tinta del hover en micro cumplen', () => {
    const hover: AnimacionObservada = {
      nombre: 'background-color', propiedades: ['background-color', 'border-top-color', 'color'], duracionMs: 120, elemento: 'button.fc-next-button',
    }
    expect(incumplimientosDeMovimiento([hover])).toEqual([])
  })
  it('MUTACIÓN: el anillo de foco animado (`transition-all`: box-shadow, outline) incumple', () => {
    const foco: AnimacionObservada = { nombre: 'all', propiedades: ['box-shadow', 'outline-width'], duracionMs: 150, elemento: 'input' }
    expect(incumplimientosDeMovimiento([foco])[0]).toContain('anima box-shadow, outline-width')
  })
  it('un color por encima del tope incumple igual', () => {
    expect(incumplimientosDeMovimiento([{ ...buena, propiedades: ['background-color'], duracionMs: 300 }])).toHaveLength(1)
  })
  it('lo que no es de la agenda (la barra lateral, los avisos de la app) no cuenta; sin el campo, sí', () => {
    const ajena: AnimacionObservada = { nombre: 'avisoHalo', propiedades: ['box-shadow'], duracionMs: 2800, elemento: 'div', deLaAgenda: false }
    expect(incumplimientosDeMovimiento([ajena])).toEqual([])
    expect(incumplimientosDeMovimiento([{ ...ajena, deLaAgenda: undefined }])).toHaveLength(1)
  })
  it('una duración infinita o no numérica incumple', () => {
    expect(incumplimientosDeMovimiento([{ ...buena, duracionMs: Infinity }])).toHaveLength(1)
  })
})

describe('esCambioDeFecha (F2.3)', () => {
  const semana = (inicio: number) => ({ tipo: 'timeGridWeek', inicio })
  it('funde al pasar de semana dentro de la misma vista', () => {
    expect(esCambioDeFecha(semana(1), semana(2))).toBe(true)
  })
  it('no funde en el primer datesSet: la vista entera ya entra con ag-vista', () => {
    expect(esCambioDeFecha(null, semana(1))).toBe(false)
  })
  it('no funde al cambiar de tipo de vista (lo hace ag-vista)', () => {
    expect(esCambioDeFecha(semana(1), { tipo: 'dayGridMonth', inicio: 2 })).toBe(false)
  })
  it('no funde si el periodo no cambió (Compactar reemite datesSet)', () => {
    expect(esCambioDeFecha(semana(1), semana(1))).toBe(false)
  })
})

describe('fundirNavegacion (F2.3)', () => {
  type Llamada = { fotogramas: Keyframe[]; opciones: KeyframeAnimationOptions }
  const armazon = (atenuado = false) => {
    const llamadas: Llamada[] = []
    const vivas: { id: string; cancelada: boolean; cancel(): void }[] = []
    return {
      llamadas,
      vivas,
      animate: (fotogramas: Keyframe[], opciones: KeyframeAnimationOptions) => {
        llamadas.push({ fotogramas, opciones })
        const viva = { id: opciones.id ?? '', cancelada: false, cancel() { viva.cancelada = true } }
        vivas.push(viva)
        return null
      },
      closest: (s: string) => (atenuado && s.includes('.ag-cargando') ? {} : null),
      getAnimations: () => vivas.filter(v => !v.cancelada),
    }
  }

  it('anima sólo la opacidad de .7 a 1, en micro con ease-out, sin traslación', () => {
    const a = armazon()
    expect(fundirNavegacion(a)).toBe(true)
    expect(a.llamadas).toEqual([{
      fotogramas: [{ opacity: 0.7 }, { opacity: 1 }],
      opciones: { id: 'ag-fundido-navegacion', duration: 120, easing: 'cubic-bezier(0, 0, .2, 1)' },
    }])
    const props = a.llamadas[0].fotogramas.flatMap(f => Object.keys(f))
    expect(props.every(p => p === 'opacity')).toBe(true)
  })
  it('no anima sobre una rejilla ya atenuada (la atenuación es un estado y manda)', () => {
    const a = armazon(true)
    expect(fundirNavegacion(a)).toBe(false)
    expect(a.llamadas).toHaveLength(0)
  })
  it('dos navegaciones seguidas: la segunda corta el fundido de la primera', () => {
    const a = armazon()
    fundirNavegacion(a)
    fundirNavegacion(a)
    expect(a.vivas.map(v => v.cancelada)).toEqual([true, false])
  })
  it('sin armazón no hace nada', () => {
    expect(fundirNavegacion(null)).toBe(false)
  })
  it('MUTACIÓN: con movimiento reducido no anima', () => {
    navegador({}, true)
    const a = armazon()
    expect(fundirNavegacion(a)).toBe(false)
    expect(a.llamadas).toHaveLength(0)
  })
})
