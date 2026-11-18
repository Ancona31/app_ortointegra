/**
 * primeraVez.test.ts — tanda J, J5 (puntos 13, 14 y 17 de Angel): las reglas
 * puras del funnel de primera vez y de la configuración nueva.
 *   · cuándo sale el funnel y en qué paso (`vistaInicial`, `primerPendiente`);
 *   · el recordatorio que la clínica ya tenía fuera de las cuatro opciones no
 *     se pierde (`opcionesRecordatorio`, punto 17);
 *   · qué manda «Continuar» del paso 1 por cada consultorio (`cambiosPaso1`)
 *     y qué opción sale elegida (`modoInicial`);
 *   · cómo escriben el horario las maquetas (`lineasHorario`, `textoHorario`)
 *     y cuántas consultas caben (`consultasQueCaben`);
 *   · el control de días (`horarioGuardable`, `prenderDia`) y la duración
 *     (`eleccionInicial`, `minutosDe`).
 */
import { describe, it, expect } from 'vitest'
import {
  cambiosPaso1, esPrimeraVez, mismoHorario, modoInicial, numeroDePaso, opcionesRecordatorio, pasoClinica, primerPendiente, recordatorioCorto, vistaInicial,
} from '@/lib/agenda/primeraVez'
import { consultasQueCaben, horaCorta, lineasHorario, textoHorario } from '@/lib/agenda/gruposHorario'
import { horarioGuardable, prenderDia } from '@/components/agenda/configuracion/EditorDias'
import { eleccionInicial, minutosDe } from '@/components/agenda/configuracion/PasoDuracion'
import type { Horario } from '@/lib/configApp'

const dia = (activo: boolean, inicio = '08:00', fin = '18:00') => ({ activo, inicio, fin })
/** L–V 8–18, sábado 8–13, domingo cerrado: el horario de la clínica de la maqueta. */
const CLINICA: Horario = {
  lunes: dia(true), martes: dia(true), miercoles: dia(true), jueves: dia(true), viernes: dia(true),
  sabado: dia(true, '08:00', '13:00'), domingo: dia(false, '08:00', '13:00'),
}
const CERRADO: Horario = {
  lunes: dia(false), martes: dia(false), miercoles: dia(false), jueves: dia(false), viernes: dia(false), sabado: dia(false), domingo: dia(false),
}
/** Lunes, miércoles y viernes de 16 a 20; sábado de 9 a 13 (la maqueta, «Horario propio»). */
const PROPIO: Horario = {
  ...CERRADO, lunes: dia(true, '16:00', '20:00'), miercoles: dia(true, '16:00', '20:00'), viernes: dia(true, '16:00', '20:00'), sabado: dia(true, '09:00', '13:00'),
}

const pasos = (horario: boolean, duracion: boolean, enlace: boolean) => [
  { clave: 'horario' as const, hecho: horario }, { clave: 'duracion' as const, hecho: duracion }, { clave: 'enlace' as const, hecho: enlace },
]

describe('K3 (punto 12): el paso de la clínica, primero y sólo para quien administra', () => {
  const conClinica = (horario: boolean, duracion: boolean, enlace: boolean) => {
    const p = pasos(horario, duracion, enlace)
    return [pasoClinica(p), ...p]
  }
  it('la primera vez y tras «Empezar de nuevo» (horario por revisar) abre en la clínica', () => {
    expect(primerPendiente(conClinica(false, false, false))).toBe(0)
    expect(primerPendiente(conClinica(false, true, true))).toBe(0)
    expect(vistaInicial({ esMedico: true, conConsultorio: true, guardado: null, primeraVez: true, pasos: conClinica(false, false, false) }))
      .toEqual({ paso: 0 })
  })
  it('con el horario hecho, la clínica no está pendiente: abre en lo que falta, como antes', () => {
    expect(primerPendiente(conClinica(true, false, true))).toBe(2)
    expect(vistaInicial({ esMedico: true, conConsultorio: true, guardado: null, primeraVez: true, pasos: conClinica(true, true, true) })).toBe('pestanas')
  })
  it('«Terminar después» en el paso de la clínica vuelve a él', () => {
    expect(vistaInicial({ esMedico: true, conConsultorio: true, guardado: 0, primeraVez: false, pasos: conClinica(true, true, true) }))
      .toEqual({ paso: 0 })
  })
  it('el contador: «Paso 1 de 4» para quien administra, «Paso 1 de 3» para los demás', () => {
    expect(numeroDePaso(0, true)).toEqual({ n: 1, de: 4 })
    expect(numeroDePaso(1, true)).toEqual({ n: 2, de: 4 })
    expect(numeroDePaso(3, true)).toEqual({ n: 4, de: 4 })
    expect(numeroDePaso(1, false)).toEqual({ n: 1, de: 3 })
    expect(numeroDePaso(3, false)).toEqual({ n: 3, de: 3 })
  })
})

describe('cuándo sale el funnel', () => {
  it('abre en el primer paso que falta', () => {
    expect(primerPendiente(pasos(false, false, false))).toBe(1)
    expect(primerPendiente(pasos(true, false, true))).toBe(2)
    expect(primerPendiente(pasos(true, true, false))).toBe(3)
    expect(primerPendiente(pasos(true, true, true))).toBeNull()
  })

  it('a un médico con todo hecho le salen las pestañas; con algo pendiente, el funnel', () => {
    const base = { esMedico: true, conConsultorio: true, guardado: null, primeraVez: true }
    expect(vistaInicial({ ...base, pasos: pasos(true, true, true) })).toBe('pestanas')
    expect(vistaInicial({ ...base, pasos: pasos(true, false, true) })).toEqual({ paso: 2 })
  })

  it('«Terminar después» vuelve al paso apuntado aunque falten otros antes', () => {
    expect(vistaInicial({ esMedico: true, conConsultorio: true, pasos: pasos(false, false, false), guardado: 3, primeraVez: true })).toEqual({ paso: 3 })
    expect(vistaInicial({ esMedico: true, conConsultorio: true, pasos: pasos(true, true, false), guardado: 3, primeraVez: false })).toEqual({ paso: 3 })
  })

  it('sin datos espera; si no se pudieron calcular, pestañas; sin consultorio o sin ser médico, pestañas', () => {
    const b = { guardado: null, primeraVez: true }
    expect(vistaInicial({ ...b, esMedico: true, conConsultorio: true, pasos: undefined })).toBe('cargando')
    expect(vistaInicial({ ...b, esMedico: true, conConsultorio: true, pasos: null })).toBe('pestanas')
    expect(vistaInicial({ ...b, esMedico: true, conConsultorio: false, pasos: pasos(false, false, false), guardado: 1 })).toBe('pestanas')
    expect(vistaInicial({ ...b, esMedico: false, conConsultorio: true, pasos: pasos(false, false, false) })).toBe('pestanas')
  })

  it('sólo la primera vez: lo que falte después (un consultorio nuevo, el enlace apagado) se arregla en las pestañas', () => {
    const base = { esMedico: true, conConsultorio: true, guardado: null }
    expect(vistaInicial({ ...base, pasos: pasos(false, true, true), primeraVez: false })).toBe('pestanas')
    expect(vistaInicial({ ...base, pasos: pasos(true, true, false), primeraVez: false })).toBe('pestanas')
  })

  it('primera vez = sin duración propia, o con TODOS sus consultorios por revisar', () => {
    const revisado = { horario_revisado_en: '2026-11-01' }
    const porRevisar = { horario_revisado_en: null }
    expect(esPrimeraVez(pasos(true, false, true), [revisado])).toBe(true)
    expect(esPrimeraVez(pasos(false, true, true), [porRevisar, porRevisar])).toBe(true)
    expect(esPrimeraVez(pasos(false, true, true), [revisado, porRevisar])).toBe(false)
    expect(esPrimeraVez(pasos(true, true, false), [revisado])).toBe(false)
    // Sin la columna (sin la migración de I4): no es «por revisar».
    expect(esPrimeraVez(pasos(true, true, true), [{}])).toBe(false)
  })
})

describe('recordatorio (punto 17: un valor que no es de las cuatro opciones no se pierde)', () => {
  it('las cuatro de la maqueta', () => {
    expect(opcionesRecordatorio(24).map(o => o.horas)).toEqual([2, 12, 24, 48])
    expect(opcionesRecordatorio(24).find(o => o.horas === 24)?.texto).toBe('1 día (24 horas)')
  })

  it('6 horas sale como opción más, en su sitio', () => {
    const o = opcionesRecordatorio(6)
    expect(o.map(x => x.horas)).toEqual([2, 6, 12, 24, 48])
    expect(o.find(x => x.horas === 6)?.texto).toBe('6 horas')
    expect(opcionesRecordatorio(1).find(x => x.horas === 1)?.texto).toBe('1 hora')
  })

  it('el resumen del cierre lo dice corto', () => {
    expect(recordatorioCorto(24)).toBe('1 día')
    expect(recordatorioCorto(48)).toBe('2 días')
    expect(recordatorioCorto(6)).toBe('6 horas')
  })
})

describe('paso 1: qué sale elegido y qué manda «Continuar»', () => {
  it('hereda → «Igual que la clínica»; propio distinto → «Otro horario»; propio igual al de la clínica (tras restablecer) → «Igual que la clínica»', () => {
    expect(modoInicial({ horario: CLINICA, horario_propio: false }, CLINICA)).toBe('clinica')
    expect(modoInicial({ horario: PROPIO, horario_propio: true }, CLINICA)).toBe('propio')
    expect(modoInicial({ horario: CLINICA, horario_propio: true }, CLINICA)).toBe('clinica')
  })

  it('nada que mandar si ya estaba así y revisado', () => {
    expect(cambiosPaso1({ horario: CLINICA, horario_propio: false, horario_revisado_en: '2026-11-01' }, 'clinica', CLINICA, CLINICA)).toBeNull()
    expect(cambiosPaso1({ horario: PROPIO, horario_propio: true, horario_revisado_en: '2026-11-01' }, 'propio', PROPIO, CLINICA)).toBeNull()
  })

  it('«por revisar» y sin cambios: sólo confirma', () => {
    expect(cambiosPaso1({ horario: CLINICA, horario_propio: false, horario_revisado_en: null }, 'clinica', CLINICA, CLINICA)).toEqual({ horario_revisado: true })
  })

  it('«Otro horario» manda el horario propio', () => {
    expect(cambiosPaso1({ horario: CLINICA, horario_propio: false, horario_revisado_en: null }, 'propio', PROPIO, CLINICA))
      .toEqual({ horario_propio: true, horario: PROPIO })
  })

  it('«Igual que la clínica» desde un horario propio, o desde la columna cerrada de fábrica, copia el de la clínica y deja de heredar', () => {
    expect(cambiosPaso1({ horario: CLINICA, horario_propio: true, horario_revisado_en: null }, 'clinica', CLINICA, CLINICA))
      .toEqual({ horario_propio: false, horario: CLINICA })
    expect(cambiosPaso1({ horario: CERRADO, horario_propio: false, horario_revisado_en: '2026-11-01' }, 'clinica', CLINICA, CLINICA))
      .toEqual({ horario_propio: false, horario: CLINICA })
  })

  it('las horas de un día cerrado no cuentan para «igual»', () => {
    expect(mismoHorario({ ...CLINICA, domingo: dia(false, '01:00', '02:00') }, CLINICA)).toBe(true)
    expect(mismoHorario({ ...CLINICA, lunes: dia(true, '09:00', '18:00') }, CLINICA)).toBe(false)
  })
})

describe('el horario como lo escriben las maquetas', () => {
  it('agrupa por hora aunque los días no vayan seguidos', () => {
    expect(lineasHorario(PROPIO)).toEqual(['Lun, Mié, Vie · 16:00 – 20:00', 'Sáb · 9:00 – 13:00'])
    expect(lineasHorario(CLINICA)).toEqual(['Lun a vie · 8:00 – 18:00', 'Sáb · 8:00 – 13:00'])
  })

  it('en una frase, sin el punto entre días y horas', () => {
    expect(textoHorario(CLINICA)).toBe('Lun a vie 8:00 – 18:00 · Sáb 8:00 – 13:00')
    expect(textoHorario(CERRADO)).toBe('')
  })

  it('dos seguidos se escriben con coma; tres o más, como tramo', () => {
    expect(textoHorario({ ...CERRADO, lunes: dia(true), martes: dia(true) })).toBe('Lun, Mar 8:00 – 18:00')
    expect(horaCorta('08:30')).toBe('8:30')
  })

  it('cuántas consultas caben en el primer día abierto', () => {
    expect(consultasQueCaben([CLINICA], 30)).toEqual({ desde: '8:00', hasta: '18:00', cuantas: 20 })
    expect(consultasQueCaben([CERRADO, PROPIO], 45)).toEqual({ desde: '16:00', hasta: '20:00', cuantas: 5 })
    expect(consultasQueCaben([CERRADO], 30)).toBeNull()
    expect(consultasQueCaben([CLINICA], 0)).toBeNull()
  })
})

describe('el control de días y la duración', () => {
  it('se puede guardar con un día abierto y la salida después de la entrada', () => {
    expect(horarioGuardable(CLINICA)).toBe(true)
    expect(horarioGuardable(CERRADO)).toBe(false)
    expect(horarioGuardable({ ...CERRADO, lunes: dia(true, '18:00', '08:00') })).toBe(false)
  })

  it('prender un día copia las horas del prendido anterior (la maqueta)', () => {
    expect(prenderDia(PROPIO, 'martes').martes).toEqual(dia(true, '16:00', '20:00'))
    expect(prenderDia(CERRADO, 'lunes').lunes.activo).toBe(true)
  })

  it('una duración fuera de la rejilla sale en «Otra», escrita', () => {
    expect(eleccionInicial(null)).toEqual({ minutos: 30, otra: false, texto: '25' })
    expect(eleccionInicial(45)).toMatchObject({ minutos: 45, otra: false })
    expect(eleccionInicial(25)).toMatchObject({ otra: true, texto: '25' })
    expect(minutosDe({ minutos: 30, otra: true, texto: '40' })).toBe(40)
    expect(minutosDe({ minutos: 30, otra: false, texto: '40' })).toBe(30)
  })
})
