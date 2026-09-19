/**
 * II.9 · Denegación o revocación del consentimiento — **la prueba que mide el PDF real**.
 *
 * POR QUÉ EXISTE, Y POR QUÉ MIDE EN VEZ DE COMPARAR TOKENS
 *
 * El encabezado de un formato no es una constante: es la suma de sus bloques. Aquí se renderiza
 * el PDF, se leen las coordenadas de su flujo de contenido y se mide. El lector sale entero de
 * `consentimientoInformado.test.ts`, que a su vez lo hereda de `solicitudInternamiento.test.ts`.
 *
 * LO QUE ESTA PRUEBA VIGILA Y NINGUNA OTRA PUEDE
 *
 * **Que las dos variantes quepan en UNA hoja.** Es la única condición dura de este documento:
 * una revocación en dos hojas no es aceptable —decisión de Angel—, y la variante por
 * sustitución es la más ajustada del sistema, con 26.04 pt de holgura.
 *
 * **Que el recorte del subtítulo la siga garantizando con un procedimiento largo.** Es el riesgo
 * que la guía deja declarado y lo único que lo cubre. Si esta prueba se borra «porque casi nunca
 * pasa», el documento se parte en dos el día que alguien escriba un nombre de procedimiento
 * completo.
 *
 * **Que la retícula reparta tantas columnas como firmantes.** Tres en 142 pt y dos en 228, en
 * una sola fila: es el parámetro que este formato estrenó en 2.L, y en dos columnas los tres
 * firmantes desbordaban 62 pt.
 */

import { describe, it, expect } from 'vitest'
import zlib from 'node:zlib'
import path from 'node:path'
import React from 'react'
import { Document, Font, renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import DenegacionConsentimiento, {
  type DenegacionConsentimientoProps,
} from '@/lib/pdf/v2/formatos/DenegacionConsentimiento'
import { MARCO } from '@/lib/pdf/v2/MarcoParcial'
import {
  CIERRE,
  ESPACIO,
  FILETE,
  MARGEN,
  PAPEL,
  TIPOGRAFIA,
  resolverAcento,
  ACENTO_BASE_POR_DEFECTO,
} from '@/lib/pdf/v2/tokens'

const h = React.createElement

/** Las mismas familias que `registrarFuentesV2()`, por ruta de disco. */
function registrarFuentesDeDisco(): void {
  const ruta = (archivo: string): string =>
    path.resolve(process.cwd(), 'public/fonts', archivo)

  Font.registerHyphenationCallback((palabra: string) => [palabra])
  Font.register({
    family: 'Archivo',
    fonts: [
      { src: ruta('Archivo-Regular.ttf'), fontWeight: 400 },
      { src: ruta('Archivo-Medium.ttf'), fontWeight: 500 },
      { src: ruta('Archivo-SemiBold.ttf'), fontWeight: 600 },
    ],
  })
  Font.register({
    family: 'IBM Plex Sans',
    fonts: [
      { src: ruta('IBMPlexSans-Regular.ttf'), fontWeight: 400 },
      { src: ruta('IBMPlexSans-Medium.ttf'), fontWeight: 500 },
    ],
  })
}

registrarFuentesDeDisco()

// ─── Extractor ───────────────────────────────────────────────────────────────

function objetos(pdf: string): Map<number, string> {
  const mapa = new Map<number, string>()
  for (const m of pdf.matchAll(/(?:^|\n)(\d+) 0 obj\n([\s\S]*?)\nendobj/g)) {
    mapa.set(Number(m[1]), m[2])
  }
  return mapa
}

function flujo(cuerpo: string): string {
  const inicio = cuerpo.indexOf('stream\n') + 'stream\n'.length
  const crudo = Buffer.from(cuerpo.slice(inicio, cuerpo.indexOf('\nendstream')), 'latin1')
  return cuerpo.includes('/FlateDecode')
    ? zlib.inflateSync(crudo).toString('latin1')
    : crudo.toString('latin1')
}

function tablaUnicode(cmap: string): Map<number, string> {
  const tabla = new Map<number, string>()
  for (const m of cmap.matchAll(/<([0-9a-f]{4})>\s*<([0-9a-f]+)>/gi)) {
    tabla.set(parseInt(m[1], 16), Buffer.from(m[2], 'hex').swap16().toString('utf16le'))
  }
  return tabla
}

/** Matriz de transformación `[a b c d e f]`, como la escribe el operador `cm`. */
type Matriz = readonly [number, number, number, number, number, number]
const IDENTIDAD: Matriz = [1, 0, 0, 1, 0, 0]

/** `cm` premultiplica: la nueva matriz se aplica ANTES que la que ya estaba. */
function concatenar(n: Matriz, p: Matriz): Matriz {
  return [
    n[0] * p[0] + n[1] * p[2],
    n[0] * p[1] + n[1] * p[3],
    n[2] * p[0] + n[3] * p[2],
    n[2] * p[1] + n[3] * p[3],
    n[4] * p[0] + n[5] * p[2] + p[4],
    n[4] * p[1] + n[5] * p[3] + p[5],
  ]
}

interface Renglon {
  readonly texto: string
  /** Línea base medida desde el borde SUPERIOR de la hoja. */
  readonly arriba: number
  readonly x: number
}

/** Un rectángulo relleno del flujo. Los filetes del sistema son todos de esta clase. */
interface Rectangulo {
  readonly ancho: number
  readonly alto: number
}

interface Hoja {
  readonly texto: string
  readonly cuerpos: ReadonlySet<number>
  readonly renglones: readonly Renglon[]
  readonly rectangulos: readonly Rectangulo[]
}

function leer(pdf: Buffer): Hoja[] {
  const bruto = pdf.toString('latin1')
  const objs = objetos(bruto)

  const tablas = new Map<string, Map<number, string>>()
  for (const dicc of bruto.matchAll(/\/Font <<([^>]*)>>/g)) {
    for (const par of dicc[1].matchAll(/\/(\w+) (\d+) 0 R/g)) {
      const fuente = objs.get(Number(par[2])) ?? ''
      const ref = fuente.match(/\/ToUnicode (\d+) 0 R/)
      if (ref === null) continue
      tablas.set(par[1], tablaUnicode(flujo(objs.get(Number(ref[1])) ?? '')))
    }
  }

  return [...bruto.matchAll(/\/Type \/Page\n[\s\S]*?\/Contents (\d+) 0 R/g)].map((pagina) => {
    const contenido = flujo(objs.get(Number(pagina[1])) ?? '')
    let tabla: Map<number, string> | undefined
    let texto = ''
    const cuerpos = new Set<number>()
    const renglones: Renglon[] = []
    const rectangulos: Rectangulo[] = []
    const pila: Matriz[] = []
    let ctm: Matriz = IDENTIDAD
    let actual = ''
    let base = 0
    let x = 0

    const cerrar = (): void => {
      if (actual !== '') renglones.push({ texto: actual, arriba: 792 - base, x })
      actual = ''
    }

    for (const t of contenido.matchAll(
      /(q)\n|(Q)\n|(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) cm|\/(\w+) ([\d.]+) Tf|(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) Tm|\[([^\]]*)\] TJ|(-?[\d.]+) (-?[\d.]+) (-?[\d.]+) (-?[\d.]+) re/g,
    )) {
      if (t[1] !== undefined) {
        pila.push(ctm)
        continue
      }
      if (t[2] !== undefined) {
        ctm = pila.pop() ?? IDENTIDAD
        continue
      }
      if (t[3] !== undefined) {
        ctm = concatenar([+t[3], +t[4], +t[5], +t[6], +t[7], +t[8]] as const, ctm)
        continue
      }
      if (t[9] !== undefined) {
        tabla = tablas.get(t[9])
        cuerpos.add(Number(t[10]))
        continue
      }
      if (t[11] !== undefined) {
        cerrar()
        base = ctm[1] * +t[15] + ctm[3] * +t[16] + ctm[5]
        x = ctm[0] * +t[15] + ctm[2] * +t[16] + ctm[4]
        continue
      }
      if (t[18] !== undefined) {
        rectangulos.push({ ancho: +t[20], alto: +t[21] })
        continue
      }
      for (const cadena of t[17].matchAll(/<([0-9a-f]+)>/gi)) {
        for (let i = 0; i < cadena[1].length; i += 4) {
          const c = tabla?.get(parseInt(cadena[1].slice(i, i + 4), 16)) ?? ''
          texto += c
          actual += c
        }
      }
    }
    cerrar()
    return { texto, cuerpos, renglones, rectangulos }
  })
}

// ─── Los datos, inventados ───────────────────────────────────────────────────

const acento = resolverAcento(ACENTO_BASE_POR_DEFECTO)

/**
 * ⚠ Ninguna cadena de anclaje lleva la secuencia `fi` en MINÚSCULA: react-pdf incrusta la
 * ligadura como un glifo propio y su `ToUnicode` no la descompone. En mayúsculas no ligan.
 */
const PACIENTE = 'Renata Bustamante Oceguera'
const FAMILIAR = 'Maria Bustamante Canul'
const PROCEDIMIENTO = 'Artrodesis lumbar instrumentada L4-L5'

/** Un PNG de 1 × 1. Hace de rúbrica: lo que se mide es la caja, no el trazo. */
const RASTER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

const BASE: DenegacionConsentimientoProps = {
  // v3 · requerida: el formato no adivina si la denegación fue por sustitución.
  sustitucion: false,
  medico: {
    nombre: 'Dra. Elena Marin Solis',
    especialidad: 'Ortopedia y Traumatologia',
    universidad: 'Universidad Nacional Autonoma de Mexico',
    cedulas: ['Ced. Prof. 7000001', 'Ced. Esp. 8000002'],
  },
  consultorio: {
    domicilio: 'Av. Ficticia 100, Consultorio 3, Col. Ejemplo, 06700 CDMX',
    telefono: 'Tel. 55 0000 0000',
  },
  panel: { variante: 'monograma', acento, iniciales: 'EM' },
  acento,
  paciente: {
    paciente: PACIENTE,
    edad: '25 años',
    fecha: '22 jun 2026',
    familiar: FAMILIAR,
    hospital: 'Hospital Ficticio del Centro',
    lugar: 'Mérida, Yucatán',
  },
  procedimiento: PROCEDIMIENTO,
  firmantes: {
    medico: { rubrica: RASTER },
    paciente: { nombre: PACIENTE, rubrica: RASTER },
    familiar: { nombre: FAMILIAR },
  },
  folio: 'DEN-2026-0001',
}

/** Por sustitución: aparece la constancia y la retícula baja a dos columnas. */
/**
 * ⚠ v3 · **EL MOTIVO VUELVE A SER UN DATO, y en v2 era una fórmula cableada.**
 * El formato ya no redacta «Imposibilidad física para firmar»: compone lo que el médico
 * asienta, que llega por `data.motivoNoFirma` (`dudas.md` §15). Sin el dato, el bloque
 * colapsa entero y el documento sale como salía antes de que existiera el campo.
 */
const MOTIVO = 'Imposibilidad física para firmar por fractura de la mano derecha.'

const SUSTITUCION: DenegacionConsentimientoProps = {
  ...BASE,
  sustitucion: true,
  motivo: MOTIVO,
}

/** El mismo documento con el familiar VACÍO: su celda no colapsa, deja la línea. */
const FAMILIAR_VACIO: DenegacionConsentimientoProps = {
  ...BASE,
  paciente: { ...BASE.paciente, familiar: undefined },
}

/**
 * EL PROCEDIMIENTO MÁS LARGO QUE ESTO TIENE QUE AGUANTAR, y no es una cadena inventada al
 * azar: es un nombre quirúrgico completo con lateralidad, abordaje, niveles y material, que es
 * como los escriben los formularios cuando nadie los acorta.
 */
const PROCEDIMIENTO_LARGO =
  'Artrodesis lumbar posterolateral instrumentada de L3 a S1 con tornillos transpediculares de titanio, descompresión mediante laminectomía y foraminotomía bilateral, e injerto óseo autólogo de cresta ilíaca derecha'

/**
 * EL DIAGNÓSTICO, que va DENTRO de la declaración y no en el riel.
 *
 * ⚠ **`BASE` NO LO LLEVA, Y ESO ES DELIBERADO.** Las dos cotas de holgura que esta prueba
 * compara contra la guía —75.79 y 26.04— están medidas sobre la cadena de §5, que no tiene
 * inciso de diagnóstico. Meterlo en el caso base movería las dos y dejaría la comparación sin
 * referencia. Lo que cuesta el inciso se mide aparte, que es su propia prueba.
 *
 * `CON_DIAGNOSTICO` lleva uno REAL —el del caso de II.7, 67 caracteres—; el largo es el mismo
 * padecimiento redactado entero, con grado, lateralidad y hallazgo de imagen.
 */
const DIAGNOSTICO = 'Espondilolistesis degenerativa L4-L5 con estenosis del canal lumbar'
const DIAGNOSTICO_LARGO =
  'Espondilolistesis degenerativa grado II de L4-L5 con estenosis severa del canal lumbar, radiculopatía L5 bilateral e inestabilidad segmentaria documentada por radiografías dinámicas'

const CON_DIAGNOSTICO: DenegacionConsentimientoProps = {
  ...BASE,
  paciente: { ...BASE.paciente, diagnostico: DIAGNOSTICO },
}

/** Un `Document` con un solo `Page`, que es lo que ocurre en emisión real. */
async function componer(props: DenegacionConsentimientoProps): Promise<Hoja[]> {
  return leer(
    await renderToBuffer(h<DocumentProps>(Document, {}, h(DenegacionConsentimiento, props))),
  )
}

/**
 * react-pdf sitúa la línea base a `ascendente × cuerpo` del borde superior de la caja de línea.
 * **El ascendente es de la FAMILIA**: Archivo declara 878 / 1000 em e IBM Plex Sans 1025 / 1000.
 * Aquí solo hace falta el segundo —las dos cotas que se miden, el arranque de la declaración y
 * el cierre de la celda de firma, son humanistas—; el de Archivo vive en los otros tres tests
 * que sí anclan en versalitas. Medido sobre el PDF.
 */
const ASCENDENTE_PLEX = 1025 / 1000

function renglon(hoja: Hoja, texto: string): Renglon {
  const encontrado = hoja.renglones.find((r) => r.texto === texto)
  expect(encontrado, `no se encontró el renglón «${texto}»`).toBeDefined()
  return encontrado as Renglon
}

/** ¿Hay un renglón que empiece por este texto? Para las líneas que el ancho parte. */
function contiene(hoja: Hoja, texto: string): boolean {
  return hoja.texto.includes(texto)
}

/**
 * LOS RÓTULOS DE LA FILA DE FIRMAS, de izquierda a derecha.
 *
 * Se toman por ORDENADA y no por texto, y eso no es un rodeo: `PACIENTE` y
 * `FAMILIAR O RESPONSABLE` rotulan también dos celdas del riel, 300 pt más arriba. La fila la
 * fija el rótulo del médico, que es el único que no se repite, y que las tres cotas caigan en
 * ella es la mitad de la regla que este formato estrenó — **una sola fila siempre**.
 */
function rolesDeFirma(hoja: Hoja): readonly Renglon[] {
  const medico = renglon(hoja, 'MÉDICO TRATANTE')
  return hoja.renglones
    .filter((r) => Math.abs(r.arriba - medico.arriba) < 0.01)
    .slice()
    .sort((uno, otro) => uno.x - otro.x)
}

/**
 * EL ENCABEZADO PROPIO: del margen de 54 al borde superior de la declaración.
 *
 * Se mide desde la línea base de su primer renglón restando lo único que hay en medio — la
 * separación de primer nivel, el filete de acento del marco, su padding superior y el
 * ascendente del cuerpo.
 */
function encabezado(hoja: Hoja): number {
  return (
    renglon(hoja, 'Yo, ').arriba -
    MARGEN.superior -
    ESPACIO[12] -
    FILETE.acento -
    /*
      ⚠ v3 · `MARCO.declaracion` desaparece: los dos paddings que quedan en 2.U son
      `aseguradora` y `leyenda`, y este documento compone el suyo con `leyenda`.
    */
    MARCO.leyenda.superior -
    ASCENDENTE_PLEX * TIPOGRAFIA['seccion.parrafo'].cuerpo
  )
}

/**
 * LA HOLGURA HASTA EL FONDO DE LA CAJA — 724 pt, que es donde el margen inferior reserva los
 * 36 + 16 + 16 pt de la banda de 2.M. Es la cifra contra la que la guía mide las dos variantes.
 */
const FONDO_DE_CAJA = PAPEL.alto - MARGEN.inferior

/**
 * DÓNDE TERMINA EL CONTENIDO — el borde inferior de la celda de firma MÁS BAJA.
 *
 * La última línea de una celda es su credencial, y bajo ella no queda nada: la celda cierra con
 * su interlineado. Se mide desde su línea base y se le devuelven los dos sumandos.
 *
 * ⚠ **SE TOMA LA LÍNEA MÁS BAJA DE LA HOJA Y NO LA DE UNA CELDA ELEGIDA A MANO**, y esto no es
 * una precaución teórica: en la variante de tres columnas **la credencial del médico rompe a dos
 * renglones** (ver la prueba de las columnas), así que anclar en la celda del familiar —que es
 * la que cierra a la derecha— daba 11 pt de holgura de más. Una holgura medida sobre la celda
 * equivocada es peor que no medirla: dice que cabe lo que no cabe.
 *
 * La banda de pie no entra: vive en posición absoluta por debajo del fondo de la caja.
 */
function finDelContenido(hoja: Hoja): number {
  const ultima = hoja.renglones
    .filter((r) => r.arriba < FONDO_DE_CAJA)
    .reduce((mayor, r) => Math.max(mayor, r.arriba), 0)
  return (
    ultima -
    ASCENDENTE_PLEX * TIPOGRAFIA['firma.credencial'].cuerpo +
    (TIPOGRAFIA['firma.credencial'].interlineado ?? 0)
  )
}

/**
 * El ancho de celda de la banda de cierre.
 *
 * ⚠ **v3 · LA RETÍCULA REPARTE SIEMPRE EN TERCIOS, TENGA LAS CELDAS QUE TENGA.** En v2 el
 * ancho lo decidía el NÚMERO de firmantes —tres de 142 o dos de 228, con medianil de 30—;
 * en v3 la variante `reticula` compone celdas de `CIERRE.tercio` (168) con el medianil
 * único de 18, así que dos firmantes ocupan dos tercios y dejan el tercero libre en vez de
 * ensancharse.
 *
 * La SUSTITUCIÓN es otra cosa: ahí el formato pide `pareja`, que son dos celdas de
 * `CIERRE.pareja` (261) repartiéndose la caja entera. Las dos variantes de 2.L tienen
 * anchos propios y por eso hay dos constantes y no una.
 */
const MEDIANIL_FIRMAS = CIERRE.medianil
const CELDA_TRES = CIERRE.tercio
const CELDA_DOS = CIERRE.pareja
/** Una retícula de tres columnas con dos celdas deja la tercera libre. */
const CELDA_RETICULA_INCOMPLETA = CIERRE.tercio

describe('II.9 · Denegación o revocación del consentimiento', () => {
  it('el encabezado, contra la cota de 240.59 de la guía', async () => {
    const [vacio] = await componer(FAMILIAR_VACIO)

    /*
      LO COMPUESTO SON **237.57 pt**, y la cota se lee con el familiar VACÍO porque es como la
      compone la guía —su línea de escritura es lo que sube esa fila de 35 a 35.47—.

          237.57  + 2.85 (el panel)  =  240.42

      contra los **240.59** medidos: **0.17 pt**, del mismo orden que los residuos de las ocho
      láminas anteriores y repartido entre el riel (0.05) y las cajas de línea del HTML. El
      presupuesto entero está sumado en la cabecera del formato.
    */
    /*
      ⚠ **SON 180.5 Y ERAN 237.57.** El panel baja de 56 a 40, el nombre del médico de 26 a
      15, la banda de dirección pasa de dos renglones a uno y la celda de la ficha de 33 a
      28.5 —este formato compone la calibración `declaracion`—. La contabilidad de la guía,
      que explicaba la diferencia con los 2.85 del panel, se cierra con ella.
    */
    /*
      ⚠ **+11 pt: LA UNIVERSIDAD VUELVE AL MEMBRETE.** Se retiró en el rediseño y no debía
      —es requisito en la receta—, así que se repone en **su propio renglón bajo la banda
      de dirección**, a la izquierda y con los 540 de la caja. Dentro de la banda no cabía:
      ese renglón gasta ya 448.37 pt y la universidad pide 160 más su raya. Cuesta su
      renglón de `medico.credencial`, 11 pt, y sólo cuando el médico la tiene registrada:
      sin ella el nodo no se monta y esta cota vuelve a la de antes. Ver la cabecera de 2.B.
    */
    expect(encabezado(vacio)).toBeCloseTo(191.5, 1)
  }, 200_000)

  it('la línea del familiar vale 2.47: ahora SÍ manda la celda vacía', async () => {
    const [lleno] = await componer(BASE)
    const [vacio] = await componer(FAMILIAR_VACIO)

    /*
      ⚠ **LA COTA SE INVIERTE: 2.47 Y ERAN 0.47.**

      El campo vacío requerido sube su celda 2.47 pt —la línea de escritura de 16.47 en vez
      del renglón de valor de 14—. En v2 esos 2.47 se los tragaba la fila, porque `Hospital
      o clínica` y `Lugar` iban a interlineado 16 y ya la estiraban; **en v3 las tres celdas
      de esa fila comparten el mismo interlineado**, así que la vacía es la más alta y manda.

      La regla es la misma —la celda más alta manda sobre las otras—; lo que cambió es cuál
      es la más alta. Que el riel crezca EXACTAMENTE lo que crece la celda es lo que dice
      que no hay ningún aire de más escondido ahí.
    */
    expect(encabezado(vacio) - encabezado(lleno)).toBeCloseTo(2.47, 2)
  }, 200_000)

  it('LAS DOS VARIANTES CABEN EN UNA HOJA, que es la única condición dura', async () => {
    expect((await componer(BASE)).length).toBe(1)
    expect((await componer(SUSTITUCION)).length).toBe(1)
    expect((await componer(FAMILIAR_VACIO)).length).toBe(1)
  }, 200_000)

  it('la holgura de la variante en que firma el paciente, contra los 75.79 de la guía', async () => {
    const [a] = await componer(BASE)
    const holgura = FONDO_DE_CAJA - finDelContenido(a)

    /*
      **102.43 pt**, contra los 75.79 de la guía. La cifra se lee en dos pasos y el segundo es
      nuevo:

      1 · La composición daba **68.43**, y esa resta contra la guía cerraba EXACTA con cinco
          sumandos:

          +2.85   el panel, que las nueve láminas miden en 58.85 y el chasis compone en 56
          +0.47   la línea del familiar: la guía mide con la celda VACÍA y este caso trae dato
          +0.27   la celda de firma, 117.47 compuesta contra 117.74 medidos
          +0.05   el riel, 70.57 compuesto contra 70.62 medidos
          −11     **el segundo renglón de credencial del médico** — ver la prueba siguiente
          ──────
          −7.36   75.79 → 68.43

          ⚠ Los cuatro primeros son residuos y el quinto no. Es una divergencia con la guía y
          va reportada.

      2 · **+34.00 al retirar la declaración de sustitución de esta variante**, que son sus dos
          piezas y nada más: **12** de separación y **22** de texto —dos renglones de 11 a
          `casilla.texto`, 8 / 11—. Aquí ya no se compone: esta es la variante en que el
          paciente firma por sí mismo.

      Este documento no era el que apretaba, y ahora aprieta todavía menos: 117 pt de sobra son
      siete renglones largos del párrafo de la declaración.

      ⚠ **+15.4 pt DESDE QUE LA RÚBRICA ENCOGIÓ.** `FIRMA.espacio` bajó un 20 % —de 77 a
      61.6— porque ese hueco no es papel en blanco: es donde 2.L imprime la rúbrica
      capturada del médico. La holgura se escribe contra el token y no como cifra suelta,
      así que la cota sigue midiendo el documento y no el tamaño de la firma.
    */
    /*
      ⚠ v3 · **+11 pt EN LAS TRES HOLGURAS DE ESTE ARCHIVO, Y SON EL MISMO CAMBIO.** El
      aviso de continuación se retira del chasis y `MARGEN.inferior` baja de 63 a 52, así
      que la caja crece 11 pt en todas las hojas de los nueve formatos. El documento no
      compone ni un punto distinto: lo que crece es el papel libre debajo. Ver la nota de
      `MotorFlujo`.

      ⚠ **243.25 pt, y eran 118.83.** La contabilidad de arriba —cinco residuos contra los
      75.79 de la guía— se cierra con v3: la caja crece 23 pt de alto, el encabezado
      adelgaza 57 y la celda de firma pasa de 118.75 a 72.75 al perder su rótulo. Este
      documento nunca fue el que apretaba y ahora le sobran 232 pt: trece renglones largos
      del párrafo de la declaración.
    */
    // v3 · −1 pt: el encabezado crece un punto al reponerse la universidad (2.B).
    expect(holgura).toBeCloseTo(232.25, 1)
  }, 200_000)

  it('la holgura de la variante por sustitución, contra los 26.04 de la guía', async () => {
    const [b] = await componer(SUSTITUCION)
    const holgura =
      FONDO_DE_CAJA - finDelContenido(b)

    /*
      **29.43 pt**, contra los 26.04 de la guía: los mismos 3.64 de arriba menos los **0.25**
      que la constancia compone de más —38 contra 37.75—. Es la variante más ajustada del
      sistema y la que hay que mirar cuando algo de este documento crezca.

      ⚠ **NO SE MOVIÓ AL QUITAR LA CASILLA, Y ES LO QUE HABÍA QUE COMPROBAR.** Aquí la
      declaración de sustitución SÍ se compone —es su variante—, así que lo único que se retiró
      fue el cuadro de 9 × 9 y su medianil de 7: 16 pt de ANCHO, que el texto recupera al pasar
      de 410 a los 426 del marco. No es alto, y el texto sigue ocupando dos renglones a los dos
      anchos, así que la cota más ajustada del sistema se queda exactamente donde estaba.

      La otra variante ganó 34 pt; esta, cero. Quien mida este documento tiene que seguir
      mirando ESTA — aunque desde que la rúbrica encogió respira 15.4 pt más.

      ⚠ **+15.4 pt DESDE QUE LA RÚBRICA ENCOGIÓ.** `FIRMA.espacio` bajó un 20 % —de 77 a
      61.6— porque ese hueco no es papel en blanco: es donde 2.L imprime la rúbrica
      capturada del médico. La holgura se escribe contra el token y no como cifra suelta,
      así que la cota sigue midiendo el documento y no el tamaño de la firma.
    */
    /*
      ⚠ v3 · **+11 pt EN LAS TRES HOLGURAS DE ESTE ARCHIVO, Y SON EL MISMO CAMBIO.** El
      aviso de continuación se retira del chasis y `MARGEN.inferior` baja de 63 a 52, así
      que la caja crece 11 pt en todas las hojas de los nueve formatos. El documento no
      compone ni un punto distinto: lo que crece es el papel libre debajo. Ver la nota de
      `MotorFlujo`.

      ⚠ **148.25 pt, y eran 44.83.** Sigue siendo la variante más ajustada de este formato
      —la constancia del motivo y la declaración de sustitución sólo existen aquí— pero
      deja de ser la más ajustada del sistema: con 137 pt de sobra aguanta ocho renglones
      más de declaración.
    */
    // v3 · −1 pt: el encabezado crece un punto al reponerse la universidad (2.B).
    expect(holgura).toBeCloseTo(137.25, 1)
    expect(holgura).toBeGreaterThan(0)
  }, 200_000)

  it('la retícula reparte tantas columnas como firmantes, en una sola fila', async () => {
    const [a] = await componer(BASE)
    const [b] = await componer(SUSTITUCION)

    /*
      TRES FIRMANTES EN TRES COLUMNAS DE 142 y DOS EN DOS DE 228, con el medianil de 30 en las
      dos. Se mide por la abscisa del rótulo de cada celda, que arranca en el borde izquierdo
      de su columna.

      ⚠ **EN DOS COLUMNAS LOS TRES FIRMANTES DESBORDABAN 62 pt** y dejaban media fila vacía:
      era el reparto cableado de 2.L antes del parámetro `columnas`. Que las tres cotas estén
      en la MISMA ordenada es la otra mitad de la regla —una sola fila siempre—.
    */
    expect(rolesDeFirma(a).map((r) => r.texto)).toEqual([
      'MÉDICO TRATANTE',
      'PACIENTE',
      'FAMILIAR O RESPONSABLE',
    ])
    expect(rolesDeFirma(a).map((r) => r.x)).toEqual([
      MARGEN.izquierdo,
      MARGEN.izquierdo + CELDA_TRES + MEDIANIL_FIRMAS,
      MARGEN.izquierdo + (CELDA_TRES + MEDIANIL_FIRMAS) * 2,
    ])

    /*
      POR SUSTITUCIÓN LA CELDA DEL PACIENTE DESAPARECE, no se queda vacía: la retícula baja a
      dos columnas de 228 y el familiar ocupa la segunda.
    */
    expect(rolesDeFirma(b).map((r) => r.texto)).toEqual([
      'MÉDICO TRATANTE',
      'FAMILIAR O RESPONSABLE',
    ])
    expect(rolesDeFirma(b).map((r) => r.x)).toEqual([
      MARGEN.izquierdo,
      MARGEN.izquierdo + CELDA_DOS + MEDIANIL_FIRMAS,
    ])
  }, 200_000)

  /**
   * El mismo criterio que II.7, comprobado aquí porque la retícula es la misma y el defecto
   * era del componente compartido: una celda sin nombre componía rol, espacio de escritura,
   * línea y nota, o sea una raya de firma en blanco. Aquí el caso es remoto —el formulario
   * exige el familiar SIEMPRE en la denegación— y por eso se prueba: lo que imprime el papel
   * no puede depender de una validación que vive en otro archivo.
   */
  it('un firmante sin nombre no compone celda: la retícula baja de columnas', async () => {
    const [hoja] = await componer({
      ...BASE,
      paciente: { ...BASE.paciente, familiar: undefined },
      firmantes: { medico: { rubrica: RASTER }, paciente: { nombre: PACIENTE }, familiar: {} },
    })

    /*
      ⚠ El fixture limpia TAMBIÉN el familiar de la ficha: la celda lee `firmantes.familiar
      .nombre ?? paciente.familiar`, así que con el respaldo puesto la celda sí existe y
      con razón. Lo que esta prueba fija es que sin NINGUNO de los dos no se compone.
    */
    expect(rolesDeFirma(hoja).map((r) => r.texto)).toEqual(['MÉDICO TRATANTE', 'PACIENTE'])
    // Dos celdas de 228, el reparto de la variante por sustitución: no son tres de 142 con
    // la tercera en blanco.
    expect(rolesDeFirma(hoja).map((r) => r.x)).toEqual([
      MARGEN.izquierdo,
      MARGEN.izquierdo + CELDA_RETICULA_INCOMPLETA + MEDIANIL_FIRMAS,
    ])
  }, 200_000)

  it('el diagnóstico entra en la declaración y NO en el riel', async () => {
    const [con] = await componer(CON_DIAGNOSTICO)
    const [sin] = await componer(BASE)

    /*
      EL INCISO SE COMPONE DENTRO DE LA FRASE que el paciente firma, no como celda de cabecera:
      en una revocación que puede acabar en sede legal importa no solo qué procedimiento se
      rechazó sino de qué se estaba tratando al paciente.

      Que el riel NO lo lleve se comprueba por el encabezado: si hubiera entrado como celda, el
      riel habría ganado una fila entera y el encabezado no mediría lo mismo que sin él.
    */
    expect(contiene(con, 'con diagnóstico de')).toBe(true)
    expect(contiene(con, DIAGNOSTICO)).toBe(true)
    expect(encabezado(con)).toBeCloseTo(encabezado(sin), 2)
    expect(contiene(con, 'DIAGNÓSTICO')).toBe(false)
  }, 200_000)

  it('SIN diagnóstico la frase se compone sin el inciso, sin hueco y sin coma doble', async () => {
    const [sin] = await componer(BASE)

    /*
      El campo no es obligatorio en denegación —exigirlo bloquearía un rechazo por no haber
      redactado antes lo que el paciente acaba de rechazar—, así que **el caso es real y no un
      descuido**. La coma que abre el inciso viaja dentro de él, así que al desaparecer no queda
      ni raya ni doble coma: `Yo, X, declaro que…`.
    */
    expect(contiene(sin, 'con diagnóstico')).toBe(false)
    expect(contiene(sin, `${PACIENTE}, declaro que he sido informado`)).toBe(true)
  }, 200_000)

  it('lo que cuesta el inciso, y hasta dónde lo aguanta la variante por sustitución', async () => {
    const holguraDe = async (
      props: DenegacionConsentimientoProps,
    ): Promise<number> => FONDO_DE_CAJA - finDelContenido((await componer(props))[0])

    /*
      ⚠⚠ **EL INCISO YA NO CUESTA UN RENGLÓN, Y EL TECHO DE CARACTERES DESAPARECE.**

      v2 lo medía en 16 pt —el diagnóstico real llevaba el primer párrafo de tres renglones
      a cuatro— y dejaba escrito un techo: «84 caracteres caben y 85 no», subido después a
      168 al encoger el hueco de la rúbrica, con el encargo de que si alguien lo resolvía,
      esta prueba fallara y hubiera que venir a leerlo. **Falló, y esto es lo que hay que
      leer.**

      Lo resolvió el rediseño entero y no una palanca: la medida del párrafo pasa de 486 a
      540, `seccion.parrafo` compone más caracteres por renglón, el encabezado adelgaza 57
      pt y la celda de firma 46. Con el diagnóstico real el párrafo NO gana un renglón —la
      holgura es idéntica con inciso y sin él— y la variante por sustitución **no llega a
      dos hojas con ninguna longitud de diagnóstico que este caso pueda producir**.

      **El defecto no está acotado: está fuera de alcance con datos reales.** Lo que queda
      es la cota de ausencia: si algún día el inciso vuelve a costar un renglón, la primera
      igualdad de abajo falla y hay que releer esto.
    */
    expect(await holguraDe(CON_DIAGNOSTICO)).toBeCloseTo(await holguraDe(BASE), 1)
    expect(await holguraDe({ ...CON_DIAGNOSTICO, sustitucion: true })).toBeCloseTo(194.25, 1)

    const conDiagnosticoDe = async (n: number): Promise<number> =>
      (
        await componer({
          ...SUSTITUCION,
          paciente: { ...BASE.paciente, diagnostico: DIAGNOSTICO_LARGO.slice(0, n) },
        })
      ).length

    // El diagnóstico más largo que este caso produce, y sigue en UNA hoja.
    expect(await conDiagnosticoDe(DIAGNOSTICO_LARGO.length)).toBe(1)

    // La otra variante aguanta el diagnóstico entero: no es ella la que desborda.
    expect(
      (
        await componer({
          ...BASE,
          paciente: { ...BASE.paciente, diagnostico: DIAGNOSTICO_LARGO },
        })
      ).length,
    ).toBe(1)
  }, 200_000)

  it('la credencial del médico entra en UN renglón: la celda de 168 la aguanta', async () => {
    const [a] = await componer(BASE)
    const [b] = await componer(SUSTITUCION)

    /*
      ⚠⚠ **LA COTA SE INVIERTE Y ESO CIERRA UN DEFECTO REPORTADO.**

      v2 componía tres celdas de 142 pt y la credencial del médico —`Céd. Prof. … · Céd.
      Esp. …` a 7.5 pt— se pasaba: partía a dos renglones y dejaba la celda del médico 11
      pt más baja que las otras dos. Quedó REPORTADO porque las tres salidas estaban
      prohibidas o eran peores —comprimir el cuerpo (I.3.4), recortar la cédula con
      elipsis, o ensanchar la columna rompiendo el reparto—.

      En v3 la celda mide **168** y la credencial baja a 7 pt, así que entra en un renglón
      y las tres celdas vuelven a medir lo mismo. **No se arregló persiguiéndolo**: salió
      de ensanchar la caja a 540 y de recalibrar el rol.

      Si esta prueba vuelve a fallar con 3, la credencial volvió a partirse y con ella la
      desalineación de la banda de cierre.
    */
    /*
      Se cuenta por COLUMNA y no por texto: la segunda mitad de una cédula partida es una cifra
      suelta —`8000002`— que no se puede buscar por prefijo, y las cédulas de este caso van sin
      acento mientras las reales lo llevan. Lo que se mide es cuántos renglones cuelgan de la
      línea de firma del médico, que es la primera columna.
    */
    const bajoLaLinea = (hoja: Hoja): number => {
      const rol = renglon(hoja, 'MÉDICO TRATANTE')
      return hoja.renglones.filter((r) => r.x === MARGEN.izquierdo && r.arriba > rol.arriba)
        .length
    }

    // Nombre + credencial en UN renglón cada uno, en las dos variantes.
    expect(bajoLaLinea(a)).toBe(2)
    expect(bajoLaLinea(b)).toBe(2)
  }, 200_000)

  it('la constancia del motivo existe SOLO en la variante por sustitución', async () => {
    const [a] = await componer(BASE)
    const [b] = await componer(SUSTITUCION)

    expect(contiene(a, 'MOTIVO POR EL QUE EL PACIENTE NO FIRMA')).toBe(false)
    expect(contiene(b, 'MOTIVO POR EL QUE EL PACIENTE NO FIRMA')).toBe(true)
    // Sin la ligadura `fi`, que el lector no descompone: `firmar` se lee `rmar`.
    expect(contiene(b, 'Imposibilidad física para rmar')).toBe(true)
  }, 200_000)

  it('la sustitución se compone SOLO si se ejerció, y sin casilla', async () => {
    const [a] = await componer(BASE)
    const [b] = await componer(SUSTITUCION)

    /*
      EN UN DOCUMENTO LEGAL NO HAY CASILLAS: se imprime la frase o no se imprime nada. Un
      cuadrito vacío no distingue una negativa de un olvido, y aquí además salía vacío en
      TODAS las denegaciones emitidas —el formulario ocultaba su control en esta rama y no
      persistía el campo—, así que el papel dibujaba una posibilidad inejercitable.

      El caso en que firma el paciente ya lo dice su propia firma en la retícula de tres
      columnas; no necesita una frase que lo niegue.
    */
    expect(contiene(b, 'El paciente no puede rmar por sí mismo')).toBe(true)
    expect(a.texto).not.toContain('El paciente no puede')

    /*
      NI EL CUADRO NI SU MARCA. La casilla era 9 × 9 con un rectángulo sólido de 5 × 5 dentro
      —no un glifo de palomita: una tipografía de check dependería de una fuente que el sistema
      no carga—, así que los dos se miden como rectángulos del flujo. Ninguno puede quedar.
    */
    const casilla = (hoja: Hoja): number =>
      hoja.rectangulos.filter(
        (r) => (r.ancho === 5 && r.alto === 5) || (r.ancho === 9 && r.alto === 9),
      ).length
    expect(casilla(a)).toBe(0)
    expect(casilla(b)).toBe(0)
  }, 200_000)

  it('la constancia colapsa entera sin motivo, y con él compone lo asentado', async () => {
    /*
      ⚠ **LA COTA SE INVIERTE. `motivo` VUELVE A SER UNA PROP, y en v2 se había retirado.**

      v2 la quitó porque no la alimentaba nadie y dejó la fórmula cableada «Imposibilidad
      física para firmar». v3 la repone —la adenda del brief le da un campo en el
      formulario, `data.motivoNoFirma`— así que el papel compone lo que el médico asienta
      y no una frase del sistema.

      **Sin el dato el bloque COLAPSA ENTERO**, que es lo que hay que vigilar: un documento
      antiguo, guardado antes de que el campo existiera, sale exactamente como salía —con
      la declaración de sustitución y sin recuadro— en vez de con un rótulo y un hueco.
    */
    const [sinMotivo] = await componer({ ...BASE, sustitucion: true })
    expect(contiene(sinMotivo, 'MOTIVO POR EL QUE EL PACIENTE NO FIRMA')).toBe(false)
    // La declaración de sustitución sí se compone: es la que enlaza con las firmas.
    expect(contiene(sinMotivo, 'no puede rmar por sí mismo')).toBe(true)

    const [conMotivo] = await componer(SUSTITUCION)
    expect(contiene(conMotivo, 'MOTIVO POR EL QUE EL PACIENTE NO FIRMA')).toBe(true)
    // Sin la ligadura `fi`, que el lector no descompone: `firmar` se lee `rmar`.
    expect(contiene(conMotivo, 'Imposibilidad física para rmar')).toBe(true)
  }, 200_000)

  it('EL RIESGO DECLARADO: el recorte del subtítulo es lo que mantiene la hoja única', async () => {
    /*
      LA GUÍA LO DEJA ESCRITO: con un nombre de procedimiento largo, la variante por sustitución
      es la primera que desborda. Aquí está medido, y con la cifra al lado.

      **Sin el recorte de 2.C el techo son 69 caracteres** —medido: 69 caben en el renglón del
      subtítulo y 70 lo parten en dos, y esos 14 pt se comen los 29.43 de holgura junto al
      primer renglón que gana la declaración—. **Con él, 142**, que es donde la declaración gana
      su SEGUNDO renglón: el primero cabe y el segundo ya no.

      ⚠ **EL TECHO NO DESAPARECE, SE MUEVE.** El `NO DEFINIDO` que la guía deja abierto —qué
      hacer si aun así desborda— sigue abierto, y ahora empieza 73 caracteres más allá. Un
      nombre quirúrgico completo con lateralidad, abordaje, niveles y material entra en 142; uno
      que además arrastre el material de dos casas comerciales, no. **Es decisión de Angel**, y
      lo que este archivo hace es dejar la frontera medida en vez de descubrirla en producción.

      ⚠ Los 142 son de ESTA cadena: el corte real depende del juego de anchos de sus glifos y de
      dónde caigan sus espacios. Lo que no depende de la cadena es la regla —**la declaración
      aguanta un renglón de más y no dos**—, y es lo que hay que releer si algún día falla.
    */
    const conProcedimiento = async (n: number): Promise<number> =>
      (await componer({ ...SUSTITUCION, procedimiento: PROCEDIMIENTO_LARGO.slice(0, n) }))
        .length

    expect(await conProcedimiento(69)).toBe(1)
    expect(await conProcedimiento(142)).toBe(1)

    // La variante en que firma el paciente aguanta el nombre entero: le sobran 79 pt.
    expect(
      (await componer({ ...BASE, procedimiento: PROCEDIMIENTO_LARGO })).length,
    ).toBe(1)
  }, 200_000)

  it('la banda de pie numera «PÁGINA 1 DE 1» y no lleva QR', async () => {
    const [a] = await componer(BASE)

    // Sin anexo y sin continuación, la numeración está cerrada por construcción.
    expect(contiene(a, 'PÁGINA 1 DE 1')).toBe(true)
    expect(contiene(a, 'DEN-2026-0001')).toBe(true)
    /*
      SIN QR: el documento no autoriza nada, es la constancia de que no se autorizó. 2.O lo
      compone como una imagen, así que su ausencia se mide por que la hoja no tenga ninguna —la
      única del documento son las rúbricas, que van por `Image` igual—. Se comprueba por la
      cadena de verificación, que es lo que la zona de QR rotula en los formatos que lo llevan.
    */
    expect(contiene(a, 'Verifica')).toBe(false)
  }, 200_000)

})
