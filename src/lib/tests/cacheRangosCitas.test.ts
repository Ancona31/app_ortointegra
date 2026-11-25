/**
 * cacheRangosCitas.test.ts — caché de rangos de citas (A1.5a). Fija lo que la
 * agenda da por hecho de `@/lib/agenda/cacheRangosCitas`:
 *
 *   · se sirve mientras sea vigente (2 min contados desde que SALIÓ la
 *     petición) y después hay que preguntar;
 *   · una respuesta incompleta no se guarda;
 *   · vaciar borra todo, y una traída que salió antes no escribe al volver;
 *   · la clave separa usuario, filtro y rango.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import type { EventInput } from '@fullcalendar/core'
import {
  VIGENCIA_CITAS_MS, claveCitas, generacionCitas, guardarCitas, leerCitas, vaciarCacheCitas,
} from '@/lib/agenda/cacheRangosCitas'

const DESDE = '2026-11-09T06:00:00.000Z'
const HASTA = '2026-11-16T06:00:00.000Z'
const CLAVE = claveCitas('u1', '', DESDE, HASTA)
const FILAS: EventInput[] = [{ id: 'c1', title: 'Consulta', start: '2026-11-10T15:00:00Z' }]

beforeEach(() => { vaciarCacheCitas() })

describe('claveCitas', () => {
  it('separa usuario, filtro y rango', () => {
    expect(claveCitas('u1', 'm1', 'a', 'b')).not.toBe(claveCitas('u2', 'm1', 'a', 'b'))
    expect(claveCitas('u1', '', 'a', 'b')).not.toBe(claveCitas('u1', 'm1', 'a', 'b'))
    expect(claveCitas('u1', '', 'a', 'b')).not.toBe(claveCitas('u1', '', 'a', 'c'))
  })

  it('lo de un usuario no se sirve a otro', () => {
    guardarCitas(CLAVE, FILAS, false, Date.now(), generacionCitas())
    expect(leerCitas(claveCitas('u2', '', DESDE, HASTA))).toBeNull()
  })
})

describe('vigencia', () => {
  it('sin nada guardado hay que preguntar', () => {
    expect(leerCitas(CLAVE)).toBeNull()
  })

  it('sirve hasta los 2 min desde que salió la petición, y no después', () => {
    const salio = 1_000_000
    guardarCitas(CLAVE, FILAS, false, salio, generacionCitas())
    expect(leerCitas(CLAVE, salio + VIGENCIA_CITAS_MS - 1)).toEqual(FILAS)
    expect(leerCitas(CLAVE, salio + VIGENCIA_CITAS_MS)).toBeNull()
  })

  it('una respuesta incompleta no se guarda', () => {
    guardarCitas(CLAVE, FILAS, true, Date.now(), generacionCitas())
    expect(leerCitas(CLAVE)).toBeNull()
  })

  it('al escribir se purga lo vencido', () => {
    const viejo = claveCitas('u1', '', 'a', 'b')
    guardarCitas(viejo, FILAS, false, 0, generacionCitas())
    guardarCitas(CLAVE, FILAS, false, VIGENCIA_CITAS_MS, generacionCitas())
    expect(leerCitas(viejo, 0)).toBeNull()
  })
})

describe('invalidación', () => {
  it('vaciar borra todas las entradas', () => {
    const otra = claveCitas('u1', 'm1', DESDE, HASTA)
    guardarCitas(CLAVE, FILAS, false, Date.now(), generacionCitas())
    guardarCitas(otra, FILAS, false, Date.now(), generacionCitas())
    vaciarCacheCitas()
    expect(leerCitas(CLAVE)).toBeNull()
    expect(leerCitas(otra)).toBeNull()
  })

  it('una traída que salió antes del vaciado no escribe al volver', () => {
    const gen = generacionCitas()
    vaciarCacheCitas()
    guardarCitas(CLAVE, FILAS, false, Date.now(), gen)
    expect(leerCitas(CLAVE)).toBeNull()
  })
})
