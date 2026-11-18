/**
 * duracionRealCita.test.ts — tanda J, punto 12 de Angel: el tipo de cita sólo
 * PROPONE la duración al elegirlo; lo que cuenta es el fin guardado. Con una
 * cita de 50 min de un tipo de 30 min, la tarjeta dice 50 min y la rejilla de
 * turnos del enlace de reserva (`turnosDelDia`) y el evento de la rejilla
 * (`puntasParaLaRejilla`, del que leen la caja, la burbuja, los empalmes y
 * «Huecos disponibles») la cuentan hasta su fin real.
 *
 * MUTACIONES comprobadas en rojo: en `tramosDeCitasEnZona` (turnosAgenda.ts),
 * `hasta = desde + 30` (la duración del tipo) en vez de `end_time` → falla
 * «turnos»; en `cuandoDeTarjeta`, `min = 30` → falla «tarjeta»; en
 * `puntasParaLaRejilla`, `end: start + 30 min` → falla «rejilla».
 */
import { describe, it, expect } from 'vitest'
import type { Horario } from '@/lib/configApp'
import { cuandoDeTarjeta } from '@/lib/agenda/accionesTarjeta'
import { turnosDelDia } from '@/lib/agenda/turnosAgenda'
import { puntasParaLaRejilla } from '@/lib/agenda/fechasAgenda'

const TZ = 'America/Merida'
const dia = { activo: true, inicio: '09:00', fin: '13:00' }
const horario: Horario = { lunes: dia, martes: dia, miercoles: dia, jueves: dia, viernes: dia, sabado: dia, domingo: dia }
/* Jueves 19 de noviembre de 2026, 10:00–10:50 en Mérida (UTC−6); el tipo dura 30. */
const TIPO_MIN = 30
const cita = { start_time: '2026-11-19T16:00:00Z', end_time: '2026-11-19T16:50:00Z', status: 'scheduled' as const }

describe('punto 12 · la duración es la del fin real, no la del tipo', () => {
  it('tarjeta: 50 min', () => {
    expect(cuandoDeTarjeta(cita, TZ).duracion).toBe('50 min')
  })
  it('turnos de la reserva: 10:30 sigue ocupado (la cita acaba a las 10:50); 11:00 se ofrece', () => {
    const turnos = turnosDelDia({ fecha: '2026-11-19', tz: TZ, horario, citas: [cita], duracionMin: TIPO_MIN })
    const inicios = turnos.map(t => t.inicio)
    expect(inicios).not.toContain('2026-11-19T16:30:00.000Z')
    expect(inicios).not.toContain('2026-11-19T16:00:00.000Z')
    expect(inicios).toContain('2026-11-19T17:00:00.000Z')
  })
  it('rejilla (y con ella «Huecos disponibles»): el evento acaba a las 10:50', () => {
    expect(puntasParaLaRejilla({ ...cita, all_day: false, tipo_cita_id: 'tipo-de-30' }).end).toBe(cita.end_time)
  })
})
