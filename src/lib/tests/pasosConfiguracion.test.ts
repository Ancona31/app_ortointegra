/**
 * pasosConfiguracion.test.ts — «Para empezar» (tanda T2, punto 7): el estado
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
const estados = (l: ListaEnlaces) => pasosDe(l, 'yo', true)?.map(p => p.hecho)

describe('pasosDe', () => {
  it('sin datos de preparación no decide nada (la lista no se enseña)', () => {
    expect(pasosDe(lista(null), 'yo', true)).toBeNull()
    expect(pasosDe(lista({ otro: [] }), 'yo', true)).toBeNull()
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

  it('sin consultorio manda al perfil; quien no crea tipos lo pide a quien administra', () => {
    const p = pasosDe(lista({ yo: ['sin_consultorio', 'sin_tipos'] }), 'yo', false)
    expect(p?.[0].destino).toBe('/perfil')
    expect(p?.[1].ayuda).toMatch(/quien administra/)
  })
})
