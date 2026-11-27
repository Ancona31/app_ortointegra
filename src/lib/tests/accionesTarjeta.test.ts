import { describe, expect, it } from 'vitest'
import {
  burbujaDeTarjeta, accionesDeTarjeta, cuandoDeTarjeta, disposicionDeTarjeta, esConvertible, ETIQUETA_ACCION, horarioDeTarjeta, nombreDeTarjeta, pideConfirmacion,
  puedeIniciarConsulta, telefonoDeTarjeta, textoDeConfirmacion,
} from '@/lib/agenda/accionesTarjeta'
import { pideComprobarNota, vetoPorEstado, vetoPorNotaLigada } from '@/lib/agenda/estadoCita'

const CITA = { paciente_id: 'p1', reserva_canal: null } as const

describe('accionesDeTarjeta (G3: por estado)', () => {
  it('agendada: iniciar (si se puede), confirmar, reagendar y cancelar; sin «Editar» (va en el engrane)', () => {
    expect(accionesDeTarjeta({ ...CITA, status: 'scheduled' }, true)).toEqual(['iniciar-consulta', 'confirmar', 'reagendar', 'cancelar'])
  })
  it('confirmada: ya no ofrece confirmar', () => {
    expect(accionesDeTarjeta({ ...CITA, status: 'confirmed' }, false)).toEqual(['reagendar', 'cancelar'])
  })
  it('atendida: sólo «Ver expediente» (si quien mira lo puede abrir); ni iniciar, ni reagendar, ni cancelar', () => {
    expect(accionesDeTarjeta({ ...CITA, status: 'attended' }, true, true, true)).toEqual(['ver-expediente'])
    expect(accionesDeTarjeta({ ...CITA, status: 'attended' }, true, true, false)).toEqual([])
  })
  /* Tanda L, punto 9: la cancelada suma «Eliminar cita» (aparte, como peligro). MUTACIÓN: `peligro: null`
     en la cancelada de `disposicionPorEstado` → rojo. */
  it('cancelada: «Reagendar cita», «Reasignar» (tanda I, punto 12) y «Eliminar cita» (tanda L, punto 9); no asistió: sólo «Reagendar cita»', () => {
    expect(accionesDeTarjeta({ ...CITA, status: 'cancelled' }, true)).toEqual(['reagendar-cita', 'reasignar', 'eliminar-cita'])
    expect(ETIQUETA_ACCION['eliminar-cita']).toBe('Eliminar cita')
    expect(accionesDeTarjeta({ ...CITA, status: 'no_show' }, true)).toEqual(['reagendar-cita'])
  })
  it('una cancelada POR LIGAR no ofrece «Reasignar»: conserva lo de antes', () => {
    expect(accionesDeTarjeta({ paciente_id: null, reserva_canal: 'fijo', status: 'cancelled' }, true)).not.toContain('reasignar')
  })
  /* Corrección del 2026-11-27: una por ligar cancelada se quedaba sin ninguna salida. MUTACIÓN: `peligro: viva ?
     'cancelar' : null` en `disposicionSinCambios` → rojo. */
  it('una cancelada POR LIGAR (reservó por enlace o es de Google por asignar) ofrece «Eliminar cita», aparte; la no asistida y la atendida, no', () => {
    const porEnlace = { paciente_id: null, reserva_canal: 'fijo', status: 'cancelled' } as const
    const porAsignar = { paciente_id: null, reserva_canal: null, google_asignacion: 'por_asignar', status: 'cancelled' } as const
    for (const cita of [porEnlace, porAsignar]) {
      expect(disposicionDeTarjeta(cita, false).peligro).toBe('eliminar-cita')
      expect(disposicionDeTarjeta(cita, true).peligro).toBe('eliminar-cita')
      expect(accionesDeTarjeta(cita, false)).not.toContain('cancelar')
      expect(burbujaDeTarjeta(cita, false).pie.at(-1)).toBe('eliminar-cita')
    }
    for (const status of ['no_show', 'attended'] as const) {
      expect(disposicionDeTarjeta({ paciente_id: null, reserva_canal: 'fijo', status }, true).peligro).toBeNull()
    }
    // Viva, como siempre: se cancela, no se elimina.
    expect(disposicionDeTarjeta({ paciente_id: null, reserva_canal: 'fijo', status: 'confirmed' }, false).peligro).toBe('cancelar')
  })
  /* Decisión de Angel (2026-11-27). MUTACIÓN: `principal: puedeIniciar ? 'ligar' : null` → rojo. */
  it('«Ligar paciente e iniciar consulta» sólo en una por ligar VIVA: cancelada, no asistida y atendida no la ofrecen', () => {
    const porEnlace = { paciente_id: null, reserva_canal: 'fijo' } as const
    const porAsignar = { paciente_id: null, reserva_canal: null, google_asignacion: 'por_asignar' } as const
    for (const base of [porEnlace, porAsignar]) {
      for (const status of ['cancelled', 'no_show', 'attended'] as const) {
        const cita = { ...base, status }
        expect(disposicionDeTarjeta(cita, true).principal).toBeNull()
        expect(accionesDeTarjeta(cita, true)).not.toContain('ligar')
        expect(burbujaDeTarjeta(cita, true).principal).toBeNull()
      }
      for (const status of ['scheduled', 'confirmed'] as const) {
        expect(disposicionDeTarjeta({ ...base, status }, true).principal).toBe('ligar')
        expect(disposicionDeTarjeta({ ...base, status }, false).principal).toBeNull()
      }
    }
    // Lo demás de la cancelada, igual: «Editar» y «Eliminar cita».
    expect(accionesDeTarjeta({ ...porEnlace, status: 'cancelled' }, true)).toEqual(['editar', 'eliminar-cita'])
  })
  it('una cita con paciente NUNCA se puede eliminar desde la tarjeta', () => {
    expect(accionesDeTarjeta({ ...CITA, status: 'scheduled' }, true)).not.toContain('eliminar')
  })
  it('un evento sin paciente se edita o se elimina, y nada más (lo de antes)', () => {
    expect(accionesDeTarjeta({ paciente_id: null, reserva_canal: null, status: 'scheduled' }, true)).toEqual(['editar', 'eliminar'])
  })
  it('una por ligar conserva lo suyo, en su orden (con «Editar»), y cancelar aparte', () => {
    expect(accionesDeTarjeta({ paciente_id: null, reserva_canal: 'fijo', status: 'scheduled' }, true))
      .toEqual(['ligar', 'confirmar', 'reagendar', 'editar', 'cancelar'])
  })
  /* Tanda J (punto 7) · MUTACIÓN: principal `'iniciar-consulta'` en `disposicionSinCambios` → rojo. */
  it('tanda J · la principal de una por ligar es «Ligar paciente e iniciar consulta» (la ventana), no «Iniciar consulta»', () => {
    const d = disposicionDeTarjeta({ paciente_id: null, reserva_canal: 'unico', status: 'confirmed' }, true)
    expect(d.principal).toBe('ligar')
    /* B13 · AG7 · el texto unificado (CALMA §28). */
    expect(ETIQUETA_ACCION.ligar).toBe('Ligar paciente e iniciar consulta')
    expect(disposicionDeTarjeta({ paciente_id: null, reserva_canal: 'unico', status: 'confirmed' }, false).principal).toBeNull()
  })
  /* Tanda L, punto 2 (AG-DT-192): «No asistió» pregunta, como «Cancelar cita».
     MUTACIÓN: quitar `|| accion === 'no-asistio'` de `pideConfirmacion` → rojo. */
  it('cancelar, eliminar y «No asistió» piden confirmación; el resto no', () => {
    expect(pideConfirmacion('cancelar')).toBe(true)
    expect(pideConfirmacion('eliminar')).toBe(true)
    expect(pideConfirmacion('no-asistio')).toBe(true)
    expect(pideConfirmacion('eliminar-cita')).toBe(true)
    expect(pideConfirmacion('confirmar')).toBe(false)
  })
})

describe('disposicionDeTarjeta (G3: la rejilla)', () => {
  it('agendada con WhatsApp: principal, Confirmar | Reagendar, el aviso solo (impar) y cancelar aparte', () => {
    expect(disposicionDeTarjeta({ ...CITA, status: 'scheduled' }, true, { conWhatsApp: true }))
      .toEqual({ principal: 'iniciar-consulta', secundarias: ['confirmar', 'reagendar', 'whatsapp'], peligro: 'cancelar' })
  })
  it('confirmada con WhatsApp: Reagendar | aviso', () => {
    expect(disposicionDeTarjeta({ ...CITA, status: 'confirmed' }, true, { conWhatsApp: true }).secundarias).toEqual(['reagendar', 'whatsapp'])
  })
  it('atendida o cancelada: nunca el aviso, aunque aplique', () => {
    expect(disposicionDeTarjeta({ ...CITA, status: 'attended' }, true, { conWhatsApp: true, puedeVerExpediente: true }))
      .toEqual({ principal: 'ver-expediente', secundarias: [], peligro: null })
    expect(disposicionDeTarjeta({ ...CITA, status: 'cancelled' }, true, { conWhatsApp: true }))
      .toEqual({ principal: 'reagendar-cita', secundarias: ['reasignar'], peligro: 'eliminar-cita' })
  })
})

/* Tanda J, punto 10 · Desde el aviso «Desde Google no se pueden mover…», «Reagendar» de
   principal. Mutación en rojo: que `disposicionDeTarjeta` no aplique `conDestacada`. */
describe('disposicionDeTarjeta con `destacar` (tanda J, punto 10)', () => {
  const RESERVA = { paciente_id: 'p1', reserva_canal: 'fijo' } as const
  it('una reservada por enlace: «Reagendar» de principal y lo que era principal encabeza las secundarias', () => {
    expect(disposicionDeTarjeta({ ...RESERVA, status: 'scheduled' }, true, { conWhatsApp: true, destacar: 'reagendar' }))
      .toEqual({ principal: 'reagendar', secundarias: ['iniciar-consulta', 'confirmar', 'whatsapp'], peligro: 'cancelar' })
    expect(disposicionDeTarjeta({ ...RESERVA, status: 'confirmed' }, false, { destacar: 'reagendar' }))
      .toEqual({ principal: 'reagendar', secundarias: [], peligro: 'cancelar' })
  })
  it('una por ligar también; sin «Reagendar» en la tarjeta (ya atendida, cancelada), nada cambia', () => {
    expect(disposicionDeTarjeta({ paciente_id: null, reserva_canal: 'fijo', status: 'scheduled' }, false, { destacar: 'reagendar' }).principal)
      .toBe('reagendar')
    expect(disposicionDeTarjeta({ ...RESERVA, status: 'cancelled' }, true, { destacar: 'reagendar' }))
      .toEqual(disposicionDeTarjeta({ ...RESERVA, status: 'cancelled' }, true))
    expect(disposicionDeTarjeta({ ...RESERVA, status: 'attended' }, true, { destacar: 'reagendar', puedeVerExpediente: true }).principal)
      .toBe('ver-expediente')
  })
})

describe('vetoPorEstado (G3, 17.3: el servidor)', () => {
  const at = { status: 'attended', start_time: '2026-11-18T15:00:00.000Z', end_time: '2026-11-18T16:00:00.000Z', all_day: false }
  it('una atendida no se confirma, no se cancela ni se mueve', () => {
    expect(vetoPorEstado(at, { status: 'confirmed' })).toMatch(/atendida/)
    expect(vetoPorEstado(at, { status: 'cancelled' })).toMatch(/atendida/)
    expect(vetoPorEstado(at, { start_time: '2026-11-18T16:00:00.000Z' })).toMatch(/fecha/)
    expect(vetoPorEstado(at, { end_time: '2026-11-18T16:30:00.000Z' })).toMatch(/fecha/)
    expect(vetoPorEstado(at, { all_day: true })).toMatch(/fecha/)
  })
  it('una atendida sí: las mismas puntas (otra forma del mismo instante), notas, y corregir su estado', () => {
    expect(vetoPorEstado(at, { start_time: '2026-11-18T09:00:00-06:00', end_time: at.end_time, all_day: false, status: 'attended' })).toBeNull()
    expect(vetoPorEstado(at, { status: 'scheduled' })).toBeNull()
    expect(vetoPorEstado(at, { status: 'no_show' })).toBeNull()
  })
  it('cancelada, no asistió, agendada: nada (Reagendar cita las mueve)', () => {
    for (const status of ['cancelled', 'no_show', 'scheduled', 'confirmed']) {
      expect(vetoPorEstado({ ...at, status }, { status: 'scheduled', start_time: '2026-11-19T15:00:00.000Z' })).toBeNull()
    }
  })
})

describe('vetoPorNotaLigada (G3, decisión de Angel; tanda I, punto 1)', () => {
  const at = { status: 'attended', start_time: '2026-11-18T15:00:00.000Z', end_time: '2026-11-18T16:00:00.000Z', all_day: false }
  it('con nota, una atendida no pasa a ningún otro estado', () => {
    for (const status of ['scheduled', 'confirmed', 'cancelled', 'no_show']) expect(vetoPorNotaLigada(at, { status }, true)).toMatch(/cambiar de estado/)
  })
  it('tanda I · con nota, tampoco se mueve (inicio, fin o todo el día); la misma hora escrita de otra forma, sí', () => {
    expect(vetoPorNotaLigada(at, { start_time: '2026-11-19T15:00:00.000Z', end_time: '2026-11-19T16:00:00.000Z' }, true)).toMatch(/fecha ni de hora/)
    expect(vetoPorNotaLigada(at, { end_time: '2026-11-18T16:30:00.000Z' }, true)).toMatch(/fecha ni de hora/)
    expect(vetoPorNotaLigada(at, { all_day: true }, true)).toMatch(/fecha ni de hora/)
    expect(pideComprobarNota(at, { start_time: '2026-11-18T09:00:00-06:00', end_time: at.end_time, all_day: false, status: 'attended' })).toBe(false)
    expect(vetoPorNotaLigada(at, { start_time: '2026-11-19T15:00:00.000Z' }, false)).toBeNull()
  })
  it('sin nota, sí (corregir un error); y sin cambio de estado ni de hora no se pregunta', () => {
    expect(vetoPorNotaLigada(at, { status: 'scheduled' }, false)).toBeNull()
    expect(pideComprobarNota(at, { status: 'attended' })).toBe(false)
    expect(pideComprobarNota(at, {})).toBe(false)
    expect(pideComprobarNota({ ...at, status: 'scheduled' }, { status: 'cancelled' })).toBe(false)
    expect(pideComprobarNota({ ...at, status: 'scheduled' }, { start_time: '2026-11-19T15:00:00.000Z' })).toBe(false)
    expect(pideComprobarNota(at, { status: 'scheduled' })).toBe(true)
  })
})

describe('cuandoDeTarjeta (G3)', () => {
  it('«Lun 16 nov · 09:00 – 10:00» en la zona de quien mira, y la duración', () => {
    expect(cuandoDeTarjeta({ start_time: '2026-11-16T15:00:00Z', end_time: '2026-11-16T16:00:00Z' }, 'America/Merida'))
      .toEqual({ fechaHora: 'Lun 16 nov · 09:00 – 10:00', duracion: '60 min' })
  })
})

describe('nombre y teléfono', () => {
  const base = { title: 'Junta', pacientes: null, reserva_nombre: null, paciente_id: null, reserva_canal: null }
  it('el paciente, luego quien reservó, luego el título', () => {
    expect(nombreDeTarjeta({ ...base, pacientes: { id: 'p', nombre: 'Ana', apellidos: 'Pech', telefono: '999' } })).toBe('Ana Pech')
    expect(nombreDeTarjeta({ ...base, reserva_canal: 'unico', reserva_nombre: 'Luis Can' })).toBe('Luis Can')
    expect(nombreDeTarjeta(base)).toBe('Junta')
  })
  it('el teléfono de la ficha o el de la reserva', () => {
    expect(telefonoDeTarjeta({ pacientes: { id: 'p', nombre: 'A', apellidos: 'B', telefono: '999' }, reserva_telefono: '111' })).toBe('999')
    expect(telefonoDeTarjeta({ pacientes: null, reserva_telefono: '111' })).toBe('111')
    expect(telefonoDeTarjeta({ pacientes: null })).toBeNull()
  })
})

describe('horarioDeTarjeta', () => {
  const cita = { start_time: '2026-11-11T16:00:00Z', end_time: '2026-11-11T17:00:00Z' }
  it('en la zona de quien mira, sin aviso si el consultorio da la misma hora', () => {
    expect(horarioDeTarjeta({ ...cita, consultorio_timezone: 'America/Merida' }, 'America/Mexico_City'))
      .toEqual({ tramo: '10:00–11:00', enConsultorio: null })
  })
  it('con la hora del consultorio aparte si difiere', () => {
    const h = horarioDeTarjeta({ ...cita, consultorio_timezone: 'America/Cancun' }, 'America/Merida')
    expect(h.tramo).toBe('10:00–11:00')
    expect(h.enConsultorio).toMatch(/^11:00–12:00 hora /)
  })
  it('sin zona del consultorio, sólo el tramo', () => {
    expect(horarioDeTarjeta({ ...cita, consultorio_timezone: null }, 'America/Merida').enConsultorio).toBeNull()
  })
})

/* ── F3 · el enchufe de la tarjeta ─────────────────────────────────────── */

describe('accionesDeTarjeta sin `cambiarEstadoCita`', () => {
  it('no ofrece «Confirmar» aunque la cita esté agendada', () => {
    expect(accionesDeTarjeta({ ...CITA, status: 'scheduled' }, false, false)).toEqual(['reagendar', 'cancelar'])
  })
})

describe('puedeIniciarConsulta (las condiciones del modal)', () => {
  const medico = { esMedico: true, perfilId: 'm1', consultorioExiste: true }
  const conPaciente = { pacientes: { id: 'p', nombre: 'Ana', apellidos: 'Pech', telefono: null }, paciente_id: 'p', reserva_canal: null, medico_id: 'm1' }
  it('médico, su cita, su consultorio y con paciente: sí', () => {
    expect(puedeIniciarConsulta(conPaciente, medico)).toBe(true)
  })
  it('una por ligar suya también (D7 la liga en el modal)', () => {
    expect(puedeIniciarConsulta({ ...conPaciente, pacientes: null, paciente_id: null, reserva_canal: 'fijo' }, medico)).toBe(true)
  })
  it('no: si no es médico, si la cita es de otro, si el consultorio no está o si es un evento', () => {
    expect(puedeIniciarConsulta(conPaciente, { ...medico, esMedico: false })).toBe(false)
    expect(puedeIniciarConsulta({ ...conPaciente, medico_id: 'otro' }, medico)).toBe(false)
    expect(puedeIniciarConsulta(conPaciente, { ...medico, consultorioExiste: false })).toBe(false)
    expect(puedeIniciarConsulta({ ...conPaciente, pacientes: null, paciente_id: null }, medico)).toBe(false)
  })
})

describe('textoDeConfirmacion', () => {
  const base = { title: 'Junta', pacientes: null, reserva_nombre: null, paciente_id: null, reserva_canal: null }
  it('cancelar nombra al paciente y dice que la cita se queda (B3)', () => {
    expect(textoDeConfirmacion('cancelar', { ...base, pacientes: { id: 'p', nombre: 'Ana', apellidos: 'Pech', telefono: null } }))
      .toMatch(/^¿Cancelar la cita de Ana Pech\?.*cancelada\.$/)
  })
  it('eliminar nombra el evento', () => {
    expect(textoDeConfirmacion('eliminar', base)).toBe('¿Eliminar el evento «Junta»? No se puede deshacer.')
  })
  it('«Eliminar cita» nombra al paciente y dice que sale de la agenda sin borrarse (tanda L, punto 9)', () => {
    expect(textoDeConfirmacion('eliminar-cita', { ...base, pacientes: { id: 'p', nombre: 'Ana', apellidos: 'Pech', telefono: null } }))
      .toBe('¿Eliminar la cita cancelada de Ana Pech? Sale de la agenda y no se puede deshacer; queda guardada en el historial.')
  })
  it('«Eliminar cita» de una por ligar nombra a quien reservó; de una de Google por asignar, su título', () => {
    expect(textoDeConfirmacion('eliminar-cita', { ...base, reserva_canal: 'fijo', reserva_nombre: 'Luis Canul' }))
      .toBe('¿Eliminar la cita cancelada de Luis Canul? Sale de la agenda y no se puede deshacer; queda guardada en el historial.')
    expect(textoDeConfirmacion('eliminar-cita', { ...base, title: 'Revisión de rodilla' }))
      .toMatch(/^¿Eliminar la cita cancelada de Revisión de rodilla\?/)
  })
  it('«No asistió» nombra al paciente y dice que la cita se queda (tanda L, punto 2)', () => {
    expect(textoDeConfirmacion('no-asistio', { ...base, pacientes: { id: 'p', nombre: 'Ana', apellidos: 'Pech', telefono: null } }))
      .toBe('¿Marcar que Ana Pech no asistió? La cita se queda en la agenda como «No asistió».')
  })
})

/* T3 · punto 6 (AG-DT-29). MUTACIÓN: devolver siempre `['editar', 'eliminar']`
   a los eventos → «nacido en Google, con hora…» en rojo. */
describe('«Convertir en cita» (un evento nacido en Google)', () => {
  const EVENTO_GOOGLE = { paciente_id: null, reserva_canal: null, origen: 'google', all_day: false, medico_id: 'm1' } as const
  it('nacido en Google, con hora, con médico y vivo: editar, convertir y eliminar', () => {
    for (const status of ['scheduled', 'confirmed'] as const) {
      expect(accionesDeTarjeta({ ...EVENTO_GOOGLE, status }, false)).toEqual(['editar', 'convertir', 'eliminar'])
    }
  })
  it('no: nacido en Spinus, de todo el día, sin médico, cancelado, con paciente o por ligar', () => {
    const casos = [
      { ...EVENTO_GOOGLE, origen: 'spinus' as const }, { ...EVENTO_GOOGLE, origen: undefined },
      { ...EVENTO_GOOGLE, all_day: true }, { ...EVENTO_GOOGLE, medico_id: null },
    ]
    for (const c of casos) expect(esConvertible({ ...c, status: 'scheduled' })).toBe(false)
    expect(esConvertible({ ...EVENTO_GOOGLE, status: 'cancelled' })).toBe(false)
    expect(esConvertible({ ...EVENTO_GOOGLE, paciente_id: 'p1', status: 'scheduled' })).toBe(false)
    expect(esConvertible({ ...EVENTO_GOOGLE, reserva_canal: 'fijo', status: 'scheduled' })).toBe(false)
  })
})
