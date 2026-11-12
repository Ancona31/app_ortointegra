/**
 * Las bandas de aviso del bloque F (F2.8), pintadas en el servidor: sin DOM en
 * Vitest, lo que se comprueba es el MARCADO de entrada y de salida. La salida
 * en el tiempo (montada mientras se desvanece y desmontada después) la mira la
 * e2e `agenda-f-movimiento`.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AvisosAgenda } from '@/components/agenda/AvisosAgenda'
import { Banda } from '@/components/agenda/Banda'

const nada = (): void => undefined

const base = {
  cargaVisible: false, errorCitas: false, onReintentar: nada, citasIncompletas: false,
  currentView: 'timeGridWeek', onVerPorSemana: nada, googleFallo: false, vacioReal: false,
  vacioFiltrado: false, medicoFiltrado: undefined, periodoVacio: 'esta semana', mesSinTodos: false,
  onVerTodos: nada, onAgendar: nada, avisoRecorte: null, compactaElMes: false, onSalirCompacta: nada,
} satisfies Parameters<typeof AvisosAgenda>[0]

describe('Banda · salida (F2.8)', () => {
  it('en reposo no lleva estado ni se oculta a las ayudas técnicas', () => {
    const html = renderToStaticMarkup(<Banda tono="vacio">x</Banda>)
    expect(html).not.toContain('data-estado')
    expect(html).not.toContain('inert')
  })
  it('mientras sale lleva data-estado="saliendo" y va inert (sin foco ni ayudas técnicas)', () => {
    const html = renderToStaticMarkup(<Banda tono="error" urgente saliendo>x</Banda>)
    expect(html).toContain('data-estado="saliendo"')
    expect(html).toMatch(/ inert(="")?[ >]/)
    expect(html).toContain('role="alert"')
  })
})

describe('AvisosAgenda · entrada (F2.8)', () => {
  it('sin avisos sólo queda el envoltorio', () => {
    expect(renderToStaticMarkup(<AvisosAgenda {...base} />)).toBe('<div class="ag-avisos"></div>')
  })
  it('la banda que aplica se pinta entera y sin marca de salida', () => {
    const html = renderToStaticMarkup(<AvisosAgenda {...base} vacioReal avisoRecorte="sábado y domingo ocultos" />)
    expect(html).toContain('Sin citas esta semana')
    expect(html).toContain('sábado y domingo ocultos')
    expect(html).not.toContain('saliendo')
  })
})
