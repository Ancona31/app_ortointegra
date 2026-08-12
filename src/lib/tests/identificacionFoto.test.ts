/**
 * La matriz de recorte con rotación — GUIA_FORMULARIOS_05 §6 (captura nativa).
 *
 * POR QUÉ EXISTE. La rotación de la foto de identificación se aplica AL RECORTE
 * FINAL con una matriz compuesta, no con un lienzo intermedio girado —que en un
 * teléfono de 24 Mpx excede el área de canvas que iOS admite—. Si esa matriz
 * está mal, el médico ajusta una cosa en el recortador y se imprime otra, y el
 * fallo es silencioso: la foto sale, solo que de otra región. Un canvas no se
 * puede probar aquí; la matriz sí, y la matriz ES el recorte.
 *
 * QUÉ VIGILA. Para cada giro de 90°: que las cuatro esquinas de la imagen
 * original aterrizan donde el giro horario las manda, y que el rectángulo del
 * recorte —expresado en el espacio girado, como lo entrega react-easy-crop—
 * cubre exactamente el lienzo de salida.
 */

import { describe, expect, it } from 'vitest'
import {
  PROPORCION,
  matrizDeRecorte,
  medidasRotadas,
  zoomMinimoEntera,
  type Recorte,
} from '@/lib/documentos/identificacionFoto'

/** Aplica la matriz a un punto, como hace `setTransform` + `drawImage`. */
function aplicar(
  m: { a: number; b: number; c: number; d: number; e: number; f: number },
  x: number,
  y: number,
): { x: number; y: number } {
  return { x: m.a * x + m.c * y + m.e, y: m.b * x + m.d * y + m.f }
}

/** Imagen de prueba apaisada: 200 × 100. Sus cuatro esquinas, nombradas. */
const NW = 200
const NH = 100
const ESQUINAS = {
  supIzq: { x: 0, y: 0 },
  supDer: { x: NW, y: 0 },
  infDer: { x: NW, y: NH },
  infIzq: { x: 0, y: NH },
} as const

/** Recorte que cubre el espacio girado entero, con salida a escala 1. */
function recorteEntero(rotacion: number): Recorte {
  const r = medidasRotadas(NW, NH, rotacion)
  return { x: 0, y: 0, ancho: r.ancho, alto: r.alto }
}

describe('medidasRotadas', () => {
  it('intercambia los lados a 90 y 270, y los conserva a 0 y 180', () => {
    expect(medidasRotadas(NW, NH, 0)).toEqual({ ancho: 200, alto: 100 })
    expect(medidasRotadas(NW, NH, 90)).toEqual({ ancho: 100, alto: 200 })
    expect(medidasRotadas(NW, NH, 180)).toEqual({ ancho: 200, alto: 100 })
    expect(medidasRotadas(NW, NH, 270)).toEqual({ ancho: 100, alto: 200 })
  })
})

describe('matrizDeRecorte · los cuatro giros, esquina a esquina', () => {
  it('0° es la identidad sobre el recorte entero', () => {
    const m = matrizDeRecorte(0, NW, NH, recorteEntero(0), 200, 100)
    expect(aplicar(m, ESQUINAS.supIzq.x, ESQUINAS.supIzq.y)).toEqual({ x: 0, y: 0 })
    expect(aplicar(m, ESQUINAS.infDer.x, ESQUINAS.infDer.y)).toEqual({ x: 200, y: 100 })
  })

  it('90° horario: la esquina superior izquierda pasa a superior derecha', () => {
    const m = matrizDeRecorte(90, NW, NH, recorteEntero(90), 100, 200)
    // Giro horario: supIzq→supDer, supDer→infDer, infDer→infIzq, infIzq→supIzq.
    expect(aplicar(m, ESQUINAS.supIzq.x, ESQUINAS.supIzq.y)).toEqual({ x: 100, y: 0 })
    expect(aplicar(m, ESQUINAS.supDer.x, ESQUINAS.supDer.y)).toEqual({ x: 100, y: 200 })
    expect(aplicar(m, ESQUINAS.infDer.x, ESQUINAS.infDer.y)).toEqual({ x: 0, y: 200 })
    expect(aplicar(m, ESQUINAS.infIzq.x, ESQUINAS.infIzq.y)).toEqual({ x: 0, y: 0 })
  })

  it('180°: cada esquina pasa a su opuesta', () => {
    const m = matrizDeRecorte(180, NW, NH, recorteEntero(180), 200, 100)
    expect(aplicar(m, ESQUINAS.supIzq.x, ESQUINAS.supIzq.y)).toEqual({ x: 200, y: 100 })
    expect(aplicar(m, ESQUINAS.infDer.x, ESQUINAS.infDer.y)).toEqual({ x: 0, y: 0 })
  })

  it('270° horario: la esquina superior izquierda pasa a inferior izquierda', () => {
    const m = matrizDeRecorte(270, NW, NH, recorteEntero(270), 100, 200)
    expect(aplicar(m, ESQUINAS.supIzq.x, ESQUINAS.supIzq.y)).toEqual({ x: 0, y: 200 })
    expect(aplicar(m, ESQUINAS.supDer.x, ESQUINAS.supDer.y)).toEqual({ x: 0, y: 0 })
    expect(aplicar(m, ESQUINAS.infDer.x, ESQUINAS.infDer.y)).toEqual({ x: 100, y: 0 })
    expect(aplicar(m, ESQUINAS.infIzq.x, ESQUINAS.infIzq.y)).toEqual({ x: 100, y: 200 })
  })
})

describe('matrizDeRecorte · el rectángulo del recorte llena la salida', () => {
  /**
   * El contrato con react-easy-crop: `croppedAreaPixels` viene en el espacio
   * GIRADO. La esquina del recorte tiene que aterrizar en (0,0) de la salida y
   * su esquina opuesta en (salidaAncho, salidaAlto), en los cuatro giros.
   *
   * Las esquinas del RECORTE en coordenadas de la imagen original se obtienen
   * deshaciendo el giro a mano en cada caso.
   */
  it('a 90°, un subrecorte descentrado aterriza exacto y a escala', () => {
    // Imagen 1000×600 girada 90° → espacio 600×1000. Recorte {x:100, y:250,
    // ancho:400, alto:500}, salida reducida a la mitad: 200×250.
    const m = matrizDeRecorte(90, 1000, 600, { x: 100, y: 250, ancho: 400, alto: 500 }, 200, 250)
    // En el espacio girado, la esquina (100,250) del recorte es, en la imagen
    // original, el punto (250, 600−100) = (250, 500): girar 90° horario manda
    // (x,y) → (alto−y, x), así que se invierte con (x,y) ← (yGirado, alto−xGirado).
    expect(aplicar(m, 250, 500)).toEqual({ x: 0, y: 0 })
    // Y la esquina opuesta del recorte, (500,750) girada ← (750, 600−500=100):
    expect(aplicar(m, 750, 100)).toEqual({ x: 200, y: 250 })
  })

  it('a 0°, un subrecorte reduce a escala sin desplazarse', () => {
    const m = matrizDeRecorte(0, 1000, 600, { x: 200, y: 100, ancho: 600, alto: 379 }, 300, 190)
    expect(aplicar(m, 200, 100)).toEqual({ x: 0, y: 0 })
    const opuesta = aplicar(m, 800, 479)
    expect(opuesta.x).toBeCloseTo(300, 10)
    expect(opuesta.y).toBeCloseTo(190, 10)
  })
})

describe('zoomMinimoEntera · hasta dónde se puede alejar', () => {
  it('una imagen con la proporción exacta del rectángulo no necesita alejarse: mínimo 1', () => {
    expect(zoomMinimoEntera(2280, 1440, 0)).toBeCloseTo(1, 10)
  })

  it('una foto 16:9 apaisada —el caso de la credencial cortada— baja a caber entera', () => {
    // Proporción 1,778 contra 1,583: el mínimo es 1,583/1,778.
    expect(zoomMinimoEntera(1920, 1080, 0)).toBeCloseTo(PROPORCION / (1920 / 1080), 10)
    expect(zoomMinimoEntera(1920, 1080, 0)).toBeLessThan(1)
  })

  it('una foto en vertical baja mucho más, y girarla 90° lo recalcula', () => {
    // 9:16 = 0,5625 → mínimo 0,5625/1,5833 ≈ 0,355.
    expect(zoomMinimoEntera(1080, 1920, 0)).toBeCloseTo((1080 / 1920) / PROPORCION, 10)
    // Girada 90° vuelve a ser 16:9: el mismo mínimo que la apaisada.
    expect(zoomMinimoEntera(1080, 1920, 90)).toBeCloseTo(zoomMinimoEntera(1920, 1080, 0), 10)
  })

  it('nunca pasa de 1: alejar jamás exige acercar', () => {
    expect(zoomMinimoEntera(5712, 4284, 0)).toBeLessThanOrEqual(1)
    expect(zoomMinimoEntera(100, 3000, 0)).toBeLessThanOrEqual(1)
    expect(zoomMinimoEntera(0, 100, 0)).toBe(1)
  })
})

describe('matrizDeRecorte · rotaciones fuera de contrato', () => {
  it('normaliza vueltas completas y negativos a su paso de 90', () => {
    const entero = recorteEntero(90)
    expect(matrizDeRecorte(450, NW, NH, entero, 100, 200))
      .toEqual(matrizDeRecorte(90, NW, NH, entero, 100, 200))
    expect(matrizDeRecorte(-90, NW, NH, entero, 100, 200))
      .toEqual(matrizDeRecorte(270, NW, NH, entero, 100, 200))
  })

  it('rechaza un ángulo que no sea múltiplo de 90: mejor un error que otra región', () => {
    expect(() => matrizDeRecorte(45, NW, NH, recorteEntero(0), 200, 100))
      .toThrow('ROTACION_INVALIDA')
  })
})
