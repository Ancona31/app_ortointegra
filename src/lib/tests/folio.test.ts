/**
 * El folio — la prueba del acuerdo entre el cliente y la base.
 *
 * Fija dos cosas que se rompen en silencio:
 *
 * 1. Que `FOLIO_CANONICO` sea el MISMO patrón que el CHECK
 *    `documentos_folio_formato_check`. Si se separan, el buscador deja de
 *    encontrar folios que la base sí emitió, y una búsqueda vacía se parece
 *    demasiado a un folio que no existe.
 * 2. Que las TRES formas viejas que hay hoy en producción —`R-` + 8 hex, `R-` +
 *    12 hex y `NOH-AAAAMMDD-SSSSS`— NO se cuelen como si fueran folios nuevos.
 *    Viven dentro de `contenido`, no en la columna, y aceptarlas haría creer que
 *    la búsqueda las cubre.
 */

import { describe, it, expect } from 'vitest'
import { normalizarFolio, FOLIO_CANONICO, PREFIJO_POR_CLASE } from '@/lib/documentos/folio'

describe('normalizarFolio', () => {
  it('deja intacto lo que ya está en forma canónica', () => {
    for (const folio of [
      'RX-2026-0042', 'NOH-2026-0013', 'COT-2026-0005', 'CI-2026-0007',
      'LAB-2026-0001', 'IMG-2026-0002', 'SUP-2026-0003', 'INT-2026-0004',
      'DEN-2026-0006',
    ]) {
      expect(normalizarFolio(folio)).toBe(folio)
    }
  })

  it('lee lo que alguien dicta por teléfono', () => {
    // Sin ceros de relleno, en minúsculas, con espacios en vez de guiones, con
    // basura alrededor. Es la propiedad por la que el folio es correlativo y
    // legible en vez de doce caracteres de un UUID.
    expect(normalizarFolio('rx-2026-42')).toBe('RX-2026-0042')
    expect(normalizarFolio('  RX 2026 42  ')).toBe('RX-2026-0042')
    expect(normalizarFolio('noh 2026 13')).toBe('NOH-2026-0013')
    expect(normalizarFolio('ci.2026.7')).toBe('CI-2026-0007')
    expect(normalizarFolio('cot/2026/5')).toBe('COT-2026-0005')
    expect(normalizarFolio('RX20260042')).toBe('RX-2026-0042')
    expect(normalizarFolio('den 2026 6')).toBe('DEN-2026-0006')
    expect(normalizarFolio('  lab—2026—1 ')).toBe('LAB-2026-0001')
  })

  it('los ceros de relleno son indiferentes, y la serie 10 000 no se trunca', () => {
    expect(normalizarFolio('RX-2026-0042')).toBe('RX-2026-0042')
    expect(normalizarFolio('RX-2026-00042')).toBe('RX-2026-0042')
    expect(normalizarFolio('RX-2026-10000')).toBe('RX-2026-10000')
    expect(normalizarFolio('RX-2026-123456')).toBe('RX-2026-123456')
  })

  it('rechaza las tres formas viejas que hay hoy en producción', () => {
    // 311 filas · receta
    expect(normalizarFolio('R-a3f9b2c1d4e5')).toBeNull()
    // 46 filas · receta, generación anterior
    expect(normalizarFolio('R-a3f9b2c1')).toBeNull()
    // 64 filas · nota_honorarios y cotización — prefijo válido, forma que no
    expect(normalizarFolio('NOH-20260416-53021')).toBeNull()
    expect(normalizarFolio('COT-20260416-53021')).toBeNull()
  })

  it('no confunde un nombre de paciente con un folio', () => {
    // Es lo que permite que el buscador elija el modo por la forma de lo
    // escrito, sin conmutador. Si algo de esto devolviera un folio, buscar un
    // paciente dejaría de funcionar.
    for (const nombre of ['María Fernanda', 'Ruiz', 'Cintia', 'Rx', 'ci', '', '   ', '2026', '42']) {
      expect(normalizarFolio(nombre)).toBeNull()
    }
  })

  it('rechaza folios incompletos o con el año mal formado', () => {
    for (const roto of ['RX-2026', 'RX--0042', 'RX-26-0042', 'RX-2026-', 'XX-2026-0042']) {
      expect(normalizarFolio(roto)).toBeNull()
    }
  })

  it('todo lo que devuelve cabe en el CHECK de la columna', () => {
    const entradas = ['rx-2026-1', 'NOH 2026 9999', 'ci.2026.10000', 'COT-2026-0005']
    for (const entrada of entradas) {
      const folio = normalizarFolio(entrada)
      expect(folio).not.toBeNull()
      expect(folio).toMatch(FOLIO_CANONICO)
    }
  })

  it('los nueve prefijos son los nueve del generador, y solo esos', () => {
    // Si aquí aparece un décimo, el `CASE` de `public.generar_folio()` y el
    // CHECK de la columna tienen que crecer con él. Los tres a la vez o ninguno.
    // El orden es el del `CASE` de `20260811_folio_03_denegacion.sql`.
    expect(Object.values(PREFIJO_POR_CLASE)).toEqual(
      ['RX', 'NOH', 'COT', 'CI', 'LAB', 'IMG', 'SUP', 'INT', 'DEN'],
    )
    for (const prefijo of Object.values(PREFIJO_POR_CLASE)) {
      expect(normalizarFolio(`${prefijo}-2026-1`)).toBe(`${prefijo}-2026-0001`)
    }
  })
})
