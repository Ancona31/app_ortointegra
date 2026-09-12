import { describe, it, expect } from 'vitest'
import {
  colisionDeNombre, esErrorDeNombreDuplicado, esErrorDeTope, normalizarNombre,
  recortarNombre, type PlantillaDocumento,
} from '@/lib/documentos/plantillas'

/**
 * La comparación de nombres tiene que ser la MISMA que la del índice único de
 * `plantillas_documento`:
 *   lower(btrim(nombre, ' ' || chr(9) || chr(10) || chr(13) || chr(160)))
 * Si diverge, el cliente no avisa y el médico recibe el 23505 crudo de la base.
 */

function plantilla(id: string, nombre: string): PlantillaDocumento {
  return { id, tipo: 'solicitud_lab', nombre, contenido: {}, updated_at: '2026-08-10T12:00:00Z' }
}

describe('recortarNombre', () => {
  it('recorta espacio, tabulador, retorno y salto de línea', () => {
    expect(recortarNombre(' \t\r\nPrequirúrgico\n\r\t ')).toBe('Prequirúrgico')
  })

  it('recorta el espacio duro, que String.trim() sí quita pero btrim(nombre) no', () => {
    expect(recortarNombre('\u00A0 Prequirúrgico \u00A0')).toBe('Prequirúrgico')
  })

  it('no toca los espacios interiores', () => {
    expect(recortarNombre('  Control post op  ')).toBe('Control post op')
  })
})

describe('normalizarNombre', () => {
  it('iguala mayúsculas y minúsculas', () => {
    expect(normalizarNombre('Prequirúrgico')).toBe(normalizarNombre('PREQUIRÚRGICO'))
  })

  it('iguala nombres que solo difieren en los bordes', () => {
    expect(normalizarNombre(' Rutina ')).toBe(normalizarNombre('rutina'))
  })
})

describe('colisionDeNombre', () => {
  const lista = [plantilla('a', 'Prequirúrgico'), plantilla('b', 'Control anual')]

  it('detecta la colisión aunque cambie la capitalización', () => {
    expect(colisionDeNombre(lista, 'prequirúrgico')?.id).toBe('a')
  })

  it('detecta la colisión aunque el nombre llegue con espacio duro pegado', () => {
    expect(colisionDeNombre(lista, '\u00A0 PREQUIRÚRGICO \u00A0')?.id).toBe('a')
  })

  it('no colisiona con nombres distintos', () => {
    expect(colisionDeNombre(lista, 'Postoperatorio')).toBeNull()
  })

  it('no colisiona consigo misma al renombrar', () => {
    expect(colisionDeNombre(lista, 'PREQUIRÚRGICO', 'a')).toBeNull()
  })

  it('el nombre vacío no colisiona con nada', () => {
    expect(colisionDeNombre(lista, '    ')).toBeNull()
  })
})

describe('clasificación de errores de la base', () => {
  it('reconoce el tope del trigger (check_violation)', () => {
    expect(esErrorDeTope({ code: '23514' })).toBe(true)
    expect(esErrorDeTope({ code: '23505' })).toBe(false)
  })

  it('reconoce el índice único', () => {
    expect(esErrorDeNombreDuplicado({ code: '23505' })).toBe(true)
  })

  it('aguanta lo que no es un error de PostgREST', () => {
    expect(esErrorDeTope(null)).toBe(false)
    expect(esErrorDeTope(new Error('offline'))).toBe(false)
    expect(esErrorDeNombreDuplicado(undefined)).toBe(false)
  })
})
