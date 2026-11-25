/**
 * marcasProcedencia.test.tsx — tanda K, sección E, puntos 17, 18 y 20 de Angel, en lo que
 * Vitest ve sin navegador (entorno `node`: `useSinAvisoFlotante` da siempre su valor de
 * servidor, `false`, así que la caja de Semana y el chip del Mes CON la v2 los mira la e2e
 * `agenda-k5-burbuja`):
 *   · 17: un solo icono, el expediente tachado, para «por ligar» y «por asignar»;
 *   · 18: el eslabón en TODA cita reservada por enlace, también ya ligada;
 *   · 20: la leyenda de la v2 suma el eslabón y el expediente tachado a la «G».
 *
 * MUTACIONES (comprobadas en rojo, una por prueba):
 *   · `enlace: Boolean(apt.reserva_canal) && !apt.paciente_id` en `marcasDeCita` → «permanente»;
 *   · `sinExpediente: Boolean(apt.reserva_canal) && !apt.paciente_id` (sin las de Google) → «por asignar»;
 *   · `etiquetaV2` sin la frase del historial → «etiqueta accesible»;
 *   · quitar `<MarcasCita …>` de `FilaLista` → «listas, banda y panel»;
 *   · borrar la regla `.agenda-raiz[data-agenda-v2="encendida"] .ag-marcas-v2` → «sólo con la v2»;
 *   · `{!clasica && …}` → `{…}` (la clásica también las lleva) → «leyenda».
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import type { EventContentArg } from '@fullcalendar/core'
import { marcasDeCita } from '@/lib/agenda/tarjetasAgenda'
import { renderEventContent } from '@/components/agenda/renderEventContent'
import { etiquetaV2 } from '@/components/agenda/MemoizedEventContent'
import { LeyendaEstados } from '@/components/agenda/LeyendaEstados'
import { FilaDelPanel } from '@/components/agenda/FilaDelPanel'
import type { FilaDelDia } from '@/lib/agenda/conteoAgenda'

const POR_LIGAR = { status: 'scheduled', paciente_id: null, reserva_canal: 'fijo', google_asignacion: null, reserva_historial_previo: 0 }
const LIGADA = { ...POR_LIGAR, paciente_id: 'p1' }
const POR_ASIGNAR = { status: 'scheduled', paciente_id: null, reserva_canal: null, google_asignacion: 'por_asignar' }
const DE_SPINUS = { status: 'scheduled', paciente_id: 'p1', reserva_canal: null, google_asignacion: null }
const EVENTO = { status: 'scheduled', paciente_id: null, reserva_canal: null, google_asignacion: 'evento' }

describe('marcasDeCita (puntos 17 y 18)', () => {
  it('por ligar: eslabón y expediente tachado', () => {
    expect(marcasDeCita(POR_LIGAR)).toEqual({ enlace: true, sinExpediente: true, historial: null })
  })
  it('permanente: ya ligada conserva el eslabón y pierde el expediente tachado', () => {
    expect(marcasDeCita(LIGADA)).toEqual({ enlace: true, sinExpediente: false, historial: null })
  })
  it('por asignar de Google: el MISMO expediente tachado, sin eslabón', () => {
    expect(marcasDeCita(POR_ASIGNAR)).toEqual({ enlace: false, sinExpediente: true, historial: null })
  })
  it('de Spinus o un evento: ninguna', () => {
    expect(marcasDeCita(DE_SPINUS)).toEqual({ enlace: false, sinExpediente: false, historial: null })
    expect(marcasDeCita(EVENTO)).toEqual({ enlace: false, sinExpediente: false, historial: null })
  })
  it('el historial al reservar (lo que la píldora decía con «· N»), sólo mientras está por ligar', () => {
    expect(marcasDeCita({ ...POR_LIGAR, reserva_historial_previo: 1 }).historial).toBe('Al reservar traía 1 cancelación o inasistencia.')
    expect(marcasDeCita({ ...POR_LIGAR, reserva_historial_previo: 3 }).historial).toBe('Al reservar traía 3 cancelaciones o inasistencias.')
    expect(marcasDeCita({ ...LIGADA, reserva_historial_previo: 3 }).historial).toBeNull()
  })
})

describe('etiqueta accesible de la caja con la v2', () => {
  it('nombra las marcas en palabras, con el historial', () => {
    expect(etiquetaV2('Ana', 'Agendada', { sinExpediente: true, deEnlace: true, origenGoogle: false, historial: 'Al reservar traía 2 cancelaciones o inasistencias.' }))
      .toBe('Ana · Agendada · Sin expediente. Al reservar traía 2 cancelaciones o inasistencias. · Agendada por enlace')
    expect(etiquetaV2('Junta', 'Agendada', { sinExpediente: true, deEnlace: false, origenGoogle: true }))
      .toBe('Junta · Agendada · Sin expediente · Agendada en Google')
  })
})

/** Lo mínimo de un `EventContentArg` que lee el despachador. */
function arg(vista: string, ext: Record<string, unknown>, allDay = false): EventContentArg {
  const inicio = new Date('2026-11-19T16:00:00Z')
  const a = {
    view: { type: vista }, timeText: '10:00', isMirror: false,
    event: { id: 'c1', title: 'Reserva', allDay, start: inicio, end: new Date(inicio.getTime() + 3_600_000), extendedProps: { title: 'Reserva', ...ext } },
  }
  // El despachador sólo lee estas piezas; el tipo entero de FullCalendar no se puede construir aquí.
  return a as unknown as EventContentArg
}
const pintar = (vista: string, ext: Record<string, unknown>, allDay = false): string =>
  renderToStaticMarkup(<>{renderEventContent(arg(vista, ext, allDay), 'America/Merida', () => undefined)}</>)

describe('listas, banda y panel del Mes: las marcas con `.ag-marcas-v2` (la hoja las enseña con la v2)', () => {
  it('las dos listas y la banda', () => {
    for (const [vista, allDay] of [['listWeek', false], ['listDay', false], ['timeGridWeek', true]] as const) {
      const html = pintar(vista, POR_LIGAR, allDay)
      expect(html, vista).toContain('class="ag-marcas ag-marcas-v2"')
      expect(html, vista).toContain('aria-label="Agendada por enlace"')
      expect(html, vista).toContain('aria-label="Sin expediente"')
      expect(pintar(vista, DE_SPINUS, allDay), `${vista} de Spinus`).not.toContain('ag-marcas')
    }
  })
  it('el panel del día del Mes', () => {
    const fila: FilaDelDia = { id: 'c1', orden: 0, hora: '10:00', todoElDia: false, nombre: 'Ana', esDeGoogle: false,
      origenGoogle: false, deEnlace: true, sinExpediente: false, esEvento: false, cancelada: false, tinta: 'var(--ag-status-scheduled-dot)',
      fin: null, duracion: null, motivo: null, status: null }
    const html = renderToStaticMarkup(<FilaDelPanel fila={fila} onAbrir={() => undefined} />)
    expect(html).toContain('ag-marcas-v2')
    expect(html).toContain('aria-label="Agendada por enlace"')
    expect(html).not.toContain('Sin expediente')
  })
  it('con la v2 apagada (valor de servidor del interruptor) la caja de Semana sigue con la píldora de siempre', () => {
    const html = pintar('timeGridWeek', POR_LIGAR)
    expect(html).toContain('class="ag-tarjeta-marca"')
    expect(html).toContain('Por ligar')
    expect(html).not.toContain('ag-icono-sin-exp')
  })
})

describe('globals.css: las marcas de listas, banda y panel, sólo con la v2', () => {
  const css = readFileSync(path.resolve(process.cwd(), 'src/app/globals.css'), 'utf8')
  it('escondidas por omisión y visibles dentro de la agenda con la v2', () => {
    expect(css).toMatch(/\.ag-marcas-v2 \{ display: none; \}/)
    expect(css).toMatch(/\.agenda-raiz\[data-agenda-v2="encendida"\] \.ag-marcas-v2 \{ display: inline-flex; \}/)
  })
})

describe('LeyendaEstados (punto 20)', () => {
  it('la de la v2: la «G», el eslabón y el expediente tachado, con sus textos', () => {
    const html = renderToStaticMarkup(<LeyendaEstados />)
    expect(html).toContain('Agendada desde Google Calendar')
    expect(html).toContain('Reservó por enlace')
    expect(html).toContain('Sin expediente')
    expect(html).toContain('ag-icono-enlace')
    expect(html).toContain('ag-icono-sin-exp')
  })
  it('la clásica (v2 apagada) no cambia', () => {
    const html = renderToStaticMarkup(<LeyendaEstados clasica />)
    expect(html).not.toContain('Reservó por enlace')
    expect(html).not.toContain('Sin expediente')
  })
})
