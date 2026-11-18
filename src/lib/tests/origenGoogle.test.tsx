/**
 * origenGoogle.test.tsx — tanda J, punto 11 de Angel: «Las citas y eventos que
 * vienen de Google dejan el color morado. Usan los mismos colores de estado que
 * las de Spinus y conservan el logo de la G para saber que se agendaron en
 * Google. Actualiza la leyenda de estados.» En lo que Vitest ve sin navegador:
 * qué cajas llevan la «G» de una fila nacida en Google, que la hoja de estilos
 * la enseña y reasigna el morado sólo con la v2, y la leyenda de cada versión.
 * Lo que se ve de verdad (colores calculados) va en la e2e J11.
 *
 * MUTACIONES (comprobadas en rojo): `renderEventContent` sin pasar
 * `origenGoogle` a la tarjeta (sin «G»); el bloque de globals.css que reasigna
 * `--ag-gcal-*` borrado; `LeyendaEstados` con `clasica` por omisión (la de la
 * v2 seguía diciendo «GCal» en morado).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { renderToStaticMarkup } from 'react-dom/server'
import type { EventContentArg } from '@fullcalendar/core'
import { renderEventContent } from '@/components/agenda/renderEventContent'
import { LeyendaEstados } from '@/components/agenda/LeyendaEstados'
import { FilaDelPanel } from '@/components/agenda/FilaDelPanel'
import type { FilaDelDia } from '@/lib/agenda/conteoAgenda'

/** Lo mínimo de un `EventContentArg` que lee el despachador. */
function arg(vista: string, ext: Record<string, unknown>, allDay = false): EventContentArg {
  const inicio = new Date('2026-11-19T16:00:00Z')
  const a = {
    view: { type: vista }, timeText: '10:00', isMirror: false,
    event: { id: 'c1', title: 'Junta de hospital', allDay, start: inicio, end: new Date(inicio.getTime() + 3_600_000), extendedProps: ext },
  }
  // El despachador sólo lee estas piezas; el tipo entero de FullCalendar no se puede construir aquí.
  return a as unknown as EventContentArg
}

const IMPORTADA = { status: 'scheduled', origen: 'google', title: 'Junta de hospital', paciente_id: null, reserva_canal: null, google_asignacion: null }
const DE_SPINUS = { ...IMPORTADA, origen: 'spinus' }
const pintar = (vista: string, ext: Record<string, unknown>, allDay = false): string =>
  renderToStaticMarkup(<>{renderEventContent(arg(vista, ext, allDay), 'America/Merida', () => undefined)}</>)

describe('la «G» de una fila de Spinus nacida en Google (punto 11)', () => {
  it('en la tarjeta de Semana, el chip del Mes, la banda y las dos listas; nunca en una de Spinus', () => {
    for (const [vista, allDay] of [['timeGridWeek', false], ['dayGridMonth', false], ['timeGridWeek', true], ['listWeek', false], ['listDay', false]] as const) {
      expect(pintar(vista, IMPORTADA, allDay), `${vista}${allDay ? ' (todo el día)' : ''}`).toContain('class="ag-g-origen"')
      expect(pintar(vista, DE_SPINUS, allDay), `${vista} de Spinus`).not.toContain('ag-g-origen')
    }
  })
  /* Revisión del punto 11: en `listDay` la «G» iba en la segunda línea, que no se pinta en un
     evento de todo el día sin motivo (sin duración ni píldora). Mutación en rojo: devolverla a
     `.ag-listadia-detalle`. */
  it('listDay: un evento de todo el día sin motivo también la lleva', () => {
    expect(pintar('listDay', IMPORTADA, true)).toContain('class="ag-g-origen"')
  })
  it('un bloque de sólo lectura de Google conserva SU «G» y no lleva otra', () => {
    const html = pintar('timeGridWeek', { isGcalBlock: true })
    expect(html).toContain('ag-gcal')
    expect(html).not.toContain('ag-g-origen')
  })
  it('el panel del día del Mes', () => {
    const fila: FilaDelDia = { id: 'c1', orden: 0, hora: '10:00', todoElDia: false, nombre: 'Junta', esDeGoogle: false,
      origenGoogle: true, esEvento: false, cancelada: false, tinta: 'var(--ag-status-scheduled-dot)' }
    expect(renderToStaticMarkup(<FilaDelPanel fila={fila} onAbrir={() => undefined} />)).toContain('ag-g-origen')
    expect(renderToStaticMarkup(<FilaDelPanel fila={{ ...fila, origenGoogle: false }} onAbrir={() => undefined} />)).not.toContain('ag-g-origen')
  })
})

describe('globals.css: sin morado y con «G», sólo con la v2', () => {
  const css = readFileSync(path.resolve(process.cwd(), 'src/app/globals.css'), 'utf8')
  const bloque = (selector: string): string => {
    const i = css.indexOf(`${selector} {`)
    return i < 0 ? '' : css.slice(i, css.indexOf('}', i))
  }
  it('dentro del calendario con la v2, los cinco tokens de Google valen los de «Agendada»', () => {
    const v2 = bloque('.agenda-raiz[data-agenda-v2="encendida"] .agenda-fc .fc')
    for (const [g, estado] of [['text', 'text'], ['border', 'border'], ['accent', 'dot'], ['bg1', 'bg'], ['bg2', 'bg']]) {
      expect(v2).toContain(`--ag-gcal-${g}: var(--ag-status-scheduled-${estado});`)
    }
  })
  it('la «G» de origen no se ve fuera de la v2', () => {
    expect(bloque('.ag-g-origen')).toContain('display: none')
    expect(css).toMatch(/\.agenda-raiz\[data-agenda-v2="encendida"\] \.ag-g-origen,\s*\.ag-lectura-cab \.ag-g-origen \{\s*display: inline-flex/)
  })
})

describe('LeyendaEstados (punto 11)', () => {
  it('la de la v2: los cinco estados y la «G» explicada, sin morado', () => {
    const html = renderToStaticMarkup(<LeyendaEstados />)
    expect(html).toContain('Se agendó en Google')
    expect(html).not.toContain('GCal')
    expect(html).not.toContain('--ag-gcal')
    for (const e of ['Agendada', 'Confirmada', 'Cancelada', 'No asistió', 'Atendida']) expect(html).toContain(e)
  })
  it('la clásica (v2 apagada) sigue como estaba', () => {
    const html = renderToStaticMarkup(<LeyendaEstados clasica />)
    expect(html).toContain('GCal')
    expect(html).toContain('--ag-gcal-text')
    expect(html).not.toContain('Se agendó en Google')
  })
})
