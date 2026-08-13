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
  CAJA,
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
const SUSTITUCION: DenegacionConsentimientoProps = { ...BASE, sustitucion: true }

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
    MARCO.declaracion.padding.superior -
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

/** El ancho de celda que la retícula reparte, por número de columnas. Ver `anchoDeCelda` en 2.L. */
const MEDIANIL_FIRMAS = 30
const CELDA_TRES = (CAJA.ancho - MEDIANIL_FIRMAS * 2) / 3
const CELDA_DOS = (CAJA.ancho - MEDIANIL_FIRMAS) / 2

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
    expect(encabezado(vacio)).toBeCloseTo(237.57, 1)
  }, 200_000)

  it('la línea del familiar vale 0.47 y no 2.47, porque la fila la manda el hospital', async () => {
    const [lleno] = await componer(BASE)
    const [vacio] = await componer(FAMILIAR_VACIO)

    /*
      El campo vacío requerido sube su CELDA de 33 a 35.47 —2.47 pt—, y aun así el riel solo
      crece 0.47: en esa fila viven además `Hospital o clínica` y `Lugar`, los dos a
      interlineado 16, que ya la estiraban a 35. Es la misma regla que gobierna toda fila de
      riel —la celda más alta manda sobre las otras— y es lo que hace que la guía mida la
      segunda fila más alta que la primera **con dato y sin él**.
    */
    expect(encabezado(vacio) - encabezado(lleno)).toBeCloseTo(0.47, 2)
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
      **68.43 pt**, contra los 75.79 de la guía, y la resta cierra EXACTA con cinco sumandos:

          +2.85   el panel, que las nueve láminas miden en 58.85 y el chasis compone en 56
          +0.47   la línea del familiar: la guía mide con la celda VACÍA y este caso trae dato
          +0.27   la celda de firma, 117.47 compuesta contra 117.74 medidos
          +0.05   el riel, 70.57 compuesto contra 70.62 medidos
          −11     **el segundo renglón de credencial del médico** — ver la prueba siguiente
          ──────
          −7.36   75.79 → 68.43

      ⚠ **LOS CUATRO PRIMEROS SON RESIDUOS Y EL QUINTO NO.** Es una divergencia con la guía, va
      reportada, y el documento sigue cabiendo en su hoja con 68 pt de sobra.
    */
    expect(holgura).toBeCloseTo(68.43, 1)
  }, 200_000)

  it('la holgura de la variante por sustitución, contra los 26.04 de la guía', async () => {
    const [b] = await componer(SUSTITUCION)
    const holgura =
      FONDO_DE_CAJA - finDelContenido(b)

    /*
      **29.43 pt**, contra los 26.04 de la guía: los mismos 3.64 de arriba menos los **0.25**
      que la constancia compone de más —38 contra 37.75—. Es la variante más ajustada del
      sistema y la que hay que mirar cuando algo de este documento crezca.
    */
    expect(holgura).toBeCloseTo(29.43, 1)
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
      firmantes: { medico: { rubrica: RASTER }, paciente: { nombre: PACIENTE }, familiar: {} },
    })

    expect(rolesDeFirma(hoja).map((r) => r.texto)).toEqual(['MÉDICO TRATANTE', 'PACIENTE'])
    // Dos celdas de 228, el reparto de la variante por sustitución: no son tres de 142 con
    // la tercera en blanco.
    expect(rolesDeFirma(hoja).map((r) => r.x)).toEqual([
      MARGEN.izquierdo,
      MARGEN.izquierdo + CELDA_DOS + MEDIANIL_FIRMAS,
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
      **UN RENGLÓN, 16 pt.** Con el diagnóstico real —67 caracteres— el primer párrafo pasa de
      tres renglones a cuatro, y eso es exactamente lo que la variante por sustitución podía
      pagar: de 29.43 baja a **13.43** y sigue en una hoja.

      ⚠ **NO QUEDA MARGEN PARA UN SEGUNDO RENGLÓN**, y ahí está el techo: con esta cadena y este
      procedimiento, **84 caracteres de diagnóstico caben y 85 no**. La variante en que firma el
      paciente no lo sufre —le sobran 68 pt— y aguanta el diagnóstico entero.

      ⚠ **LOS 84 NO SON UNA REGLA, SON UNA COTA DE ESTA CADENA.** El diagnóstico y el
      procedimiento viven en el MISMO párrafo y compiten por los mismos renglones: alargar uno
      acorta al otro, y el corte real depende de dónde caigan los espacios. La regla que sí se
      sostiene y que hay que releer si esto falla es **el párrafo aguanta un renglón de más y no
      dos**.
    */
    // La variante que firma el paciente: de 68.43 a 52.43. Le sobra de largo.
    expect(await holguraDe(CON_DIAGNOSTICO)).toBeCloseTo(52.43, 1)
    // La ajustada: de 29.43 a 13.43. Sigue en una hoja, y sin sitio para otro renglón.
    expect(await holguraDe({ ...CON_DIAGNOSTICO, sustitucion: true })).toBeCloseTo(13.43, 1)

    const conDiagnosticoDe = async (n: number): Promise<number> =>
      (
        await componer({
          ...SUSTITUCION,
          paciente: { ...BASE.paciente, diagnostico: DIAGNOSTICO_LARGO.slice(0, n) },
        })
      ).length

    expect(await conDiagnosticoDe(84)).toBe(1)

    /*
      ⚠⚠ **A PARTIR DE 85 LA VARIANTE POR SUSTITUCIÓN SE VA A DOS HOJAS, Y ESO NO ES ACEPTABLE.**
      No se tapa con un recorte: lo único que queda por recortar es la declaración, que es la
      frase que el paciente firma y donde el diagnóstico acaba de entrar por su valor legal —
      recortarla escondería el dato que el cambio existe para asentar—. El subtítulo ya va a un
      renglón desde 2.C, así que esa palanca está gastada.

      **Queda como decisión de Angel**, con la cifra medida al lado. La palanca que sobra es
      retirar el subtítulo entero del bloque de título —16 pt, un renglón más de declaración—,
      y no se ha compuesto porque hacer aparecer y desaparecer un bloque según lo que mida el
      párrafo de abajo es métrica decidida por el contenido, que es lo que I.3.4 prohíbe.

      Esta aserción fija el defecto en vez de esconderlo: si alguien lo resuelve, falla y hay
      que venir a leer esto.
    */
    expect(await conDiagnosticoDe(85)).toBe(2)

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

  it('⚠ EN 142 pt LA CREDENCIAL DEL MÉDICO ROMPE A DOS RENGLONES, contra lo que la guía verifica', async () => {
    const [a] = await componer(BASE)
    const [b] = await componer(SUSTITUCION)

    /*
      LA GUÍA LO DA POR VERIFICADO: «a 142 pt: rol, nombre y nota entran **en un renglón cada
      uno**, sin saltos». **En el PDF no**: `Céd. Prof. 9552456 · Céd. Esp. 12085805` a 7.5 pt en
      IBM Plex Sans mide algo más de 142, así que parte, y la celda del médico queda 11 pt más
      baja que las otras dos.

      **Se compone así y queda reportado.** Las tres salidas que lo evitarían están prohibidas o
      son peores: bajar el cuerpo o el tracking es comprimir para cuadrar una hoja (I.3.4);
      recortar la cédula con elipsis es esconder un dato de identificación profesional, que es
      exactamente lo que 2.H prohíbe; y ensanchar la columna rompe el reparto de la guía. La
      holgura lo absorbe —68.43 pt— y en dos columnas de 228 la línea entra sin partirse.

      Si algún día la guía se remide y la lámina compone otra cosa, esta prueba es la que dice
      qué se estaba componiendo mientras tanto.
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

    // Nombre + credencial en dos renglones contra nombre + credencial en uno.
    expect(bajoLaLinea(a)).toBe(3)
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

  it('la casilla se imprime en las dos variantes y solo se marca en una', async () => {
    const [a] = await componer(BASE)
    const [b] = await componer(SUSTITUCION)

    // La casilla sale siempre: lo que informa es que existe la posibilidad y si se ejerció.
    expect(contiene(a, 'El paciente no puede rmar por sí mismo')).toBe(true)
    expect(contiene(b, 'El paciente no puede rmar por sí mismo')).toBe(true)

    /*
      LA MARCA ES UN RECTÁNGULO DE 5 × 5 y no un glifo de palomita: una tipografía de check
      dependería de la fuente y no está en ninguna de las dos familias del sistema. Por eso se
      mide como rectángulo del flujo.
    */
    const marca = (hoja: Hoja): number =>
      hoja.rectangulos.filter((r) => r.ancho === 5 && r.alto === 5).length
    expect(marca(a)).toBe(0)
    expect(marca(b)).toBe(1)
  }, 200_000)

  it('el motivo entra por prop y no rompe la hoja única', async () => {
    const hojas = await componer({
      ...SUSTITUCION,
      motivo: 'El paciente se encuentra bajo sedación y no puede otorgar firma autógrafa.',
    })
    expect(hojas).toHaveLength(1)
    expect(contiene(hojas[0], 'bajo sedación')).toBe(true)
    expect(contiene(hojas[0], 'Imposibilidad física')).toBe(false)
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
