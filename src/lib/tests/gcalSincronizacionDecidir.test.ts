/**
 * La decisión pura de la sincronización de vuelta (bloque C, paso C3).
 *
 * Contra un Google SIMULADO: los eventos son objetos con la forma de
 * `calendar_v3.Schema$Event` escritos a mano. Nada sale a la red.
 *
 * Reglas que fija, una por bloque: mover, editar, borrar, crear, recurrentes
 * (C-a), título con paciente (C-d), estados cerrados (C-e), descripción (S1),
 * conflicto en los dos sentidos, eco y el caso heredado de AG-DT-5.
 */
import { describe, it, expect } from 'vitest'
import {
  decidirEvento,
  marcaSpinus,
  puntasDesdeGoogle,
  resumenEsperado,
  textoPlano,
  type ContextoDecision,
  type EventoGoogle,
  type FilaEspejo,
} from '@/lib/gcalSincronizacionDecidir'

const CAL = 'cal-spinus@group.calendar.google.com'
const MEDICO = '11111111-1111-4111-8111-111111111111'
const CITA = '22222222-2222-4222-8222-222222222222'

const ctx: ContextoDecision = {
  calendarId: CAL,
  ventanaDesde: '2031-04-01T00:00:00.000Z',
  zonaCalendario: 'America/Mexico_City',
  medicoId: MEDICO,
  ahora: Date.parse('2031-06-01T00:00:00Z'),
}

/** Una cita SIN paciente de Spinus, ligada y sincronizada. */
function fila(cambios: Partial<FilaEspejo> = {}): FilaEspejo {
  return {
    id: CITA, googleEventId: 'ev1', gcalCalendarId: CAL, gcalEtag: '"e1"', gcalSyncStatus: 'synced',
    origen: 'spinus', status: 'scheduled',
    inicio: '2031-05-06T16:00:00.000Z', fin: '2031-05-06T17:00:00.000Z', todoElDia: false,
    zona: 'America/Mexico_City', updatedAt: '2031-05-01T00:00:00.000Z',
    conPaciente: false, tituloSinPaciente: 'Junta', notasDeGoogle: null, paciente: null,
    ...cambios,
  }
}

/** La misma cita, CON paciente. */
function filaConPaciente(cambios: Partial<FilaEspejo> = {}): FilaEspejo {
  return fila({ conPaciente: true, tituloSinPaciente: null, paciente: { nombre: 'Ana', apellidos: 'Pérez' }, ...cambios })
}

/** El evento tal como Spinus lo escribió para `fila()`, con otro etag y posterior. */
function evento(cambios: Partial<EventoGoogle> = {}): EventoGoogle {
  return {
    id: 'ev1', etag: '"e2"', status: 'confirmed', updated: '2031-05-02T00:00:00.000Z', summary: 'Junta',
    start: { dateTime: '2031-05-06T10:00:00-06:00', timeZone: 'America/Mexico_City' },
    end: { dateTime: '2031-05-06T11:00:00-06:00', timeZone: 'America/Mexico_City' },
    ...cambios,
  }
}

const moverA = { start: { dateTime: '2031-05-06T12:00:00-06:00' }, end: { dateTime: '2031-05-06T13:00:00-06:00' } }

describe('eco', () => {
  it('mismo etag que el guardado: ignorar', () => {
    expect(decidirEvento(evento({ etag: '"e1"' }), fila(), ctx)).toEqual({ tipo: 'ignorar', motivo: 'eco_etag' })
  })

  it('etag distinto y contenido igual: aplicar sin cambios (sólo guarda el etag)', () => {
    const d = decidirEvento(evento(), fila(), ctx)
    expect(d).toMatchObject({ tipo: 'aplicar', etag: '"e2"', cambios: {}, campos: [], restablecer: [], conflicto: null })
  })

  it('una cita cancelada en Spinus lleva «CANCELADA — » en Google y eso no es una edición', () => {
    const d = decidirEvento(evento({ summary: 'CANCELADA — Junta' }), fila({ status: 'cancelled' }), ctx)
    expect(d).toMatchObject({ tipo: 'aplicar', cambios: {}, restablecer: [] })
  })

  it('con paciente, el «Cita médica: <nombre>» que compone Spinus no es una edición', () => {
    const d = decidirEvento(evento({ summary: 'Cita médica: Ana Pérez' }), filaConPaciente(), ctx)
    expect(d).toMatchObject({ tipo: 'aplicar', cambios: {}, restablecer: [] })
  })
})

describe('mover', () => {
  it('con hora: aplica las puntas nuevas por instante', () => {
    const d = decidirEvento(evento(moverA), fila(), ctx)
    expect(d).toMatchObject({
      tipo: 'aplicar', campos: ['hora'], esperadoUpdatedAt: '2031-05-01T00:00:00.000Z', actualizado: '2031-05-02T00:00:00.000Z',
      cambios: { puntas: { inicio: '2031-05-06T18:00:00.000Z', fin: '2031-05-06T19:00:00.000Z', todoElDia: false } },
    })
  })

  it('sin paciente a todo el día: medianoches en la zona de la fila', () => {
    const d = decidirEvento(evento({ start: { date: '2031-05-06' }, end: { date: '2031-05-07' } }), fila(), ctx)
    expect(d).toMatchObject({
      tipo: 'aplicar',
      cambios: { puntas: { inicio: '2031-05-06T06:00:00.000Z', fin: '2031-05-07T06:00:00.000Z', todoElDia: true } },
    })
  })

  it('a todo el día sin zona en la fila: se rechaza (la CHECK no se cumpliría)', () => {
    const d = decidirEvento(evento({ start: { date: '2031-05-06' }, end: { date: '2031-05-07' } }), fila({ zona: null }), ctx)
    expect(d).toMatchObject({ tipo: 'aplicar', cambios: {}, restablecer: ['hora'] })
  })

  it('con paciente: de hora a hora sí', () => {
    expect(decidirEvento(evento({ ...moverA, summary: 'Cita médica: Ana Pérez' }), filaConPaciente(), ctx))
      .toMatchObject({ tipo: 'aplicar', campos: ['hora'] })
  })

  it('con paciente a todo el día: no se acepta y se restablece', () => {
    const d = decidirEvento(
      evento({ summary: 'Cita médica: Ana Pérez', start: { date: '2031-05-06' }, end: { date: '2031-05-07' } }),
      filaConPaciente(), ctx)
    expect(d).toMatchObject({ tipo: 'aplicar', cambios: {}, campos: [], restablecer: ['hora'] })
  })

  it('más largo que el tope de una cita: no se acepta y se restablece', () => {
    const d = decidirEvento(
      evento({ summary: 'Cita médica: Ana Pérez', end: { dateTime: '2031-05-07T10:00:00-06:00' } }), filaConPaciente(), ctx)
    expect(d).toMatchObject({ tipo: 'aplicar', cambios: {}, restablecer: ['hora'] })
  })

  it('AG-DT-5 heredado: fila de todo el día y evento con dateTime de medianoche a medianoche = igual', () => {
    const f = fila({ todoElDia: true, inicio: '2031-05-06T06:00:00.000Z', fin: '2031-05-07T06:00:00.000Z' })
    const e = evento({ start: { dateTime: '2031-05-06T00:00:00-06:00' }, end: { dateTime: '2031-05-07T00:00:00-06:00' } })
    expect(decidirEvento(e, f, ctx)).toMatchObject({ tipo: 'aplicar', cambios: {}, campos: [] })
  })

  it('AG-DT-5 heredado y MOVIDO un día en Google: sigue siendo de todo el día', () => {
    const f = fila({ todoElDia: true, inicio: '2031-05-06T06:00:00.000Z', fin: '2031-05-07T06:00:00.000Z' })
    const e = evento({ start: { dateTime: '2031-05-07T00:00:00-06:00' }, end: { dateTime: '2031-05-08T00:00:00-06:00' } })
    expect(decidirEvento(e, f, ctx)).toMatchObject({
      tipo: 'aplicar', campos: ['hora'],
      cambios: { puntas: { inicio: '2031-05-07T06:00:00.000Z', fin: '2031-05-08T06:00:00.000Z', todoElDia: true } },
    })
  })

  it('una fila con hora que en Google queda de medianoche a medianoche con dateTime sigue con hora', () => {
    const e = evento({ start: { dateTime: '2031-05-07T00:00:00-06:00' }, end: { dateTime: '2031-05-08T00:00:00-06:00' } })
    expect(decidirEvento(e, fila(), ctx)).toMatchObject({ cambios: { puntas: { todoElDia: false } } })
  })
})

describe('editar', () => {
  it('título sin paciente: vuelve a Spinus', () => {
    expect(decidirEvento(evento({ summary: '  Junta de staff ' }), fila(), ctx))
      .toMatchObject({ tipo: 'aplicar', cambios: { titulo: 'Junta de staff' }, campos: ['titulo'] })
  })

  it('título vacío sin paciente: no se acepta, se restablece', () => {
    expect(decidirEvento(evento({ summary: '   ' }), fila(), ctx)).toMatchObject({ tipo: 'aplicar', cambios: {}, restablecer: ['titulo'] })
  })

  it('C-d: título de una cita CON paciente: no se acepta y se marca para restablecer', () => {
    const d = decidirEvento(evento({ summary: 'Otra cosa' }), filaConPaciente(), ctx)
    expect(d).toMatchObject({ tipo: 'aplicar', cambios: {}, campos: [], restablecer: ['titulo'] })
  })

  it('con paciente y sin nombre conocido: no se puede comparar el título y no se marca', () => {
    expect(decidirEvento(evento({ summary: 'Otra cosa' }), filaConPaciente({ paciente: null }), ctx))
      .toMatchObject({ tipo: 'aplicar', restablecer: [] })
  })

  it('S1: la descripción de una cita con paciente no entra', () => {
    const d = decidirEvento(evento({ summary: 'Cita médica: Ana Pérez', description: 'diagnóstico' }), filaConPaciente(), ctx)
    expect(d).toMatchObject({ tipo: 'aplicar', cambios: {}, campos: [] })
  })

  it('S1: la descripción de un evento de Spinus sin paciente no entra', () => {
    expect(decidirEvento(evento({ description: 'algo' }), fila(), ctx)).toMatchObject({ tipo: 'aplicar', cambios: {}, campos: [] })
  })

  it('S1: un evento nacido en Google sin paciente sí trae su descripción, en texto plano', () => {
    const d = decidirEvento(evento({ description: 'Sala <b>2</b><br>Llevar &amp; traer' }),
      fila({ origen: 'google', notasDeGoogle: 'viejo' }), ctx)
    expect(d).toMatchObject({ tipo: 'aplicar', cambios: { notas: 'Sala 2\nLlevar & traer' }, campos: ['notas'] })
  })

  it('S1: vaciar la descripción en Google vacía las notas', () => {
    expect(decidirEvento(evento({ description: '' }), fila({ origen: 'google', notasDeGoogle: 'algo' }), ctx))
      .toMatchObject({ cambios: { notas: null } })
  })

  it('S1: nacido en Google pero ya ligado a un paciente: la descripción deja de entrar', () => {
    const d = decidirEvento(evento({ summary: 'Cita médica: Ana Pérez', description: 'nuevo' }),
      filaConPaciente({ origen: 'google', notasDeGoogle: null }), ctx)
    expect(d).toMatchObject({ tipo: 'aplicar', cambios: {}, campos: [] })
  })
})

describe('borrar', () => {
  it('cita agendada: se cancela y se desvincula', () => {
    const d = decidirEvento({ id: 'ev1', status: 'cancelled' }, fila(), ctx)
    expect(d).toMatchObject({
      tipo: 'aplicar', desvincular: true, etag: null, cambios: { cancelar: true }, campos: ['borrado'],
      actualizado: '2031-06-01T00:00:00.000Z',
    })
  })

  it.each(['attended', 'no_show', 'cancelled'] as const)('C-e: %s borrada en Google: se rechaza y se restablece', (status) => {
    expect(decidirEvento({ id: 'ev1', status: 'cancelled' }, fila({ status }), ctx)).toEqual({
      tipo: 'rechazar', citaId: CITA, motivo: 'estado_cerrado', campos: ['borrado'], restablecer: true,
    })
  })

  it('borrado de un evento sin fila: ignorar (no se crea nada)', () => {
    expect(decidirEvento({ id: 'evx', status: 'cancelled' }, null, ctx)).toEqual({ tipo: 'ignorar', motivo: 'cancelado_sin_fila' })
  })

  it('Spinus editó después del borrado: gana Spinus', () => {
    const d = decidirEvento({ id: 'ev1', status: 'cancelled', updated: '2031-04-30T00:00:00.000Z' }, fila(), ctx)
    expect(d).toMatchObject({ tipo: 'rechazar', motivo: 'gana_spinus', campos: ['borrado'] })
  })
})

describe('C-e: estados cerrados no aceptan cambios', () => {
  it.each(['attended', 'no_show', 'cancelled'] as const)('%s movida en Google: rechazar y restablecer', (status) => {
    const d = decidirEvento(evento({ ...moverA, summary: status === 'cancelled' ? 'CANCELADA — Junta' : 'Junta' }), fila({ status }), ctx)
    expect(d).toEqual({ tipo: 'rechazar', citaId: CITA, motivo: 'estado_cerrado', campos: ['hora'], restablecer: true })
  })

  it('attended sin diferencias (p. ej. cambió un invitado): sólo guarda el etag', () => {
    expect(decidirEvento(evento(), fila({ status: 'attended' }), ctx)).toMatchObject({ tipo: 'aplicar', cambios: {} })
  })
})

describe('ramas sueltas', () => {
  it('evento ligado sin etag: ignorar', () => {
    expect(decidirEvento(evento({ etag: undefined }), fila(), ctx)).toEqual({ tipo: 'ignorar', motivo: 'sin_etag' })
  })

  it('borrado de un evento que sólo se ligaría por la marca: ignorar, no se liga ni se cancela', () => {
    const e: EventoGoogle = { id: 'ev-nuevo', status: 'cancelled', extendedProperties: { private: { spinus_cita: CITA } } }
    expect(decidirEvento(e, fila({ googleEventId: null }), ctx)).toEqual({ tipo: 'ignorar', motivo: 'cancelado_sin_vinculo' })
  })

  it('C-e × S1: las notas de un evento de Google tampoco entran si la cita está cerrada', () => {
    const d = decidirEvento(evento({ description: 'nuevo' }), fila({ origen: 'google', notasDeGoogle: 'viejo', status: 'no_show' }), ctx)
    expect(d).toEqual({ tipo: 'rechazar', citaId: CITA, motivo: 'estado_cerrado', campos: ['notas'], restablecer: true })
  })

  it('cerrada con varios cambios a la vez: todos los campos en la auditoría', () => {
    const d = decidirEvento(evento({ ...moverA, summary: 'Otra' }), fila({ status: 'attended' }), ctx)
    expect(d).toEqual({ tipo: 'rechazar', citaId: CITA, motivo: 'estado_cerrado', campos: ['hora', 'titulo'], restablecer: true })
  })

  it('con paciente: hora aceptada y título restablecido en la misma decisión', () => {
    expect(decidirEvento(evento({ ...moverA, summary: 'Otra' }), filaConPaciente(), ctx)).toEqual({
      tipo: 'aplicar', citaId: CITA, esperadoUpdatedAt: '2031-05-01T00:00:00.000Z', etag: '"e2"',
      actualizado: '2031-05-02T00:00:00.000Z', vincular: null, desvincular: false,
      cambios: { puntas: { inicio: '2031-05-06T18:00:00.000Z', fin: '2031-05-06T19:00:00.000Z', todoElDia: false } },
      campos: ['hora'], conflicto: null, restablecer: ['titulo'],
    })
  })
})

describe('conflicto', () => {
  it('Google posterior a Spinus: gana Google; si la fila tenía escritura pendiente, se marca', () => {
    expect(decidirEvento(evento(moverA), fila({ gcalSyncStatus: 'failed' }), ctx))
      .toMatchObject({ tipo: 'aplicar', conflicto: 'gana_google', campos: ['hora'] })
    expect(decidirEvento(evento(moverA), fila({ gcalSyncStatus: 'pending' }), ctx)).toMatchObject({ conflicto: 'gana_google' })
  })

  it('Spinus posterior a Google: gana Spinus, se rechaza y se marca para restablecer', () => {
    expect(decidirEvento(evento({ ...moverA, updated: '2031-04-30T00:00:00.000Z' }), fila(), ctx))
      .toEqual({ tipo: 'rechazar', citaId: CITA, motivo: 'gana_spinus', campos: ['hora'], restablecer: true })
  })

  it('misma hora exacta: no es posterior, gana Spinus', () => {
    expect(decidirEvento(evento({ ...moverA, updated: '2031-05-01T00:00:00.000Z' }), fila(), ctx)).toMatchObject({ tipo: 'rechazar' })
  })
})

describe('crear (importar)', () => {
  it('un evento nuevo con hora: importar con la zona del evento y el dueño como médico', () => {
    const d = decidirEvento(evento({ id: 'nuevo', summary: ' Cirugía ', description: '<p>Quirófano</p>' }), null, ctx)
    expect(d).toEqual({
      tipo: 'importar',
      datos: {
        googleEventId: 'nuevo', etag: '"e2"', actualizado: '2031-05-02T00:00:00.000Z', titulo: 'Cirugía', zona: 'America/Mexico_City',
        puntas: { inicio: '2031-05-06T16:00:00.000Z', fin: '2031-05-06T17:00:00.000Z', todoElDia: false },
        notas: 'Quirófano', medicoId: MEDICO,
      },
    })
  })

  it('todo el día: con la zona del calendario', () => {
    const d = decidirEvento({ id: 'dia', etag: '"d"', status: 'confirmed', start: { date: '2031-05-10' }, end: { date: '2031-05-12' } },
      null, { ...ctx, zonaCalendario: 'America/Hermosillo' })
    expect(d).toMatchObject({
      tipo: 'importar',
      datos: { zona: 'America/Hermosillo', titulo: null, puntas: { inicio: '2031-05-10T07:00:00.000Z', todoElDia: true } },
    })
  })

  it('zona inválida: cae a la de la clínica', () => {
    const d = decidirEvento(evento({ id: 'z', start: { dateTime: '2031-05-06T10:00:00-06:00', timeZone: 'Marte/Olympus' } }),
      null, { ...ctx, zonaCalendario: null })
    expect(d).toMatchObject({ tipo: 'importar', datos: { zona: 'America/Mexico_City' } })
  })

  it('termina antes de la ventana: no se importa', () => {
    expect(decidirEvento(evento({ id: 'viejo', start: { dateTime: '2031-03-01T10:00:00Z' }, end: { dateTime: '2031-03-01T11:00:00Z' } }),
      null, ctx)).toEqual({ tipo: 'ignorar', motivo: 'fuera_de_ventana' })
  })

  it('más largo que el tope de un evento: no se importa', () => {
    expect(decidirEvento(evento({ id: 'largo', end: { dateTime: '2033-05-06T11:00:00-06:00' } }), null, ctx))
      .toEqual({ tipo: 'ignorar', motivo: 'excede_tope' })
  })

  it('sin puntas legibles: no se importa', () => {
    expect(decidirEvento(evento({ id: 'raro', start: { date: '2031-05-06' }, end: { dateTime: '2031-05-06T11:00:00Z' } }), null, ctx))
      .toEqual({ tipo: 'ignorar', motivo: 'sin_puntas' })
  })

  it('con la marca de una cita de Spinus que no existe: no se resucita', () => {
    const e = evento({ id: 'huérfano', extendedProperties: { private: { spinus_cita: CITA } } })
    expect(decidirEvento(e, null, ctx)).toEqual({ tipo: 'ignorar', motivo: 'marca_sin_fila' })
  })

  it('fuera de oficina y demás tipos especiales: no', () => {
    expect(decidirEvento(evento({ id: 'ooo', eventType: 'outOfOffice' }), null, ctx)).toEqual({ tipo: 'ignorar', motivo: 'tipo_especial' })
  })
})

describe('C-a: recurrentes', () => {
  it('una serie nueva no se importa', () => {
    expect(decidirEvento(evento({ id: 'serie', recurrence: ['RRULE:FREQ=WEEKLY'] }), null, ctx))
      .toEqual({ tipo: 'ignorar', motivo: 'recurrente' })
  })

  it('una ocurrencia tampoco', () => {
    expect(decidirEvento(evento({ id: 'serie_20310506', recurringEventId: 'serie' }), null, ctx))
      .toEqual({ tipo: 'ignorar', motivo: 'recurrente' })
  })

  it('una cita de Spinus convertida en serie en Google: se ignora (la fila no cambia)', () => {
    expect(decidirEvento(evento({ ...moverA, recurrence: ['RRULE:FREQ=DAILY'] }), fila(), ctx))
      .toEqual({ tipo: 'ignorar', motivo: 'recurrente_ligado' })
  })
})

describe('vínculo por la marca de Spinus', () => {
  it('fila sin google_event_id: se liga al evento', () => {
    const e = evento({ id: 'ev-nuevo', extendedProperties: { private: { spinus_cita: CITA } } })
    expect(decidirEvento(e, fila({ googleEventId: null, gcalEtag: null }), ctx))
      .toMatchObject({ tipo: 'aplicar', vincular: 'ev-nuevo', cambios: {} })
  })

  it('fila ligada a OTRO evento (una copia en Google): ignorar', () => {
    const e = evento({ id: 'copia', extendedProperties: { private: { spinus_cita: CITA } } })
    expect(decidirEvento(e, fila(), ctx)).toEqual({ tipo: 'ignorar', motivo: 'marca_ajena' })
  })

  it('fila de otro calendario: ignorar', () => {
    expect(decidirEvento(evento(moverA), fila({ gcalCalendarId: 'otro' }), ctx)).toEqual({ tipo: 'ignorar', motivo: 'otro_calendario' })
  })

  it('marcaSpinus sólo acepta un uuid', () => {
    expect(marcaSpinus(evento({ extendedProperties: { private: { spinus_cita: 'no-uuid' } } }))).toBeNull()
    expect(marcaSpinus(evento({ extendedProperties: { private: { spinus_cita: CITA.toUpperCase() } } }))).toBe(CITA)
  })
})

describe('utilidades', () => {
  it('textoPlano no decodifica dos veces', () => {
    expect(textoPlano('&amp;lt;b&amp;gt;')).toBe('&lt;b&gt;')
    expect(textoPlano('<b>x</b>&nbsp;y')).toBe('x y')
    expect(textoPlano('a'.repeat(6000))).toHaveLength(5000)
  })

  it('puntasDesdeGoogle rechaza fin anterior al inicio', () => {
    expect(puntasDesdeGoogle({ start: { dateTime: '2031-05-06T11:00:00Z' }, end: { dateTime: '2031-05-06T10:00:00Z' } },
      'America/Mexico_City')).toBeNull()
  })

  it('resumenEsperado compone lo mismo que eventoParaGoogle', () => {
    expect(resumenEsperado(filaConPaciente({ status: 'cancelled' }))).toBe('CANCELADA — Cita médica: Ana Pérez')
    expect(resumenEsperado(fila())).toBe('Junta')
  })
})
