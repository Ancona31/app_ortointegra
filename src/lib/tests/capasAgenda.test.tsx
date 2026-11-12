/**
 * Las capas del bloque F (F3) pintadas en el servidor (`renderToStaticMarkup`):
 * sin DOM en Vitest, lo que se comprueba es el MARCADO — roles, nombres
 * accesibles, foco itinerante y qué se ofrece en cada caso. El comportamiento
 * con teclado está en las pruebas de sus módulos puros (`opcionesLista`,
 * `rejillaMes`, `atajosAgenda`) y el de punta a punta irá en la e2e del enchufe.
 */
import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

/* El Portal real no pinta nada en el servidor (monta en un efecto): aquí pinta en el sitio. */
vi.mock('@/components/ui/Portal', () => ({ default: ({ children }: { children: ReactNode }) => children }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => { throw new Error('sin red en pruebas') } }))

import AyudaAtajos from '@/components/agenda/AyudaAtajos'
import MiniMes from '@/components/agenda/MiniMes'
import BuscadorCitas from '@/components/agenda/BuscadorCitas'
import BurbujaAlta from '@/components/agenda/BurbujaAlta'
import TarjetaLectura from '@/components/agenda/TarjetaLectura'
import { ATAJOS } from '@/lib/agenda/atajosAgenda'
import type { Appointment } from '@/lib/agenda/tiposAgenda'

const nada = (): void => undefined
const cuenta = (html: string, patron: RegExp): number => (html.match(patron) ?? []).length

/** El id al que apunta `aria-labelledby` existe y lleva el texto esperado. */
function nombrado(html: string, texto: string): boolean {
  const id = /aria-labelledby="([^"]+)"/.exec(html)?.[1]
  return id !== undefined && html.includes(`id="${id}"`) && html.includes(texto)
}

describe('AyudaAtajos', () => {
  const html = renderToStaticMarkup(<AyudaAtajos encendidos alCambiarEncendidos={nada} alCerrar={nada} />)
  it('es un diálogo modal nombrado por su título', () => {
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(nombrado(html, 'Atajos de teclado')).toBe(true)
  })
  it('lista todas las teclas y el interruptor de WCAG 2.1.4', () => {
    expect(cuenta(html, /<kbd>/g)).toBe(ATAJOS.flatMap(a => a.teclas).length)
    expect(html).toContain('role="switch"')
    expect(html).toContain('Usar atajos de una tecla')
  })
})

describe('MiniMes', () => {
  const html = renderToStaticMarkup(
    <MiniMes fechaInicial="2026-11-12" hoy="2026-11-12" visibleDesde="2026-11-09" visibleHasta="2026-11-16" alElegir={nada} />,
  )
  it('rejilla de 42 días con un solo botón en el orden de tabulación (foco itinerante)', () => {
    expect(html).toContain('role="grid"')
    expect(cuenta(html, /class="ag-minimes-dia"/g)).toBe(42)
    expect(cuenta(html, /tabindex="0"/g)).toBe(1)
  })
  it('hoy lleva aria-current y la semana visible aria-selected', () => {
    expect(cuenta(html, /aria-current="date"/g)).toBe(1)
    expect(cuenta(html, /aria-selected="true"/g)).toBe(7)
  })
  it('cada día se nombra con la fecha completa', () => {
    expect(html).toContain('aria-label="jueves, 12 de noviembre de 2026"')
    expect(nombrado(html, 'noviembre de 2026')).toBe(true)
  })
})

describe('BuscadorCitas', () => {
  const html = renderToStaticMarkup(<BuscadorCitas agendaV2 alElegirCita={nada} />)
  it('el campo es un combobox con lista, cerrado al empezar', () => {
    expect(html).toContain('role="combobox"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).toContain('aria-autocomplete="list"')
    expect(html).not.toContain('role="listbox"')
  })
})

describe('BurbujaAlta', () => {
  const base = {
    fecha: '2026-11-11', horaInicio: '10:00', horaFin: '11:30', ancla: { left: 0, top: 0, width: 100, height: 60 },
    consultorioActivo: { id: 'c1', medico_id: 'm1' }, alGuardar: async () => true, alMasOpciones: nada, alCerrar: nada,
  }
  const dos = [{ id: 'm1', nombre: 'Dra. Uno' }, { id: 'm2', nombre: 'Dr. Dos' }]
  it('diálogo nombrado con el día y el tramo, con buscador, Guardar y Más opciones', () => {
    const html = renderToStaticMarkup(<BurbujaAlta {...base} medicos={dos} filtroMedico="m1" />)
    expect(html).toContain('aria-modal="true"')
    expect(nombrado(html, 'Nueva cita · mié 11, 10:00–11:30')).toBe(true)
    expect(html).toContain('role="combobox"')
    expect(html).toContain('>Guardar<')
    expect(html).toContain('>Más opciones<')
  })
  it('el selector de médico sólo sale con «Todos» y varios médicos', () => {
    expect(renderToStaticMarkup(<BurbujaAlta {...base} medicos={dos} filtroMedico="m1" />)).not.toContain('<select')
    expect(renderToStaticMarkup(<BurbujaAlta {...base} medicos={dos} filtroMedico={null} />)).toContain('<select')
    expect(renderToStaticMarkup(<BurbujaAlta {...base} medicos={dos.slice(0, 1)} filtroMedico={null} />)).not.toContain('<select')
  })
})

const CITA: Appointment = {
  id: 'a1', title: 'Hugo Interián', start_time: '2026-11-11T16:00:00Z', end_time: '2026-11-11T17:00:00Z', all_day: false,
  status: 'scheduled', notes: 'Control', paciente_id: 'p1', medico_id: 'm1', google_event_id: null, gcal_sync_status: 'synced',
  updated_at: '2026-11-01T00:00:00Z', consultorio_id: 'c1', consultorio_nombre: 'Centro', consultorio_nombre_corto: 'C',
  consultorio_direccion: null, consultorio_telefono: null, consultorio_timezone: 'America/Merida', icono: null, color: null,
  pacientes: { id: 'p1', nombre: 'Hugo', apellidos: 'Interián', telefono: '9991234567' },
}

describe('TarjetaLectura', () => {
  const props = { ancla: { left: 0, top: 0, width: 100, height: 40 }, comoHoja: false, zonaVisor: 'America/Merida', alAccion: nada, alCerrar: nada }
  const html = renderToStaticMarkup(<TarjetaLectura {...props} cita={CITA} puedeIniciarConsulta />)
  it('diálogo nombrado por el paciente, con el estado en palabra (no sólo color)', () => {
    expect(nombrado(html, 'Hugo Interián')).toBe(true)
    expect(html).toContain('>Agendada<')
  })
  it('acciones en un toolbar con foco itinerante, la principal primero', () => {
    expect(html).toContain('role="toolbar"')
    expect(cuenta(html, /tabindex="0"/g)).toBe(1)
    expect(html.indexOf('Iniciar consulta')).toBeLessThan(html.indexOf('Confirmar'))
    expect(html).not.toContain('Eliminar')
  })
  it('enseña hora, consultorio, teléfono y nota', () => {
    expect(html).toContain('10:00–11:00')
    expect(html).toContain('Centro')
    expect(html).toContain('9991234567')
    expect(html).toContain('ag-lectura-nota')
  })
  it('en el teléfono es una hoja inferior', () => {
    const hoja = renderToStaticMarkup(<TarjetaLectura {...props} comoHoja ancla={null} cita={CITA} puedeIniciarConsulta={false} />)
    expect(hoja).toContain('class="ag-hoja"')
    expect(hoja).not.toContain('Iniciar consulta')
  })
})
