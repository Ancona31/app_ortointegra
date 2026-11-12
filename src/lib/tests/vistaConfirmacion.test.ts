/**
 * E3 · lo que pinta la página pública de confirmación: `?r=` sólo de la lista
 * fija, el «¿Seguro?» sólo con `?paso=cancelar`, la hora en la zona del
 * consultorio con su etiqueta si no es la de la clínica, y nada clínico.
 */
import { describe, it, expect } from 'vitest'
import {
  RESULTADOS_PAGINA, citaPintada, comunicate, esPasoCancelar, etiquetaDeZona, leerResultado, mensajeDeResultado, textoDeEstado,
} from '@/lib/confirmacion/vistaConfirmacion'
import type { ContextoConfirmacion } from '@/lib/confirmacion/enlaceConfirmacion'

const CTX: ContextoConfirmacion = {
  clinica_id: '00000000-0000-4000-8000-000000000001', estado: 'agendada',
  inicio: '2031-05-06T16:00:00.000Z', fin: '2031-05-06T16:30:00.000Z', zona: 'America/Merida',
  medico: { titulo: 'Dra.', nombres: 'Ana', apellido_paterno: 'López', apellido_materno: null },
  consultorio: { nombre: 'Centro', direccion: 'Calle 1', telefono: '9991234567' },
  puede_confirmar: true, puede_cancelar: true, corte_cancelar: '2031-05-06T15:00:00.000Z', respuesta: null,
  codigo_hash: 'a'.repeat(64),
}

describe('leerResultado / esPasoCancelar', () => {
  it('sólo los de la lista; cualquier otro valor, repetido o ausente, null', () => {
    for (const r of RESULTADOS_PAGINA) expect(leerResultado(r)).toBe(r)
    for (const v of ['invalido', 'CONFIRMADA', '<script>', '', undefined, ['confirmada', 'cancelada']]) expect(leerResultado(v)).toBeNull()
  })
  it('el «¿Seguro?» sólo con paso=cancelar exacto', () => {
    expect(esPasoCancelar('cancelar')).toBe(true)
    for (const v of ['Cancelar', 'confirmar', undefined, ['cancelar']]) expect(esPasoCancelar(v)).toBe(false)
  })
})

describe('textos', () => {
  it('cada resultado y cada estado tiene su frase; fuera de plazo da el teléfono', () => {
    for (const r of RESULTADOS_PAGINA) expect(mensajeDeResultado(r, null).length).toBeGreaterThan(5)
    expect(mensajeDeResultado('fuera_de_plazo', '9991234567')).toBe('Ya no es posible cancelar desde el enlace; comunícate al 9991234567.')
    expect(comunicate(null)).toBe('comunícate con el consultorio')
    for (const estado of ['agendada', 'confirmada', 'cancelada', 'cerrada', 'pasada'] as const) {
      expect(textoDeEstado({ ...CTX, estado }).length).toBeGreaterThan(5)
    }
  })
})

describe('citaPintada', () => {
  it('fecha y hora en la zona del consultorio, médico completo, sin ids ni clínica', () => {
    const c = citaPintada(CTX)
    expect(c.cuando).toBe('martes, 6 de mayo de 2031, 10:00 h')
    expect(c.medico).toBe('Dra. Ana López')
    expect(JSON.stringify(c)).not.toContain(CTX.clinica_id)
    expect(JSON.stringify(c)).not.toContain(CTX.codigo_hash)
  })
  it('la etiqueta de zona sólo fuera de la de la clínica', () => {
    expect(etiquetaDeZona('America/Mexico_City')).toBe('')
    expect(etiquetaDeZona(null)).toBe('')
    expect(etiquetaDeZona('America/Tijuana')).toMatch(/^\(.+\)$/)
    expect(etiquetaDeZona('No/Existe')).toBe('')
  })
})
