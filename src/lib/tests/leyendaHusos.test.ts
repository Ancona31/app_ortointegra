/**
 * leyendaHusos.test.ts — tanda K, punto 15 de Angel: la leyenda «Mostrando el
 * horario de tu ubicación actual (UTC−6, Mérida)» sale sólo si la clínica tiene
 * consultorios en más de un huso o si el dispositivo está en un huso distinto
 * al de los consultorios del médico que se ve. «Huso» = desfase con UTC en el
 * instante de referencia, no el nombre de la zona.
 */
import { describe, it, expect } from 'vitest'
import { leyendaHusos, lugarDeZona, rotuloUtc, type EntradaLeyendaHusos } from '@/lib/agenda/leyendaHusos'
import type { ConsultorioRejilla } from '@/lib/agenda/horarioRejilla'

const NOV = Date.parse('2026-11-23T18:00:00Z') // Tijuana UTC−8, Hermosillo UTC−7, Mérida UTC−6
const JUL = Date.parse('2026-07-20T18:00:00Z') // Tijuana UTC−7 (horario de verano), igual que Hermosillo

const co = (id: string, medico: string, timezone: string | null, activo = true): ConsultorioRejilla =>
  ({ id, medico_id: medico, timezone, horario: null, horario_propio: false, activo })
const CENTRO = co('centro', 'admin', 'America/Merida')
const NORTE = co('norte', 'admin', 'America/Hermosillo')
const REHAB = co('rehab', 'invitada', 'America/Merida')

const leyenda = (e: Partial<EntradaLeyendaHusos>): string | null => leyendaHusos({
  consultorios: [CENTRO, REHAB], medicoMostrado: 'admin', zonaDispositivo: 'America/Merida', referencia: NOV, ...e,
})
const MERIDA = 'Mostrando el horario de tu ubicación actual (UTC−6, Mérida)'

describe('leyendaHusos — cuándo sale', () => {
  it('todo en el huso del dispositivo: no sale', () => {
    expect(leyenda({})).toBeNull()
  })
  it('el médico con un consultorio en Mérida y otro en Sonora: sale, con el desfase y el lugar del dispositivo', () => {
    expect(leyenda({ consultorios: [CENTRO, NORTE, REHAB] })).toBe(MERIDA)
  })
  it('la clínica en dos husos aunque el médico que se ve tenga todo en el del dispositivo: sale', () => {
    expect(leyenda({ consultorios: [CENTRO, NORTE, REHAB], medicoMostrado: 'invitada' })).toBe(MERIDA)
  })
  it('«Todos los médicos» con todo en un huso que no es el del dispositivo: sale', () => {
    expect(leyenda({ medicoMostrado: null, zonaDispositivo: 'America/Hermosillo' }))
      .toBe('Mostrando el horario de tu ubicación actual (UTC−7, Hermosillo)')
  })
  it('el dispositivo en otra zona con el MISMO desfase (Ciudad de México y Mérida, UTC−6): no sale', () => {
    expect(leyenda({ zonaDispositivo: 'America/Mexico_City' })).toBeNull()
  })
  it('el desfase se mide en la referencia: Tijuana y Hermosillo son el mismo huso en julio, no en noviembre', () => {
    const e = { consultorios: [co('t', 'admin', 'America/Tijuana')], zonaDispositivo: 'America/Hermosillo' }
    expect(leyenda({ ...e, referencia: JUL })).toBeNull()
    expect(leyenda({ ...e, referencia: NOV })).toBe('Mostrando el horario de tu ubicación actual (UTC−7, Hermosillo)')
  })
  it('un consultorio archivado no cuenta; sin consultorios, no sale', () => {
    expect(leyenda({ consultorios: [CENTRO, co('viejo', 'admin', 'America/Hermosillo', false)] })).toBeNull()
    expect(leyenda({ consultorios: [] })).toBeNull()
  })
  it('un consultorio sin zona cuenta como el dispositivo', () => {
    expect(leyenda({ consultorios: [CENTRO, co('sin', 'admin', null)] })).toBeNull()
  })
})

describe('rotuloUtc y lugarDeZona', () => {
  it('signo menos tipográfico, minutos sólo si los hay', () => {
    expect(rotuloUtc(-360)).toBe('UTC−6')
    expect(rotuloUtc(330)).toBe('UTC+5:30')
    expect(rotuloUtc(0)).toBe('UTC+0')
  })
  it('las zonas de México dan su ciudad con acentos; otra, el nombre de Intl en es-MX', () => {
    expect(lugarDeZona('America/Merida', NOV)).toBe('Mérida')
    expect(lugarDeZona('America/Cancun', NOV)).toBe('Cancún')
    const bogota = lugarDeZona('America/Bogota', NOV)
    expect(bogota).not.toBe('America/Bogota')
    expect(bogota).toMatch(/Colombia/)
  })
})
