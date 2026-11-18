/**
 * ventanaLigarCita.test.ts — tanda J, punto 7: quién puede ligar desde la
 * ventana (`motivoSinLigar`), la lectura sin `as` de la fila (`leerCitaParaLigar`)
 * y qué avisos de la campana la abren (`avisoSeLiga`).
 *
 * MUTACIONES comprobadas en rojo:
 *   · quitar la comprobación de `status` en `motivoSinLigar` → «cancelada»;
 *   · `conConsultorio = true` en `motivoSinLigar` → «consultorio ajeno»;
 *   · quitar `c.medico_id === quien.perfilId` de `avisoSeLiga` → «de otro médico»;
 *   · añadir `'cancelacion_paciente'` a `AVISOS_DE_LIGAR` → «cancelación».
 */
import { describe, it, expect } from 'vitest'
import { leerCitaParaLigar, motivoSinLigar, type CitaParaLigar } from '@/components/agenda/VentanaLigarCita'
import { avisoSeLiga } from '@/components/agenda/CampanaAgenda'
import type { AvisoClinica } from '@/lib/avisos/avisosClinica'

const RESERVA: CitaParaLigar = {
  id: 'c1', title: 'Reserva', start_time: '2026-11-19T16:00:00Z', end_time: '2026-11-19T16:30:00Z',
  medico_id: 'm1', consultorio_id: 'co1', consultorio_nombre: 'Centro', consultorio_timezone: 'America/Merida',
  paciente_id: null, status: 'scheduled', updated_at: '2026-11-17T00:00:00Z', reserva_canal: 'unico',
  reserva_nombre: 'Lucía Méndez', reserva_telefono: '5512345678', reserva_correo: 'l@ejemplo.test', google_asignacion: null,
}
const MEDICO = { esMedico: true, perfilId: 'm1' }
const MIOS = [{ id: 'co1' }]

describe('motivoSinLigar', () => {
  it('el médico de la cita, con su consultorio: se liga', () => {
    expect(motivoSinLigar(RESERVA, MEDICO, MIOS)).toBeNull()
  })
  it('ya ligada, cancelada, de otro médico, o la secretaria: no', () => {
    expect(motivoSinLigar({ ...RESERVA, paciente_id: 'p1' }, MEDICO, MIOS)).toMatch(/ya no está por ligar/)
    expect(motivoSinLigar({ ...RESERVA, status: 'cancelled' }, MEDICO, MIOS)).toMatch(/ya no está vigente/)
    expect(motivoSinLigar(RESERVA, { esMedico: true, perfilId: 'm2' }, MIOS)).toMatch(/Sólo el médico/)
    expect(motivoSinLigar(RESERVA, { esMedico: false, perfilId: 'm1' }, MIOS)).toMatch(/Sólo el médico/)
  })
  it('consultorio ajeno: no; una por asignar (sin consultorio) basta con tener alguno', () => {
    expect(motivoSinLigar(RESERVA, MEDICO, [{ id: 'otro' }])).toMatch(/no está entre los tuyos/)
    const google = { ...RESERVA, reserva_canal: null, consultorio_id: null, google_asignacion: 'por_asignar' }
    expect(motivoSinLigar(google, MEDICO, MIOS)).toBeNull()
    expect(motivoSinLigar(google, MEDICO, [])).toMatch(/no está entre los tuyos/)
  })
})

describe('leerCitaParaLigar', () => {
  it('lee la fila de PostgREST y rechaza lo que no tiene forma', () => {
    expect(leerCitaParaLigar({ ...RESERVA, extra: 1 })).toEqual(RESERVA)
    expect(leerCitaParaLigar({ id: 'x' })).toBeNull()
    expect(leerCitaParaLigar(null)).toBeNull()
  })
})

describe('avisoSeLiga', () => {
  const aviso = (tipo: AvisoClinica['tipo'], cita: Partial<AvisoClinica['cita']> = {}): AvisoClinica => ({
    id: 'a1', tipo, creado_en: '2026-11-17T00:00:00Z',
    cita: { id: 'c1', title: 'Reserva', start_time: RESERVA.start_time, end_time: RESERVA.end_time, status: 'scheduled',
      medico_id: 'm1', paciente_id: null, reserva_nombre: 'Lucía', zona: null, reserva_canal: 'unico', google_asignacion: null, ...cita },
  })
  it('reserva, reagendada o Google por asignar del médico que mira, aún por ligar: abre la ventana', () => {
    expect(avisoSeLiga(aviso('reserva_enlace'), MEDICO)).toBe(true)
    expect(avisoSeLiga(aviso('reagendado_paciente'), MEDICO)).toBe(true)
    expect(avisoSeLiga(aviso('google_por_asignar', { reserva_canal: null, google_asignacion: 'por_asignar' }), MEDICO)).toBe(true)
  })
  it('lo demás abre la cita como antes', () => {
    expect(avisoSeLiga(aviso('cancelacion_paciente', { status: 'cancelled' }), MEDICO)).toBe(false)
    expect(avisoSeLiga(aviso('reserva_enlace', { paciente_id: 'p1' }), MEDICO)).toBe(false)
    expect(avisoSeLiga(aviso('reserva_enlace'), { esMedico: true, perfilId: 'm2' }), 'de otro médico').toBe(false)
    expect(avisoSeLiga(aviso('reserva_enlace'), { esMedico: false, perfilId: 'm1' })).toBe(false)
  })
  it('cancelación: aunque la cita siga por ligar, no abre la ventana', () => {
    expect(avisoSeLiga(aviso('cancelacion_paciente'), MEDICO)).toBe(false)
  })
})
