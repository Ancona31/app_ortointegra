/**
 * bloqueosAgenda.test.ts — K1 (tanda K, sección A) · el bloqueo de horario en
 * el cliente y en el servidor: cómo se pinta, cuándo pregunta, qué cuenta, qué
 * se manda a Google y qué se trae de Google. Cada caso se vio en rojo con la
 * mutación que nombra (notas_k1.md).
 */
import { describe, it, expect, vi } from 'vitest'
import type { EventApi } from '@fullcalendar/core'
import {
  bloqueoAEvento, bloqueoDe, bloqueosDeRespuesta, displayDeBloqueo, esCitaParaBloqueo, mensajeCitasEnBloqueo,
  rotuloBloqueo, tocaBloqueo, TEXTO_CONFIRMAR_BLOQUEO, type BloqueoAgenda,
} from '@/lib/agenda/bloqueosAgenda'
import { contarTodoElDia, eventoOcupa } from '@/lib/agenda/huecosAgenda'
import { tramoDePintado, empalmesDe } from '@/lib/agenda/empalmesCita'
import { datosDeAltaRapida, guardarAltaRapida } from '@/lib/agenda/altaRapida'
import { partirSemilla, semanasAlrededor } from '@/lib/agenda/semillaCitas'
import { CrearBloqueoSchema, columnasDePuntas, puedeBloquear } from '@/lib/agenda/bloqueosServidor'
import { eventoDeBloqueo, tituloGoogleBloqueo } from '@/lib/agenda/bloqueosGoogle'
import { argumentosBloqueo, marcaBloqueo, tieneMarcaBloqueo } from '@/lib/gcalSincronizacionBloqueos'
import { camposIniciales, cuerpoBloqueo, motivoParaNoGuardarBloqueo } from '@/components/agenda/ModalBloqueo'

const B: BloqueoAgenda = {
  id: '11111111-1111-4111-8111-111111111111', medico_id: 'm1',
  inicio: '2026-11-18T16:00:00.000Z', fin: '2026-11-18T18:00:00.000Z', todo_el_dia: false, zona: 'America/Merida', motivo: 'Junta',
}
/* Medianoche a medianoche en Mérida (UTC-6): 18 y 19 de noviembre. */
const DIAS: BloqueoAgenda = { ...B, todo_el_dia: true, inicio: '2026-11-18T06:00:00.000Z', fin: '2026-11-20T06:00:00.000Z', motivo: null }

/** Lo que FullCalendar daría de ese `EventInput` (lo justo para los lectores). */
function pintado(b: BloqueoAgenda): EventApi {
  const e = bloqueoAEvento(b, 'timeGridWeek')
  const ini = b.todo_el_dia ? new Date(`${String(e.start)}T00:00:00`) : new Date(b.inicio)
  const fin = b.todo_el_dia ? new Date(`${String(e.end)}T00:00:00`) : new Date(b.fin)
  const parcial: Partial<EventApi> = { id: String(e.id), title: String(e.title), allDay: b.todo_el_dia, start: ini, end: fin, extendedProps: e.extendedProps ?? {} }
  return parcial as EventApi
}

describe('bloqueoAEvento y la franja', () => {
  it('fondo en la rejilla; fila en la lista y en el Mes con hora (MUTACIÓN: siempre fondo)', () => {
    expect(displayDeBloqueo('timeGridWeek', false)).toBe('background')
    expect(displayDeBloqueo('listWeek', true)).toBe('auto')
    expect(displayDeBloqueo('dayGridMonth', false)).toBe('auto')
    expect(displayDeBloqueo('dayGridMonth', true)).toBe('background')
  })
  it('los días completos van como fechas EN LA ZONA del bloqueo, fin exclusivo', () => {
    const e = bloqueoAEvento(DIAS)
    expect([e.allDay, e.start, e.end]).toEqual([true, '2026-11-18', '2026-11-20'])
  })
  it('id con prefijo, no editable, y los datos ANIDADOS (MUTACIÓN: `medico_id` suelto contaría como empalme)', () => {
    const e = bloqueoAEvento(B)
    expect(e.id).toBe(`bloqueo:${B.id}`)
    expect(e.editable).toBe(false)
    expect(e.extendedProps).toEqual({ bloqueo: B })
    const t = tramoDePintado(pintado(B))
    expect(t?.medicoId).toBeNull()
    expect(empalmesDe({ id: 'c', medicoId: 'm1', inicio: new Date(B.inicio), fin: new Date(B.fin), todoElDia: false, noOcupa: false, deGoogle: false, titulo: '' }, t ? [t] : [])).toEqual([])
  })
  it('el rótulo lleva el motivo si lo hay', () => {
    expect(rotuloBloqueo('Junta')).toBe('Bloqueado · Junta')
    expect(rotuloBloqueo('  ')).toBe('Bloqueado')
  })
  it('lee la respuesta de la red descartando lo que no es una fila', () => {
    expect(bloqueosDeRespuesta([B, { id: 'x' }, null])).toEqual([B])
    expect(bloqueosDeRespuesta(undefined)).toEqual([])
    expect(bloqueoDe({ extendedProps: { medico_id: 'm1' } })).toBeNull()
  })
})

describe('punto 3 · cuándo pregunta', () => {
  const ev = [pintado(B)]
  it('solape semiabierto, del mismo médico (MUTACIÓN: `<=` haría que tocar el borde preguntara)', () => {
    expect(tocaBloqueo(ev, 'm1', new Date('2026-11-18T17:00:00Z'), new Date('2026-11-18T17:30:00Z'))).toBe(true)
    expect(tocaBloqueo(ev, 'm1', new Date('2026-11-18T18:00:00Z'), new Date('2026-11-18T18:30:00Z'))).toBe(false)
    expect(tocaBloqueo(ev, 'm1', new Date('2026-11-18T15:30:00Z'), new Date('2026-11-18T16:00:00Z'))).toBe(false)
    expect(tocaBloqueo(ev, 'otro', new Date('2026-11-18T17:00:00Z'), new Date('2026-11-18T17:30:00Z'))).toBe(false)
    expect(tocaBloqueo(ev, null, new Date('2026-11-18T17:00:00Z'), new Date('2026-11-18T17:30:00Z'))).toBe(false)
  })
  it('un bloqueo de días cuenta con sus medianoches reales, no con las del navegador', () => {
    const d = [pintado(DIAS)]
    expect(tocaBloqueo(d, 'm1', new Date('2026-11-20T05:00:00Z'), new Date('2026-11-20T05:30:00Z'))).toBe(true)
    expect(tocaBloqueo(d, 'm1', new Date('2026-11-20T06:00:00Z'), new Date('2026-11-20T06:30:00Z'))).toBe(false)
  })
  it('sólo pregunta por una CITA (paciente, reserva o por asignar), no por un evento propio', () => {
    expect(esCitaParaBloqueo({ paciente_id: 'p' })).toBe(true)
    expect(esCitaParaBloqueo({ reserva_canal: 'enlace' })).toBe(true)
    expect(esCitaParaBloqueo({ google_asignacion: 'por_asignar' })).toBe(true)
    expect(esCitaParaBloqueo({ paciente_id: null })).toBe(false)
  })
  it('la burbuja pregunta con el texto literal; «Cancelar» no guarda (MUTACIÓN: sin la pregunta)', async () => {
    const datos = datosDeAltaRapida({
      fecha: '2026-11-18', horaInicio: '10:00', horaFin: '11:00',
      paciente: { id: 'p', nombre: 'Ana', apellidos: 'Ruiz', telefono: null }, medicoId: 'm1', consultorioId: 'c',
    })
    if (!datos) throw new Error('sin datos')
    const respuestas = [false]
    const d = {
      avisoHorario: () => null, buscarEmpalmes: () => [], mensajeEmpalme: () => '',
      confirmar: vi.fn(async () => respuestas.shift() ?? true), guardar: vi.fn(async () => null),
      bloqueado: vi.fn(() => true),
    }
    const abiertas = { inicio: '10:00', fin: '11:00' }
    expect(await guardarAltaRapida(datos, abiertas, abiertas, d)).toEqual({ enviada: false })
    expect(d.confirmar).toHaveBeenCalledWith(TEXTO_CONFIRMAR_BLOQUEO)
    expect(d.bloqueado).toHaveBeenCalledWith(expect.any(Date), expect.any(Date), 'm1')
    expect(d.guardar).not.toHaveBeenCalled()
    expect(await guardarAltaRapida(datos, abiertas, abiertas, d)).toEqual({ enviada: true, alta: null })
  })
  it('el texto es el de Angel', () => {
    expect(TEXTO_CONFIRMAR_BLOQUEO).toBe('Este horario está bloqueado. ¿Agendar de todos modos?')
  })
})

describe('huecos y conteos', () => {
  it('un bloqueo ocupa, también el de días (MUTACIÓN: la regla `allDay` primero lo dejaría libre)', () => {
    expect(eventoOcupa(pintado(B))).toBe(true)
    expect(eventoOcupa(pintado(DIAS))).toBe(true)
  })
  it('no cuenta como «evento de todo el día» (MUTACIÓN: sin la exclusión, 1)', () => {
    expect(contarTodoElDia([pintado(DIAS)], new Date('2026-11-18T12:00:00'))).toBe(0)
  })
  it('punto 5 · el aviso dice cuántas citas hay y que se quedan', () => {
    expect(mensajeCitasEnBloqueo(1)).toBe('Hay 1 cita en este horario. Se queda como está.')
    expect(mensajeCitasEnBloqueo(3)).toBe('Hay 3 citas en este horario. Se quedan como están.')
  })
})

describe('la semilla reparte los bloqueos por semana', () => {
  it('cada semana se queda con los que la tocan (MUTACIÓN: sin el filtro, todos en todas)', () => {
    const HOY = new Date(2026, 10, 18, 10)
    const s = semanasAlrededor(HOY)
    const dentro = { ...B, inicio: new Date(2026, 10, 18, 9).toISOString(), fin: new Date(2026, 10, 18, 10).toISOString() }
    const partes = partirSemilla({
      id: 'x', usuario: 'u', filtro: '', salio: 0, desde: s[0].startStr, hasta: s[2].endStr,
      appointments: [], incompleta: false, bloqueos: [dentro],
    }, HOY)
    expect(partes.map(p => p.bloqueos.length)).toEqual([0, 1, 0])
  })
})

describe('servidor · puntas, permiso y esquema', () => {
  it('días completos: medianoche a medianoche en la zona, el último día incluido', () => {
    const p = CrearBloqueoSchema.parse({ medico_id: B.id, todo_el_dia: true, desde: '2026-11-18', hasta: '2026-11-19', zona: 'America/Merida', motivo: ' Congreso ' })
    expect(columnasDePuntas(p)).toEqual({ inicio: DIAS.inicio, fin: DIAS.fin, todo_el_dia: true, zona: 'America/Merida', motivo: 'Congreso' })
  })
  it('con horas, en la hora de pared de la zona; motivo vacío = null', () => {
    const p = CrearBloqueoSchema.parse({ medico_id: B.id, todo_el_dia: false, fecha: '2026-11-18', hora_inicio: '10:00', fecha_fin: '2026-11-18', hora_fin: '12:00', zona: 'America/Merida', motivo: '' })
    expect(columnasDePuntas(p)).toMatchObject({ inicio: B.inicio, fin: B.fin, motivo: null })
  })
  it('rechaza zona inexistente, motivo largo y claves de más', () => {
    const base = { medico_id: B.id, todo_el_dia: true, desde: '2026-11-18', hasta: '2026-11-18' }
    expect(CrearBloqueoSchema.safeParse({ ...base, zona: 'Marte/Olimpo' }).success).toBe(false)
    expect(CrearBloqueoSchema.safeParse({ ...base, zona: 'America/Merida', motivo: 'x'.repeat(121) }).success).toBe(false)
    expect(CrearBloqueoSchema.safeParse({ ...base, zona: 'America/Merida', clinica_id: B.id }).success).toBe(false)
    expect(CrearBloqueoSchema.safeParse({ ...base, zona: 'America/Merida', hasta: '2026-02-31' }).success).toBe(false)
  })
  it('quien hoy puede agendar para ese médico (MUTACIÓN: un invitado para otro médico)', () => {
    const invitado = { userId: 'm2', clinica_id: 'c', role: 'medico' as const, es_admin_de_clinica: false }
    expect(puedeBloquear(invitado, 'm2')).toBe(true)
    expect(puedeBloquear(invitado, 'm1')).toBe(false)
    expect(puedeBloquear({ ...invitado, es_admin_de_clinica: true }, 'm1')).toBe(true)
    expect(puedeBloquear({ ...invitado, role: 'secretaria' }, 'm1')).toBe(true)
    expect(puedeBloquear({ ...invitado, role: 'super_admin' }, 'm1')).toBe(false)
  })
})

describe('punto 6 · Google', () => {
  const PARA = { ...B, clinica_id: 'c', google_event_id: null, gcal_calendar_id: null }
  it('«Ocupado» con el título «Bloqueado — motivo» y la marca privada (MUTACIÓN: `transparent`)', () => {
    const e = eventoDeBloqueo(PARA, false)
    expect(e.transparency).toBe('opaque')
    expect(e.summary).toBe('Bloqueado — Junta')
    expect(e.extendedProperties).toEqual({ private: { spinus_bloqueo: B.id, spinus_v: '2' } })
    expect(e.start).toEqual({ dateTime: B.inicio, timeZone: 'America/Merida' })
    expect(e.attendees).toBeUndefined()
    expect(tituloGoogleBloqueo(null)).toBe('Bloqueado')
  })
  it('los días completos viajan como fechas en su zona', () => {
    const e = eventoDeBloqueo({ ...PARA, ...DIAS }, true)
    expect([e.start, e.end]).toEqual([{ date: '2026-11-18', dateTime: null }, { date: '2026-11-20', dateTime: null }])
  })
  it('de Google: movido con hora, a días, o borrado (que llega sin marca)', () => {
    const marca = { private: { spinus_bloqueo: B.id.toUpperCase() } }
    expect(marcaBloqueo({ extendedProperties: marca })).toBe(B.id)
    expect(marcaBloqueo({ extendedProperties: { private: { spinus_cita: B.id } } })).toBeNull()
    expect(argumentosBloqueo({ id: 'g', etag: 'e', extendedProperties: marca, start: { dateTime: B.inicio }, end: { dateTime: B.fin } }, 'cal'))
      .toMatchObject({ p_borrar: false, p_inicio: B.inicio, p_fin: B.fin, p_desde: null, p_bloqueo_id: B.id })
    expect(argumentosBloqueo({ id: 'g', etag: 'e', start: { date: '2026-11-18' }, end: { date: '2026-11-19' } }, 'cal'))
      .toMatchObject({ p_borrar: false, p_inicio: null, p_desde: '2026-11-18', p_hasta: '2026-11-19' })
    expect(argumentosBloqueo({ id: 'g', status: 'cancelled' }, 'cal')).toMatchObject({ p_borrar: true, p_bloqueo_id: null })
    expect(argumentosBloqueo({ id: 'g', start: { dateTime: B.inicio }, end: { dateTime: B.fin } }, 'cal')).toBeNull()
  })
  it('una marca ROTA sigue apartando el evento de la importación (MUTACIÓN: partir por `marcaBloqueo`)', () => {
    expect(tieneMarcaBloqueo({ extendedProperties: { private: { spinus_bloqueo: 'no-es-uuid' } } })).toBe(true)
    expect(tieneMarcaBloqueo({ extendedProperties: { private: { spinus_cita: B.id } } })).toBe(false)
  })
})

describe('el modal del bloqueo', () => {
  it('desde un hueco con hora: ese tramo; sin hora: días completos', () => {
    expect(camposIniciales({ tipo: 'crear', desde: { fecha: '2026-11-18', hora: '10:00', horaFin: '10:30', medicoId: 'm1' } }, 'America/Merida'))
      .toMatchObject({ todoElDia: false, hora: '10:00', horaFin: '10:30', fechaFin: '2026-11-18', medicoId: 'm1' })
    expect(camposIniciales({ tipo: 'crear', desde: { fecha: '2026-11-18', hora: null, medicoId: null } }, 'America/Merida'))
      .toMatchObject({ todoElDia: true, medicoId: '' })
  })
  it('sin fin, una hora después aunque cruce la medianoche', () => {
    expect(camposIniciales({ tipo: 'crear', desde: { fecha: '2026-11-18', hora: '23:30', medicoId: 'm1' } }, 'America/Merida'))
      .toMatchObject({ fecha: '2026-11-18', hora: '23:30', fechaFin: '2026-11-19', horaFin: '00:30' })
  })
  it('al editar días completos enseña el último día INCLUIDO', () => {
    expect(camposIniciales({ tipo: 'editar', bloqueo: DIAS }, 'UTC')).toMatchObject({ fecha: '2026-11-18', fechaFin: '2026-11-19', todoElDia: true })
  })
  it('el cuerpo y lo que impide guardar', () => {
    const c = { medicoId: 'm1', todoElDia: false, fecha: '2026-11-18', hora: '10:00', fechaFin: '2026-11-18', horaFin: '09:00', motivo: ' ' }
    expect(motivoParaNoGuardarBloqueo(c)).toBe('El fin tiene que ser después del inicio.')
    expect(motivoParaNoGuardarBloqueo({ ...c, horaFin: '11:00' })).toBeNull()
    expect(motivoParaNoGuardarBloqueo({ ...c, medicoId: '' })).toBe('Elige el médico.')
    expect(cuerpoBloqueo({ ...c, horaFin: '11:00' }, 'America/Merida')).toEqual({
      todo_el_dia: false, fecha: '2026-11-18', hora_inicio: '10:00', fecha_fin: '2026-11-18', hora_fin: '11:00', zona: 'America/Merida', motivo: null,
    })
  })
})
