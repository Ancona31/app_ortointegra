/**
 * tiposPorConsultorio.test.ts — G2, punto 7: la duración de la consulta (tipo
 * principal) vale en todos los consultorios del médico; una distinta en UNO lo
 * sustituye sólo allí; los tipos «de más» valen en todos. Es la regla que usan
 * la reserva por enlace (contexto, turnos y POST), el modal y el ajuste al turno.
 */
import { describe, it, expect } from 'vitest'
import { duracionDeConsulta, tiposDelConsultorio } from '@/lib/agenda/tiposPorConsultorio'

const GENERAL = { id: 'g', duracion_min: 45, principal: true, consultorio_id: null }
const NORTE = { id: 'n', duracion_min: 60, principal: true, consultorio_id: 'norte' }
const EXTRA = { id: 'x', duracion_min: 20, principal: false, consultorio_id: null }
const ids = (l: readonly { id: string }[]) => l.map(t => t.id)

describe('tiposDelConsultorio', () => {
  it('en el consultorio con duración propia, la propia sustituye a la general; los de más se quedan', () => {
    expect(ids(tiposDelConsultorio([GENERAL, NORTE, EXTRA], 'norte'))).toEqual(['n', 'x'])
  })
  it('en otro consultorio, la general y los de más (la propia de Norte no existe allí)', () => {
    expect(ids(tiposDelConsultorio([GENERAL, NORTE, EXTRA], 'centro'))).toEqual(['g', 'x'])
  })
  it('sin consultorio, sólo los generales; una lista sin las columnas de G2 sale igual', () => {
    expect(ids(tiposDelConsultorio([GENERAL, NORTE, EXTRA], null))).toEqual(['g', 'x'])
    const viejos: { id: string; consultorio_id?: string | null }[] = [{ id: 'a' }, { id: 'b' }]
    expect(ids(tiposDelConsultorio(viejos, 'norte'))).toEqual(['a', 'b'])
  })
})

describe('duracionDeConsulta', () => {
  it('la principal del consultorio, si no la general; sin principal, la del único tipo; si no, null', () => {
    expect(duracionDeConsulta([GENERAL, NORTE, EXTRA], 'norte')).toBe(60)
    expect(duracionDeConsulta([GENERAL, NORTE, EXTRA], 'centro')).toBe(45)
    expect(duracionDeConsulta([EXTRA], 'centro')).toBe(20)
    expect(duracionDeConsulta([EXTRA, { ...EXTRA, id: 'y', duracion_min: 30 }], 'centro')).toBeNull()
    expect(duracionDeConsulta([], 'centro')).toBeNull()
  })
})
