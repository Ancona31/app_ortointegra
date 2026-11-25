/**
 * campanaConfirmacion.test.ts — tanda L (L5), puntos 13 y 14 de Angel, en lo
 * que Vitest puede ver sin DOM:
 *   13. el aviso «[Nombre] confirmó su cita del [día] a las [hora]» (nombre del
 *       paciente ligado o, por ligar, el tecleado; día y hora en la zona del
 *       consultorio), su emergente SIN nombre, y qué cambio del canal recarga la
 *       campana cuando una cita pasa a confirmada;
 *   14. lo que dice la burbuja («9+» con más de 9) y el nombre accesible del
 *       botón («N pendiente(s)»).
 * La confirmación de punta a punta (base, ruta, campana y emergente) va en la
 * e2e `agenda-l5-campana`; la regla de la base, en `l5_aviso_confirmacion.sql`.
 *
 * MUTACIONES (comprobadas en rojo): `quienConfirmo` con el nombre tecleado
 * antes que el del paciente ligado; `textoEmergente` sin el nombre (desde 2026-11-24 lo lleva);
 * `cambioPuedeAvisar` sin mirar `pintado` (toda confirmada recarga) o sin
 * `listada`; `textoBurbuja` sin el tope de 9; `etiquetaCampana` sin el
 * singular.
 */
import { describe, expect, it } from 'vitest'
import {
  avisosParaEmergente, destacarDeAviso, leerRespuestaAvisos, textoAviso, textoEmergente, type AvisoDeCita,
} from '@/lib/avisos/avisosClinica'
import { cambioPuedeAvisar, type CambioCita, type FilaCambioCita } from '@/lib/agenda/porConfirmarTiempoReal'
import { etiquetaCampana, textoBurbuja } from '@/components/agenda/CampanaAgenda'

const AHORA = Date.parse('2026-11-18T16:00:00Z')

function confirmacion(cita: Partial<AvisoDeCita['cita']> = {}): AvisoDeCita {
  return {
    id: 'a1', tipo: 'confirmacion_paciente', creado_en: new Date(AHORA - 20_000).toISOString(),
    cita: {
      id: 'c1', title: 'Hugo Interián Pérez', start_time: '2026-11-19T16:45:00Z', end_time: '2026-11-19T17:15:00Z',
      status: 'confirmed', medico_id: 'm1', paciente_id: 'p1', reserva_nombre: 'Hugo', zona: 'America/Merida', ...cita,
    },
  }
}

describe('aviso «confirmó su cita» (tanda L, punto 13)', () => {
  it('con paciente ligado: su nombre (el título de la cita), el día y la hora del consultorio', () => {
    expect(textoAviso(confirmacion())).toBe('Hugo Interián Pérez confirmó su cita del jueves, 19 de noviembre a las 10:45')
  })
  it('por ligar: el nombre que tecleó al reservar', () => {
    expect(textoAviso(confirmacion({ paciente_id: null, title: 'Reserva por enlace', reserva_nombre: 'Ana Ejemplo' })))
      .toBe('Ana Ejemplo confirmó su cita del jueves, 19 de noviembre a las 10:45')
  })
  it('la hora es la del consultorio de la cita, no la del dispositivo', () => {
    expect(textoAviso(confirmacion({ zona: 'America/Tijuana' }))).toBe('Hugo Interián Pérez confirmó su cita del jueves, 19 de noviembre a las 08:45')
  })
  it('el emergente lleva el nombre, como la campana (avisos globales, decisión de Angel del 2026-11-24)', () => {
    expect(textoEmergente(confirmacion())).toBe('Hugo Interián Pérez confirmó su cita del jueves, 19 de noviembre a las 10:45.')
  })
  it('el lector lo acepta, sale como emergente si es reciente y abre la cita sin destacar nada', () => {
    expect(leerRespuestaAvisos({ avisos_disponibles: true, avisos: [confirmacion()] })?.avisos).toHaveLength(1)
    expect(avisosParaEmergente([confirmacion()], new Set(), AHORA, ['confirmacion_paciente']).map((a) => a.id)).toEqual(['a1'])
    expect(destacarDeAviso(confirmacion())).toBeUndefined()
  })
})

describe('cambioPuedeAvisar · una cita que pasa a confirmada (tanda L, punto 13)', () => {
  const fila = (extra: Partial<FilaCambioCita> = {}): FilaCambioCita => ({
    id: 'c1', paciente_id: 'p1', reserva_canal: null, status: 'confirmed', all_day: false, start_time: '2026-11-19T16:45:00Z', ...extra,
  })
  const c = (extra: Partial<FilaCambioCita> = {}, pintado?: string): CambioCita => ({ tipo: 'UPDATE', fila: fila(extra), pintado })
  it('pintada como agendada (puede ser el paciente): recarga', () => {
    expect(cambioPuedeAvisar(c({}, 'scheduled'))).toBe(true)
    expect(cambioPuedeAvisar(c({ paciente_id: null, reserva_canal: 'fijo' }, 'scheduled'))).toBe(true)
  })
  it('en la lista de mañana (sólo salen agendadas), aunque no esté pintada: recarga', () => {
    expect(cambioPuedeAvisar(c(), true)).toBe(true)
  })
  it('ya estaba confirmada (un eco de Google, el «Confirmar» optimista del personal) o no se sabe: no recarga', () => {
    expect(cambioPuedeAvisar(c({}, 'confirmed'))).toBe(false)
    expect(cambioPuedeAvisar(c())).toBe(false)
  })
  it('un evento sin paciente ni reserva no avisa', () => {
    expect(cambioPuedeAvisar(c({ paciente_id: null }, 'scheduled'), true)).toBe(false)
  })
})

describe('la burbuja de la campana (tanda L, punto 14)', () => {
  it('el número; con más de 9, «9+»', () => {
    expect([1, 3, 9, 10, 57].map(n => textoBurbuja(n))).toEqual(['1', '3', '9', '9+', '9+'])
  })
  it('el nombre accesible: el desglose y «N pendiente(s)» con el número exacto', () => {
    expect(etiquetaCampana(null)).toBe('Por confirmar y avisos')
    expect(etiquetaCampana({ n: 0, m: 0 })).toBe('Por confirmar (0) y avisos (0)')
    expect(etiquetaCampana({ n: 1, m: 0 })).toBe('Por confirmar (1) y avisos (0): 1 pendiente')
    expect(etiquetaCampana({ n: 2, m: 1 })).toBe('Por confirmar (2) y avisos (1): 3 pendientes')
    expect(etiquetaCampana({ n: 7, m: 5 })).toBe('Por confirmar (7) y avisos (5): 12 pendientes')
  })
  it('con avisos más antiguos fuera de la lista: «3+» y se dice en el nombre', () => {
    expect([textoBurbuja(3, true), textoBurbuja(12, true), textoBurbuja(3, false)]).toEqual(['3+', '9+', '3'])
    expect(etiquetaCampana({ n: 2, m: 1 }, true)).toBe('Por confirmar (2) y avisos (1): 3 pendientes; hay avisos más antiguos')
    expect(etiquetaCampana({ n: 0, m: 0 }, true)).toBe('Por confirmar (0) y avisos (0); hay avisos más antiguos')
  })
})
