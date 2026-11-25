/**
 * pasosConfiguracion.test.ts — «Primeros pasos» (T2, punto 7; G2, punto 8:
 * horario de cada consultorio → duración de la consulta → enlace): el estado
 * de cada paso sale de los datos (la `preparacion` del servidor y los enlaces
 * vigentes), no de una marca guardada; con los tres hechos no queda nada
 * pendiente y la lista desaparece.
 */
import { describe, it, expect } from 'vitest'
import { pasosDe } from '@/components/agenda/configuracion/PasosConfiguracion'
import type { ListaEnlaces } from '@/components/agenda/configuracion/listaEnlaces'
import type { EnlaceReserva } from '@/lib/reserva/gestionReserva'

const FIJO: EnlaceReserva = {
  id: 'e1', medico_id: 'yo', clase: 'fijo', etiqueta: null, vigencia_dias: null, caduca_en: null, usado_en: null,
  revocado_en: null, created_at: '2026-11-13T00:00:00Z',
}
const lista = (preparacion: ListaEnlaces['preparacion'], enlaces: EnlaceReserva[] = []): ListaEnlaces =>
  ({ enlaces, secreto: true, aviso: true, preparacion })
const estados = (l: ListaEnlaces) => pasosDe(l, 'yo')?.map(p => p.hecho)

describe('pasosDe', () => {
  it('sin datos de preparación no decide nada (la lista no se enseña)', () => {
    expect(pasosDe(lista(null), 'yo')).toBeNull()
    expect(pasosDe(lista({ otro: [] }), 'yo')).toBeNull()
  })

  it('cada paso sale de su motivo: disponibilidad, tipos y enlace', () => {
    expect(estados(lista({ yo: ['sin_disponibilidad', 'sin_tipos'] }))).toEqual([false, false, false])
    expect(estados(lista({ yo: ['sin_consultorio'] }))).toEqual([false, true, false])
    expect(estados(lista({ yo: ['sin_tipos'] }, [FIJO]))).toEqual([true, false, true])
  })

  it('con los tres hechos no queda ninguno pendiente', () => {
    expect(estados(lista({ yo: [] }, [FIJO]))).toEqual([true, true, true])
  })

  it('el enlace de otro médico no cuenta como el mío; «no abre» no deja pendiente el paso de horario', () => {
    expect(estados(lista({ yo: ['no_abre'] }, [{ ...FIJO, medico_id: 'otro' }]))).toEqual([true, true, false])
  })

  it('G2 · el orden es horario, duración y enlace (las claves que usa la tarjeta)', () => {
    expect(pasosDe(lista({ yo: [] }), 'yo')?.map(p => `${p.clave}:${p.titulo}`)).toEqual([
      'horario:Horario de cada consultorio', 'duracion:Duración de la consulta', 'enlace:Enlace de reserva'])
  })

  it('H2 (punto 10) · un consultorio activo «como nace» (sin horario propio y todo cerrado) deja pendiente el horario', () => {
    const cerrado = { activo: false, inicio: '09:00', fin: '14:00' }
    const todoCerrado = { lunes: cerrado, martes: cerrado, miercoles: cerrado, jueves: cerrado, viernes: cerrado, sabado: cerrado, domingo: cerrado }
    const abierto = { ...todoCerrado, lunes: { activo: true, inicio: '08:00', fin: '14:00' } }
    const virgen = { medico_id: 'yo', activo: true, horario_propio: false, horario: todoCerrado }
    const l = lista({ yo: [] }, [FIJO])
    expect(pasosDe(l, 'yo', [virgen])?.map(p => p.hecho)).toEqual([false, true, true])
    // Con horario propio, o creado con días abiertos, o archivado, o de otro médico: hecho, como antes.
    expect(pasosDe(l, 'yo', [{ ...virgen, horario_propio: true }])?.[0]?.hecho).toBe(true)
    expect(pasosDe(l, 'yo', [{ ...virgen, horario: abierto }])?.[0]?.hecho).toBe(true)
    expect(pasosDe(l, 'yo', [{ ...virgen, activo: false }])?.[0]?.hecho).toBe(true)
    expect(pasosDe(l, 'yo', [{ ...virgen, medico_id: 'otro' }])?.[0]?.hecho).toBe(true)
    expect(pasosDe(l, 'yo', null)?.[0]?.hecho).toBe(true)
  })
  it('tanda I (punto 3) · un horario que nadie confirmó (`horario_revisado_en` null) queda «por revisar», no hecho', () => {
    const cerrado = { activo: false, inicio: '09:00', fin: '14:00' }
    const abierto = { lunes: { activo: true, inicio: '08:00', fin: '14:00' }, martes: cerrado, miercoles: cerrado, jueves: cerrado,
      viernes: cerrado, sabado: cerrado, domingo: cerrado }
    const heredado = { medico_id: 'yo', activo: true, horario_propio: true, horario: abierto, horario_revisado_en: null }
    const l = lista({ yo: [] }, [FIJO])
    expect(pasosDe(l, 'yo', [heredado])?.[0]).toMatchObject({ hecho: false, porRevisar: true })
    // Confirmado, sin la columna (base sin la migración) o de otro médico: hecho, como antes.
    expect(pasosDe(l, 'yo', [{ ...heredado, horario_revisado_en: '2026-11-17T10:00:00Z' }])?.[0]).toEqual(
      { clave: 'horario', titulo: 'Horario de cada consultorio', hecho: true })
    const sinColumna = { medico_id: 'yo', activo: true, horario_propio: true, horario: abierto }
    expect(pasosDe(l, 'yo', [sinColumna])?.[0]?.hecho).toBe(true)
    expect(pasosDe(l, 'yo', [{ ...heredado, medico_id: 'otro' }])?.[0]?.hecho).toBe(true)
    // Falta otra cosa (sin disponibilidad): pendiente, no «por revisar».
    expect(pasosDe(lista({ yo: ['sin_disponibilidad'] }), 'yo', [heredado])?.[0]).toMatchObject({ hecho: false })
    expect(pasosDe(lista({ yo: ['sin_disponibilidad'] }), 'yo', [heredado])?.[0]).not.toHaveProperty('porRevisar')
  })
})
