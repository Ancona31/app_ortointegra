/**
 * El espacio canónico de la firma — GUIA_FORMULARIOS_05 §5.5.
 *
 * POR QUÉ EXISTE. El grosor impreso de la firma dependía del aparato: 1,264 mm
 * en un iPad y 0,262 mm en un Samsung sobre PDF reales, y ni siquiera constante
 * entre dos personas firmando en el mismo. La causa era que la caja de rúbrica
 * coloca con `contain` y el recorte a la tinta deja esa colocación limitada por
 * un eje o por el otro según la forma del trazo. Redibujar en un espacio
 * canónico de tamaño fijo lo elimina.
 *
 * QUÉ VIGILA. El invariante del que depende todo el arreglo: la imagen
 * exportada sale **o exactamente `CANONICO_ANCHO` de ancho o exactamente
 * `CANONICO_ALTO` de alto**, y como el canónico tiene la proporción exacta de la
 * caja impresa, esta la coloca siempre a 300 dpi y el trazo de 6 px imprime
 * siempre 0,508 mm. Un canvas no se puede probar aquí; esta geometría sí, y es
 * la que decide el resultado.
 *
 * ⚠ **LA CAJA DE ABAJO ES LA DE v2 Y ANTES ERA LA DE v1.** Este archivo medía
 * contra `FirmaBox` —245,76 × 48 pt—, que es el renderizador viejo. Al encender
 * v2 la firma la compone `GEOMETRIA.rubrica` de `v2/BloqueFirmas.tsx`. Si las
 * dos cifras de aquí y las de allí se separan, el invariante se rompe **en
 * silencio**: el PDF sigue saliendo, con otro grosor. Es lo que estas pruebas
 * existen para impedir.
 */

import { describe, expect, it } from 'vitest'
import {
  CANONICO_ALTO,
  CANONICO_ANCHO,
  GROSOR_CANONICO,
  geometriaCanonica,
} from '@/lib/documentos/firmaTrazo'

/**
 * LA CAJA DE RÚBRICA IMPRESA, en puntos — `GEOMETRIA.rubrica` de `v2/BloqueFirmas.tsx`
 * más `FIRMA.espacio`. De aquí salen los 300 dpi.
 *
 * Se copian y no se importan a propósito: importarlas haría que un cambio allá
 * arrastrara a la prueba y las dos siguieran «de acuerdo» mientras el papel cambia.
 * Copiadas, un cambio de caja rompe estas pruebas, que es el aviso que se busca.
 */
const CAJA_ANCHO_PT = 142
const CAJA_ALTO_PT = 77

/** Los dpi con que la caja de rúbrica acaba colocando una imagen de este tamaño. */
function dpiImpresos(ancho: number, alto: number): number {
  // `objectFit: contain` — manda el eje que primero se queda sin sitio.
  const escala = Math.min(CAJA_ANCHO_PT / ancho, CAJA_ALTO_PT / alto)
  return 72 / escala
}

/** El grosor que acaba en el papel, en milímetros. */
function grosorImpresoMm(ancho: number, alto: number): number {
  return (GROSOR_CANONICO / dpiImpresos(ancho, alto)) * 25.4
}

describe('geometriaCanonica · el invariante', () => {
  /**
   * Las cuatro proporciones medidas sobre los PDF reales que destaparon el
   * defecto, más dos extremos. Con el defecto vivo estas seis imprimían con
   * grosores distintos; el arreglo consiste en que ya no.
   */
  const CASOS = [
    { nombre: 'iPad · firma A     (312×180)', ancho: 306, alto: 174 },
    { nombre: 'iPad · firma B     (570×178)', ancho: 564, alto: 172 },
    { nombre: 'Samsung · firma A  (792×411)', ancho: 786, alto: 405 },
    { nombre: 'Samsung · firma B  (493×623)', ancho: 487, alto: 617 },
    { nombre: 'muy plana          (9:1)', ancho: 900, alto: 100 },
    { nombre: 'muy alta           (1:4)', ancho: 100, alto: 400 },
  ]

  it.each(CASOS)('$nombre llena un eje exacto del canónico', ({ ancho, alto }) => {
    const g = geometriaCanonica(ancho, alto)
    const llenaAncho = g.ancho === CANONICO_ANCHO
    const llenaAlto = g.alto === CANONICO_ALTO
    expect(llenaAncho || llenaAlto).toBe(true)
    // Y nunca se sale del canónico por el otro eje.
    expect(g.ancho).toBeLessThanOrEqual(CANONICO_ANCHO)
    expect(g.alto).toBeLessThanOrEqual(CANONICO_ALTO)
  })

  it.each(CASOS)('$nombre imprime a 300 dpi y 0,508 mm de grosor', ({ ancho, alto }) => {
    const g = geometriaCanonica(ancho, alto)
    expect(dpiImpresos(g.ancho, g.alto)).toBeCloseTo(300, 0)
    expect(grosorImpresoMm(g.ancho, g.alto)).toBeCloseTo(0.508, 3)
  })

  it('el grosor impreso ya no depende del aparato: las seis coinciden', () => {
    const grosores = CASOS.map(c => {
      const g = geometriaCanonica(c.ancho, c.alto)
      return grosorImpresoMm(g.ancho, g.alto)
    })
    const min = Math.min(...grosores)
    const max = Math.max(...grosores)
    // Antes del arreglo la dispersión medida era de 4,8×.
    expect(max / min).toBeLessThan(1.02)
  })
})

describe('el canónico y la caja impresa son el mismo rectángulo', () => {
  /**
   * ESTA ES LA PRUEBA QUE HABRÍA CAZADO EL DEFECTO ANTES DE ENCENDER v2.
   *
   * El invariante no es «1024 × 200» ni «592 × 321»: es que la proporción del espacio
   * canónico y la de la caja impresa coincidan. Mientras coincidan, `contain` no deja
   * holgura y los dpi salen fijos lo limite el eje que lo limite. En cuanto se separan
   * —que es lo que pasó al pasar de la celda de v1 a la de v2— el grosor vuelve a
   * depender de la forma de cada firma, y nada avisa.
   */
  it('la proporción canónica es la de la caja, salvo el redondeo a píxel entero', () => {
    const proporcionCanonica = CANONICO_ANCHO / CANONICO_ALTO
    const proporcionCaja = CAJA_ANCHO_PT / CAJA_ALTO_PT
    expect(proporcionCanonica).toBeCloseTo(proporcionCaja, 3)
  })

  it('los dos ejes del canónico dan los mismos dpi contra la caja', () => {
    const dpiPorAncho = CANONICO_ANCHO / (CAJA_ANCHO_PT / 72)
    const dpiPorAlto = CANONICO_ALTO / (CAJA_ALTO_PT / 72)
    expect(dpiPorAncho).toBeCloseTo(dpiPorAlto, 0)
    expect(dpiPorAncho).toBeCloseTo(300, 0)
  })
})

describe('geometriaCanonica · la proporción y los extremos', () => {
  it('conserva la proporción de la tinta salvo el redondeo a píxeles enteros', () => {
    // Un canvas solo admite dimensiones enteras, así que la proporción se
    // conserva con la desviación que introduce ese redondeo —del orden del
    // 0,1 %, invisible— y no exactamente. Exigir igualdad exacta sería exigir
    // un canvas de dimensiones fraccionarias.
    const g = geometriaCanonica(786, 405)
    const util = (g.ancho - 2 * g.borde) / (g.alto - 2 * g.borde)
    expect(Math.abs(util / (786 / 405) - 1)).toBeLessThan(0.005)
  })

  it('el borde deja sitio al remate redondo del trazo', () => {
    // Media anchura de trazo más el margen: por debajo, el remate saldría cortado.
    expect(geometriaCanonica(100, 100).borde).toBeGreaterThanOrEqual(GROSOR_CANONICO / 2)
  })

  it('una firma plana la limita el ancho, y una alta el alto', () => {
    expect(geometriaCanonica(900, 100).ancho).toBe(CANONICO_ANCHO)
    expect(geometriaCanonica(100, 400).alto).toBe(CANONICO_ALTO)
  })

  it('un punto suelto no se estira: sin extensión no hay nada que escalar', () => {
    const g = geometriaCanonica(0, 0)
    expect(g.escala).toBe(1)
    expect(g.ancho).toBe(2 * g.borde)
    expect(g.alto).toBe(2 * g.borde)
  })

  it('una raya perfectamente vertical escala por el alto sin dividir por cero', () => {
    const g = geometriaCanonica(0, 150)
    expect(g.alto).toBe(CANONICO_ALTO)
    expect(Number.isFinite(g.escala)).toBe(true)
  })
})
