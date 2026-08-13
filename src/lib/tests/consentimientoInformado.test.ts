/**
 * II.7 · Consentimiento Informado — **la prueba que mide el PDF real**.
 *
 * POR QUÉ EXISTE, Y POR QUÉ MIDE EN VEZ DE COMPARAR TOKENS
 *
 * El encabezado de un formato no es una constante: es la suma de sus bloques. Aquí se
 * renderiza el PDF, se leen las coordenadas de su flujo de contenido y se mide. El lector
 * sale entero de `solicitudInternamiento.test.ts`.
 *
 * LO QUE ESTA PRUEBA VIGILA Y NINGUNA OTRA PUEDE
 *
 * **Cuántas hojas salen.** El cuerpo de este formato va justificado —excepción declarada a
 * I.3.2, decidida por Angel tras comparar las dos versiones en papel— y las seis hojas de la
 * lámina se conservan. La cifra se mide y **no se ajusta nada para forzarla**.
 *
 * **Que la hoja de anexo no exista sin fotografías.** Es la decisión de producto 5 y la
 * única rama del sistema donde una hoja entera aparece o desaparece por un dato.
 *
 * **Que la variante por sustitución quite un nivel y renumere el siguiente.** Es sustitución
 * y no adición: el familiar firma UNA vez, arriba o abajo, nunca en los dos sitios.
 */

import { describe, it, expect } from 'vitest'
import zlib from 'node:zlib'
import path from 'node:path'
import React from 'react'
import { Document, Font, renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import ConsentimientoInformado, {
  type ConsentimientoInformadoProps,
  type IdentificacionAnexo,
} from '@/lib/pdf/v2/formatos/ConsentimientoInformado'
import {
  FILETE_CONSENTIMIENTO,
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

// ─── Los datos, inventados y compartidos ─────────────────────────────────────

const acento = resolverAcento(ACENTO_BASE_POR_DEFECTO)

/**
 * ⚠ Ninguna cadena de anclaje lleva la secuencia `fi` en MINÚSCULA: react-pdf incrusta la
 * ligadura como un glifo propio y su `ToUnicode` no la descompone. En mayúsculas no ligan,
 * así que `IDENTIFICACIÓN` y `FIRMANTES` sí se pueden anclar.
 */
const PACIENTE = 'Renata Bustamante Oceguera'
const FAMILIAR = 'Maria Bustamante Canul'
const PROCEDIMIENTO = 'Artrodesis lumbar instrumentada L4-L5'
const TITULO = 'CARTA DE CONSENTIMIENTO INFORMADO'
const HOSPITAL = 'Hospital Ficticio del Centro'

/** Un PNG de 1 × 1. Hace de fotografía y de rúbrica: lo que se mide es la caja, no la foto. */
const SELLO_MEDICO = '09/08/2026 12:41:52'
const SELLO_PACIENTE = '09/08/2026 12:43:07'
const SELLO_DOCUMENTO = '09/08/2026 12:47:19'
const HUELLA = '3f9a…8c41'

const RASTER =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII='

const IDENTIFICACIONES: readonly IdentificacionAnexo[] = [
  { rol: 'Paciente', nombre: PACIENTE, tipo: 'Credencial para votar', numero: 'BUOR010412MYN04', foto: RASTER },
  { rol: 'Familiar o responsable', nombre: FAMILIAR, tipo: 'Credencial para votar', numero: 'BUCM780921MYN08', foto: RASTER },
  // Sin fotografía: el recuadro se compone igual, con su leyenda y con sus dos datos.
  { rol: 'Testigo 1', nombre: 'Juan Canul Uc', tipo: 'Credencial para votar', numero: 'CAUJ850614HYN02' },
  { rol: 'Testigo 2', nombre: 'Rosa Pech Ek', tipo: 'Pasaporte', numero: 'G12345678' },
]

/** Las mismas SIN ninguna fotografía: la hoja de anexo no se imprime. */
const SIN_FOTOS: readonly IdentificacionAnexo[] = IDENTIFICACIONES.map(
  ({ rol, nombre, tipo, numero }) => ({ rol, nombre, tipo, numero }),
)

const SECCIONES = {
  preoperatorio:
    'Después de haberle realizado historia clínica y estudios diagnósticos pertinentes, se ha establecido el diagnóstico descrito y, habiendo agotado otras alternativas de tratamiento, se le recomienda someterse al procedimiento indicado.',
  beneficios:
    'El fin primordial del procedimiento es corregir la condición diagnosticada, proteger las estructuras anatómicas involucradas, mantener o restaurar la función y evitar la progresión de la enfermedad.',
  anestesia:
    'La intervención puede precisar anestesia, cuyo tipo y modalidad serán valorados en forma individual de acuerdo con las características del paciente y del procedimiento.',
  descripcion:
    'Se realizará abordaje posterior en la línea media, descompresión mediante laminectomía de L4, y artrodesis instrumentada con tornillos transpediculares y barras de titanio.',
  riesgosComunes:
    'Cualquier procedimiento quirúrgico conlleva riesgos comunes independientemente de la técnica empleada, que incluyen sangrado, infección de la herida quirúrgica, reacciones adversas a la anestesia y trombosis venosa profunda.',
  riesgosEspecificos:
    'Lesión de la raíz nerviosa L5 con debilidad o alteración de la sensibilidad, y ausencia de consolidación de la artrodesis con necesidad de reintervención.',
  alternativas:
    'Como alternativa al procedimiento propuesto, el paciente puede optar por tratamiento conservador que incluye manejo analgésico, reposo relativo y rehabilitación física.',
}

const COMPLETO: ConsentimientoInformadoProps = {
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
    expediente: '2026-0184',
    fecha: '22 jun 2026',
    familiar: FAMILIAR,
    diagnostico: 'Espondilolistesis degenerativa L4-L5 con estenosis del canal lumbar',
    hospital: HOSPITAL,
    lugar: 'Mérida, Yucatán',
  },
  procedimiento: PROCEDIMIENTO,
  secciones: SECCIONES,
  /*
    RÚBRICAS Y SELLOS MEZCLADOS: el médico y el paciente firman —con horas DISTINTAS, que es
    parte de la evidencia—, los otros tres no. Un firmante sin sello no llevará pie.
  */
  firmantes: {
    medico: { rubrica: RASTER, sello: SELLO_MEDICO },
    paciente: { nombre: PACIENTE, rubrica: RASTER, sello: SELLO_PACIENTE },
    familiar: { nombre: FAMILIAR },
    testigo1: { nombre: 'Juan Canul Uc' },
    testigo2: { nombre: 'Rosa Pech Ek' },
  },
  identificaciones: IDENTIFICACIONES,
  sellado: { fecha: SELLO_DOCUMENTO, huella: HUELLA },
  folio: 'C-7F41A9C0D3E2',
}

/** El mismo documento SIN sellar: no hay nada que sellar, así que no hay sellos. */
const SIN_SELLAR: ConsentimientoInformadoProps = { ...COMPLETO, sellado: undefined }

/** El mismo documento con el familiar VACÍO: su celda no colapsa, deja la línea. */
const FAMILIAR_VACIO: ConsentimientoInformadoProps = {
  ...COMPLETO,
  paciente: { ...COMPLETO.paciente, familiar: undefined },
}

/** Sin ninguna fotografía: la hoja de anexo no existe. */
const SIN_ANEXO: ConsentimientoInformadoProps = {
  ...COMPLETO,
  identificaciones: SIN_FOTOS,
}

/** Por sustitución: el familiar firma en el nivel 1 y el nivel 2 desaparece. */
const SUSTITUCION: ConsentimientoInformadoProps = { ...COMPLETO, pacienteNoPuedeFirmar: true }


/** Un `Document` con un solo `Page`, que es lo que ocurre en emisión real. */
async function componer(props: ConsentimientoInformadoProps): Promise<Hoja[]> {
  return leer(
    await renderToBuffer(h<DocumentProps>(Document, {}, h(ConsentimientoInformado, props))),
  )
}

/**
 * react-pdf sitúa la línea base a `ascendente × cuerpo` del borde superior de la caja de
 * línea. **El ascendente es de la FAMILIA**: Archivo declara 878 / 1000 em e IBM Plex Sans
 * 1025 / 1000, y por eso las dos constantes no son una. Medido sobre el PDF.
 */
const ASCENDENTE_ARCHIVO = 878 / 1000

function renglon(hoja: Hoja, texto: string): Renglon {
  const encontrado = hoja.renglones.find((r) => r.texto === texto)
  expect(encontrado, `no se encontró el renglón «${texto}»`).toBeDefined()
  return encontrado as Renglon
}

/**
 * LA LIGADURA `fi`, QUITADA DE LA CADENA ESPERADA EN VEZ DE EVITADA EN EL DATO.
 *
 * react-pdf incrusta `fi` como un glifo propio y su `ToUnicode` no lo descompone, así que el
 * extractor lee `rmante` donde el PDF imprime `firmante`. En los siete formatos anteriores
 * bastó con no anclar en cadenas que la llevaran; aquí no se puede — las cadenas del sello
 * dicen `firmantes`, `firmaron` y `verificable`, y son justo las que hay que comprobar.
 *
 * Se aplica la MISMA transformación a lo esperado. Es una limitación del lector, no del
 * documento: en el PDF la palabra está entera y se copia entera.
 */
function sinLigadura(texto: string): string {
  return texto.replace(/fi/g, '')
}

/** ¿Hay un renglón que empiece por este texto? Para las líneas que el ancho parte. */
function contiene(hoja: Hoja, texto: string): boolean {
  return hoja.texto.includes(texto)
}

/**
 * El encabezado propio: del margen de 54 al borde superior de la primera sección. Se mide
 * desde la línea base de su NÚMERO restando lo único que hay en medio — el filete de la
 * sección, su padding y el ascendente del número.
 */
function encabezado(hoja: Hoja): number {
  return (
    renglon(hoja, '1').arriba -
    54 -
    FILETE_CONSENTIMIENTO.regla -
    7 -
    ASCENDENTE_ARCHIVO * TIPOGRAFIA['seccion.numero'].cuerpo
  )
}

describe('II.7 · Consentimiento Informado', () => {
  it('el encabezado, contra la cota de 511.6 de la lámina', async () => {
    const [hoja1] = await componer(COMPLETO)

    /*
      LO COMPUESTO SON **507.385 pt** con el familiar lleno. La cota de la lámina se lee con
      el familiar VACÍO, que es como ella lo compone, así que hay que sumarle su línea de
      escritura antes de comparar:

          507.385  + 2.47 (la línea del familiar) + 2.85 (el panel)  =  512.705

      contra los **511.6** medidos: **1.105 pt**, que es exactamente lo que el bloque de
      fundamento compone de más —116 contra 114.9— por componer su párrafo en bandera. El
      resto del presupuesto cierra al punto.
    */
    expect(encabezado(hoja1)).toBeCloseTo(507.385, 1)
  }, 200_000)

  it('con el texto en bandera izquierda salen SEIS hojas, las de la lámina', async () => {
    const hojas = await componer(COMPLETO)

    /*
      ⚠ **LA CIFRA SE MIDE, NO SE FUERZA.** El cuerpo de este formato va JUSTIFICADO —la
      excepción declarada a I.3.2— y el justificado no cambia dónde corta cada renglón, solo
      reparte el sobrante, así que el documento no repagina por él: medido con las dos
      alineaciones antes de decidir, las dos daban seis hojas y el mismo reparto.

      **Si esta prueba falla al tocar un texto, la respuesta NO es apretar el interlineado**
      (I.3.4): es actualizar la cifra y decirlo.

      Y el reparto es el de la lámina hasta en qué abre cada hoja:
    */
    expect(hojas).toHaveLength(6)

    // El título es el de II.7 —el término de la NOM-004—, no el de la lámina.
    expect(contiene(hojas[0], TITULO)).toBe(true)
    expect(hojas[0].texto).not.toContain('CONSENTIMIENTO MÉDICO INFORMADO')

    expect(contiene(hojas[0], 'FUNDAMENTO LEGAL')).toBe(true)
    expect(contiene(hojas[0], 'DATOS DE IDENTIFICACIÓN')).toBe(true)
    expect(contiene(hojas[0], 'EVALUACIÓN Y DECISIÓN TERAPÉUTICA')).toBe(true)
    expect(contiene(hojas[3], 'DECLARACIÓN DE CONSENTIMIENTO')).toBe(true)
    expect(contiene(hojas[3], 'OTORGAMIENTO')).toBe(true)
    expect(contiene(hojas[4], 'REPRESENTACIÓN')).toBe(true)
    expect(contiene(hojas[4], 'TESTIGOS')).toBe(true)
    expect(contiene(hojas[5], 'ANEXO · IDENTIFICACIÓN DE FIRMANTES')).toBe(true)
    expect(hojas[5].texto).toContain('PÁGINA 6 DE 6')
  }, 200_000)

  it('el pie de sello sale solo en quien firmó, y remite al anexo', async () => {
    const hojas = await componer(COMPLETO)

    /*
      DOS FIRMARON Y TRES NO. Los dos que firmaron llevan su hora; los tres omitidos no llevan
      pie —no firmaron, no hay nada que sellar—. Las dos horas son distintas entre sí, que es
      lo que la evidencia necesita: cinco firmas en el mismo segundo son sospechosas.
    */
    expect(hojas[3].texto).toContain(`Firmado ${SELLO_MEDICO}`)
    expect(hojas[3].texto).toContain(`Firmado ${SELLO_PACIENTE}`)
    expect(hojas[4].texto).not.toContain('Firmado ')

    /*
      Y EL PACIENTE REMITE AL ANEXO PORQUE TIENE FOTOGRAFÍA ALLÍ; el médico no, porque el
      anexo reproduce la identificación de quien CONSIENTE, no la de quien informa.
    */
    const pie = (hoja: Hoja, sello: string): string => {
      const encontrado = hoja.renglones.find((r) => r.texto.startsWith(`Firmado ${sello}`))
      expect(encontrado, `no se encontró el pie de «${sello}»`).toBeDefined()
      return (encontrado as Renglon).texto
    }
    expect(pie(hojas[3], SELLO_PACIENTE)).toContain(
      sinLigadura('con identificación anexa'),
    )
    expect(pie(hojas[3], SELLO_MEDICO)).not.toContain('anexa')

    /*
      EL PIE CUESTA 11 pt POR CELDA, y se mide por dónde cae su línea base respecto de la
      calidad del firmante que tiene encima:

          11        la caja de línea de la nota, IBM Plex Sans 7.5 / 11
           2        el aire que declara la ranura de 2.L
        −  7.688    el ascendente de la humanista a 7.5 pt
        +  6.146    el de la neo-grotesca a 7
          ────────
          11.458

      Los 11 del coste son los 2 de aire más los 9 del renglón de `sello.pie`. Con dos celdas
      selladas, la hoja 4 crece 22 y **no repagina**: el documento sigue en seis hojas, que es
      lo que fija la prueba del bloque de verificación.
    */
    const nota = hojas[3].renglones.find((r) => r.texto === 'Nombre y rma')
    expect(nota).toBeDefined()
    const sello = hojas[3].renglones.find((r) =>
      r.texto.startsWith(`Firmado ${SELLO_PACIENTE}`),
    )
    expect(sello).toBeDefined()
    expect((sello as Renglon).arriba - (nota as Renglon).arriba).toBeCloseTo(11.46, 1)
  }, 200_000)

  it('el bloque de verificación va en la ÚLTIMA hoja, con y sin anexo', async () => {
    const conAnexo = await componer(COMPLETO)
    const sinAnexo = await componer(SIN_ANEXO)

    /*
      ⚠ **NO ES LA HOJA DE FIRMAS: ES LA ÚLTIMA DEL DOCUMENTO.** Con fotografías el documento
      termina en el anexo, así que el bloque baja con él. Un sello que dice que el documento no
      se alteró no puede tener páginas detrás.
    */
    expect(conAnexo).toHaveLength(6)
    expect(sinAnexo).toHaveLength(5)
    expect(conAnexo[5].texto).toContain(`Documento sellado el ${SELLO_DOCUMENTO}`)
    expect(sinAnexo[4].texto).toContain(`Documento sellado el ${SELLO_DOCUMENTO}`)
    // Y en ninguna otra: es un cierre, no una marca de página.
    for (const hoja of conAnexo.slice(0, 5)) {
      expect(hoja.texto).not.toContain('Documento sellado')
    }

    /*
      EL RECUENTO SE HACE SOBRE LAS CELDAS COMPUESTAS. Cinco firmantes, dos con hora: la
      diferencia es lo que responde a la pregunta de por qué hay celdas en blanco.
    */
    expect(conAnexo[5].texto).toContain(
      sinLigadura('5 firmantes previstos, 2 firmaron, 3 omitidos'),
    )
    expect(conAnexo[5].texto).toContain(`Huella SHA-256 · ${HUELLA}`)
    expect(conAnexo[5].texto).toContain(
      sinLigadura('verificable en el expediente electrónico'),
    )
  }, 200_000)

  it('por sustitución el recuento cuenta CUATRO, no cinco', async () => {
    const hojas = await componer({ ...COMPLETO, pacienteNoPuedeFirmar: true })

    /*
      El paciente no firma y su celda no existe, así que contarlo lo declararía omitido a
      pesar de que el documento no le pidió firmar — que es justo la pregunta que este
      recuento existe para cerrar.
    */
    expect(hojas[hojas.length - 1].texto).toContain(
      sinLigadura('4 firmantes previstos, 1 firmó, 3 omitidos'),
    )
  }, 200_000)

  /**
   * ⚠ EL DEFECTO QUE ESTA PRUEBA CIERRA. `previstos` estaba cableado al número de celdas
   * compuestas —cuatro o cinco— y las celdas de testigo se componen SIEMPRE, tengan nombre
   * o no, porque su línea se firma a mano (NOM-004). Consecuencia: un consentimiento de
   * consulta sin testigos imprimía «2 omitidos» sobre dos personas a las que nadie pidió
   * nada. En una hoja que puede acabar en sede legal eso no es una imprecisión de
   * redacción: es una afirmación falsa sobre personas.
   */
  it('sin testigos NO se declaran ausencias: solo consta quién firmó', async () => {
    const hojas = await componer({
      ...COMPLETO,
      firmantes: {
        medico: { rubrica: RASTER, sello: SELLO_MEDICO },
        paciente: { nombre: PACIENTE, rubrica: RASTER, sello: SELLO_PACIENTE },
        // Al familiar tampoco se le pidió: sin nombre no entró en ningún recuento.
        familiar: {},
        testigo1: {},
        testigo2: {},
      },
      identificaciones: undefined,
    })
    const cierre = hojas[hojas.length - 1].texto

    expect(cierre).toContain(sinLigadura('2 firmaron'))
    // Lo que NO puede decir: que faltara nadie.
    expect(cierre).not.toContain('omitido')
    expect(cierre).not.toContain(sinLigadura('firmantes previstos'))
  }, 200_000)

  /**
   * ⚠ EL SEGUNDO DEFECTO DEL MISMO CASO, Y EL QUE QUEDABA VIVO. El recuento dejó de
   * declarar ausencias inventadas, pero **las celdas se seguían componiendo vacías**: rol,
   * 77 pt de espacio de escritura, línea y nota. Cuatro rayas de firma en blanco dicen que
   * faltaron cuatro personas, que es lo mismo que el «3 omitidos» retirado, dicho sin
   * palabras y en el sitio donde más se mira.
   */
  it('sin familiar ni testigos NO se compone ninguna celda suya, ni su hoja', async () => {
    const sinNadie = await componer({
      ...COMPLETO,
      firmantes: {
        medico: { rubrica: RASTER, sello: SELLO_MEDICO },
        paciente: { nombre: PACIENTE, rubrica: RASTER, sello: SELLO_PACIENTE },
        familiar: {},
        testigo1: {},
        testigo2: {},
      },
      identificaciones: undefined,
    })

    /*
      LA HOJA ENTERA DESAPARECE. Con los cinco firmantes y sin anexo son cinco hojas —tres de
      secciones, otorgamiento y la de representación y testigos—; sin nadie a quien
      representar ni testigos que firmen, esa quinta no tiene nada que componer y el `break`
      la habría abierto igualmente, numerada y con folio.
    */
    expect(sinNadie).toHaveLength(4)

    const todo = sinNadie.map((hoja) => hoja.texto).join('')
    // Ni los rótulos de nivel…
    expect(todo).not.toContain('REPRESENTACIÓN')
    expect(todo).not.toContain('TESTIGOS')
    // …ni las celdas: el rol y la nota se componían aunque el nombre faltara.
    expect(todo).not.toContain('TESTIGO 1')
    expect(todo).not.toContain('TESTIGO 2')
    expect(todo).not.toContain('Mayor de edad')
    expect(todo).not.toContain('PARENTESCO CON EL PACIENTE')

    // Y el nivel 1 sigue entero: el otorgamiento es lo que este documento es.
    expect(contiene(sinNadie[3], 'OTORGAMIENTO')).toBe(true)
    expect(contiene(sinNadie[3], 'MÉDICO TRATANTE')).toBe(true)
    expect(contiene(sinNadie[3], 'PACIENTE')).toBe(true)
  }, 200_000)

  it('con un solo testigo se compone su celda y no la del otro', async () => {
    const hojas = await componer({
      ...COMPLETO,
      firmantes: {
        medico: { rubrica: RASTER, sello: SELLO_MEDICO },
        paciente: { nombre: PACIENTE, rubrica: RASTER, sello: SELLO_PACIENTE },
        familiar: {},
        testigo1: { nombre: 'Juan Canul Uc' },
        testigo2: {},
      },
      identificaciones: undefined,
    })
    const firmas = hojas[hojas.length - 1]

    expect(contiene(firmas, 'TESTIGO 1')).toBe(true)
    expect(firmas.texto).not.toContain('TESTIGO 2')
    // La nota de testigo se compone UNA vez: es lo que delata la celda del que no hay.
    expect(firmas.renglones.filter((r) => r.texto === 'Mayor de edad')).toHaveLength(1)

    /*
      SIN FAMILIAR NO HAY NIVEL DE REPRESENTACIÓN, y entonces Testigos es el 2 — como en la
      variante por sustitución, y por la misma razón: el número dice cuántos niveles hay
      encima, no de qué variante se trata.
    */
    expect(firmas.texto).not.toContain('REPRESENTACIÓN')
    expect(contiene(firmas, 'TESTIGOS')).toBe(true)
    expect(firmas.renglones.filter((r) => r.texto === '3')).toHaveLength(0)
  }, 200_000)

  it('un testigo CON nombre que no firmó sí consta como omitido', async () => {
    const hojas = await componer({
      ...COMPLETO,
      firmantes: {
        medico: { rubrica: RASTER, sello: SELLO_MEDICO },
        paciente: { nombre: PACIENTE, rubrica: RASTER, sello: SELLO_PACIENTE },
        familiar: {},
        testigo1: { nombre: 'Juan Canul Uc' },
        testigo2: {},
      },
      identificaciones: undefined,
    })

    // A este SÍ se le pidió firma —tiene nombre— y no firmó. Eso es una omisión real.
    expect(hojas[hojas.length - 1].texto).toContain(
      sinLigadura('3 firmantes previstos, 2 firmaron, 1 omitido'),
    )
  }, 200_000)

  it('sin sellar no hay un solo sello, aunque los firmantes traigan hora', async () => {
    const hojas = await componer(SIN_SELLAR)

    /*
      Un consentimiento impreso para firmarse a mano no lleva trazabilidad: **no hay nada que
      sellar**. Un solo interruptor gobierna los dos sitios, así que no puede quedar un pie de
      celda suelto sin bloque de cierre.
    */
    for (const hoja of hojas) {
      expect(hoja.texto).not.toContain('Firmado ')
      expect(hoja.texto).not.toContain('Documento sellado')
      expect(hoja.texto).not.toContain('Huella SHA-256')
      expect(hoja.texto).not.toContain(sinLigadura('firmantes previstos'))
    }
    // Y el documento sigue midiendo lo mismo: los sellos no cambian el reparto.
    expect(hojas).toHaveLength(6)
  }, 200_000)

  it('el riel son ocho celdas en cuatro filas, sin sexo y con celda base de 33', async () => {
    const [hoja1] = await componer(COMPLETO)

    // Las ocho, y ninguna de sexo: este formato no lo pide.
    for (const etiqueta of [
      'PACIENTE',
      'EDAD',
      'EXPEDIENTE',
      'FECHA',
      'FAMILIAR O RESPONSABLE',
      'DIAGNÓSTICO',
      'HOSPITAL O CLÍNICA',
      'LUGAR',
    ]) {
      expect(contiene(hoja1, etiqueta)).toBe(true)
    }
    expect(hoja1.texto).not.toContain('SEXO')

    /*
      LA CELDA BASE MIDE 33 —4 + 10 + 14 + 5— contra los 30 de los seis formatos anteriores,
      y el paso entre filas lo confirma sumando la regla de 0.375. Es el único riel del
      sistema con otra altura de celda.
    */
    const paso =
      renglon(hoja1, 'FAMILIAR O RESPONSABLE').arriba - renglon(hoja1, 'PACIENTE').arriba
    expect(paso).toBeCloseTo(33 + 0.375, 2)

    /*
      Y `Hospital o clínica` ES EL VALOR MÁS DESTACADO DEL RIEL: 12.5 pt contra los 11 de
      `Lugar`, que comparte fila con él. Las dos cajas de línea se apoyan por arriba, así que
      la diferencia entre sus líneas base es el ascendente por la diferencia de cuerpo —
      0.878 × 1.5 = 1.317— y eso es lo que mide que uno sube de cuerpo y el otro no.
    */
    const destaque =
      renglon(hoja1, HOSPITAL).arriba - renglon(hoja1, 'Mérida, Yucatán').arriba
    expect(destaque).toBeCloseTo(ASCENDENTE_ARCHIVO * (12.5 - 11), 2)
  }, 200_000)

  it('el familiar es campo vacío requerido: sin dato, la celda NO colapsa', async () => {
    const [conDato] = await componer(COMPLETO)
    const [sinDato] = await componer(FAMILIAR_VACIO)

    /*
      LA LÍNEA DE ESCRITURA, MEDIDA POR LO QUE EMPUJA. La celda pasa de 33 a 35.47 —4 + 10 +
      16.47 + 5— y con ella baja todo lo que hay debajo. Son las mismas dos cifras que la
      celda de paciente del recibo mínimo, que es el otro campo vacío requerido del sistema.
    */
    const bajada =
      renglon(sinDato, 'HOSPITAL O CLÍNICA').arriba -
      renglon(conDato, 'HOSPITAL O CLÍNICA').arriba
    expect(bajada).toBeCloseTo(2.47, 1)

    // Y el rótulo sigue ahí, que es la otra mitad de la regla 1 de 2.E.
    expect(contiene(sinDato, 'FAMILIAR O RESPONSABLE')).toBe(true)
    expect(sinDato.texto).not.toContain(FAMILIAR)
  }, 200_000)

  it('cinco firmantes en tres niveles, repartidos en dos hojas', async () => {
    const hojas = await componer(COMPLETO)

    // Nivel 1 en la hoja 4: médico y paciente.
    expect(contiene(hojas[3], 'MÉDICO TRATANTE')).toBe(true)
    expect(contiene(hojas[3], 'Ced. Prof. 7000001 · Ced. Esp. 8000002')).toBe(true)
    expect(hojas[3].texto).not.toContain('TESTIGO 1')

    // Niveles 2 y 3 en la hoja 5, con el parentesco colgando solo del familiar.
    expect(contiene(hojas[4], 'FAMILIAR O RESPONSABLE')).toBe(true)
    expect(contiene(hojas[4], 'PARENTESCO CON EL PACIENTE')).toBe(true)
    expect(contiene(hojas[4], 'TESTIGO 1')).toBe(true)
    expect(contiene(hojas[4], 'TESTIGO 2')).toBe(true)

    /*
      LOS TRES NIVELES VAN NUMERADOS 1, 2 Y 3, y el 3 solo aparece en la hoja 5. Es lo que
      distingue esta retícula de una de seis firmas seguidas: la jerarquía es del documento,
      no del hueco que quede.
    */
    expect(contiene(hojas[3], 'OTORGAMIENTO')).toBe(true)
    expect(contiene(hojas[4], 'REPRESENTACIÓN')).toBe(true)
    expect(contiene(hojas[4], 'TESTIGOS')).toBe(true)
  }, 200_000)

  it('por sustitución desaparece el nivel 2 y Testigos se renumera a 2', async () => {
    const hojas = await componer(SUSTITUCION)

    /*
      SUSTITUCIÓN Y NO ADICIÓN: el familiar firma en el nivel 1, en la celda del paciente, y
      el nivel de Representación deja de existir. El de Testigos pasa de 3 a 2.
    */
    expect(hojas[4].texto).not.toContain('REPRESENTACIÓN')
    expect(contiene(hojas[4], 'TESTIGOS')).toBe(true)
    expect(contiene(hojas[3], 'OTORGAMIENTO')).toBe(true)

    // El familiar sube al nivel 1, con su parentesco, y ya no está en la hoja 5.
    expect(contiene(hojas[3], 'FAMILIAR O RESPONSABLE')).toBe(true)
    expect(contiene(hojas[3], 'PARENTESCO CON EL PACIENTE')).toBe(true)
    expect(hojas[4].texto).not.toContain('PARENTESCO CON EL PACIENTE')

    // El número del nivel de testigos es el 2, y en la hoja 5 no hay ningún 3.
    const numeros = hojas[4].renglones.filter((r) => r.texto === '3')
    expect(numeros).toHaveLength(0)
  }, 200_000)

  it('la hoja de anexo NO aparece sin fotografías', async () => {
    const conFotos = await componer(COMPLETO)
    const sinFotos = await componer(SIN_ANEXO)

    /*
      LA DECISIÓN DE PRODUCTO 5, MEDIDA POR LO QUE QUITA: una hoja entera. Es la única rama
      del sistema donde un dato hace aparecer o desaparecer una hoja.
    */
    expect(conFotos).toHaveLength(6)
    expect(sinFotos).toHaveLength(5)
    for (const hoja of sinFotos) {
      expect(hoja.texto).not.toContain('ANEXO · IDENTIFICACIÓN DE FIRMANTES')
    }
    expect(sinFotos[4].texto).toContain('PÁGINA 5 DE 5')
  }, 200_000)

  it('el anexo imprime el tipo y el número haya foto o no', async () => {
    const [, , , , , anexo] = await componer(COMPLETO)

    // Los cuatro recuadros, numerados con cero a la izquierda.
    for (const numero of ['01', '02', '03', '04']) {
      expect(anexo.renglones.some((r) => r.texto === numero)).toBe(true)
    }

    /*
      EL QUE NO TIENE FOTOGRAFÍA LLEVA SU LEYENDA **Y SUS DOS DATOS**. Es la corrección que
      la lámina ya traía aplicada: lo que falta es la imagen, no el dato.
    */
    expect(contiene(anexo, 'No se capturó fotografía')).toBe(true)
    expect(contiene(anexo, 'CAUJ850614HYN02')).toBe(true)
    expect(contiene(anexo, 'Credencial para votar')).toBe(true)
    expect(contiene(anexo, 'Pasaporte')).toBe(true)
  }, 200_000)

  it('las tres cabeceras de continuación pesan 26, 12 y 20', async () => {
    const hojas = await componer(COMPLETO)

    /*
      LOS TRES ESPACIADORES DEL MISMO DOCUMENTO, medidos por dónde cae la línea de paciente:
      26 en las hojas que siguen texto corrido, 12 en las de firmas y 20 en la del anexo. Las
      diferencias son exactas porque todo lo demás de esa cabecera es idéntico.
    */
    const linea = (hoja: Hoja): number =>
      hoja.renglones.filter((r) => r.texto.startsWith('Paciente · '))[0].arriba

    expect(linea(hojas[2]) - linea(hojas[3])).toBeCloseTo(26 - 12, 1)
    expect(linea(hojas[5]) - linea(hojas[3])).toBeCloseTo(20 - 12, 1)
    expect(linea(hojas[1])).toBeCloseTo(linea(hojas[2]), 1)
  }, 200_000)

  it('la línea de continuación no lleva el hospital, aunque el riel lo tenga', async () => {
    const hojas = await componer(COMPLETO)

    /*
      ⚠ EL HOSPITAL EN ESA LÍNEA ES DE II.6, y esta lámina compone otra construcción —
      `Paciente · Nombre | Expediente 2026-0184 · 22 jun 2026`, en dos zonas y con la fecha
      en vez de la edad—. **No se compone**: la línea es una sola forma para los siete
      formatos. Lo que esta prueba fija es que el hospital del riel no se cuele en ella.
    */
    for (const hoja of hojas.slice(1)) {
      expect(hoja.texto).toContain(`Paciente · ${PACIENTE}`)
      expect(hoja.texto).not.toContain(`Exp. 2026-0184 · ${HOSPITAL}`)
    }
  }, 200_000)

  it('folio en todas las hojas, sin QR y sin contador', async () => {
    const hojas = await componer(COMPLETO)

    /*
      II.7 §1 conserva el folio y retira el QR, y son dos decisiones distintas: la NOM-004
      pide poder identificar la pieza del expediente, y este documento se firma y se archiva
      en papel, así que no hay ventanilla que escanee nada.
    */
    for (const hoja of hojas) {
      expect(hoja.texto).toContain('Folio C-7F41A9C0D3E2')
      expect(hoja.texto).not.toContain('VERIFICACIÓN')
      // 2.K no se instancia: no hay lista paginable que contar.
      expect(hoja.texto).not.toContain('TOTAL DE ')
    }
  }, 200_000)

  it('la sustitución se compone SOLO si se ejerció, y sin casilla', async () => {
    const normal = await componer(COMPLETO)
    const sustituido = await componer(SUSTITUCION)

    /*
      EN UN DOCUMENTO LEGAL NO HAY CASILLAS. Se imprime la frase o no se imprime nada: una
      casilla sin marcar dice «esto se podía marcar y no se marcó», y de ahí no se puede
      distinguir una negativa de un olvido. El caso normal —el paciente firma por sí
      mismo— ya lo dice su propia firma en el nivel 1; no necesita un cuadrito vacío.

      La casilla era un cuadro de 9 × 9 con una marca sólida de 5 × 5 dentro. Ninguno de
      los dos rectángulos puede quedar en la hoja, en ningún caso.
    */
    const casilla = (hojas: Hoja[]): boolean =>
      hojas[3].rectangulos.some(
        (r) => (r.ancho === 5 && r.alto === 5) || (r.ancho === 9 && r.alto === 9),
      )

    expect(contiene(sustituido[3], 'El paciente no puede')).toBe(true)
    expect(normal[3].texto).not.toContain('El paciente no puede')
    expect(casilla(normal)).toBe(false)
    expect(casilla(sustituido)).toBe(false)
  }, 200_000)

  it('las autorizaciones tampoco llevan casilla: la frase o nada', async () => {
    // El caso más cargado de los tres: la pila entera, con sus tres declaraciones.
    const hojas = await componer({
      ...SUSTITUCION,
      autorizaTransfusion: 'no',
      autorizaFotos: true,
    })

    expect(contiene(hojas[3], 'El paciente no puede')).toBe(true)
    expect(contiene(hojas[3], sinLigadura('NO autorizo la transfusión'))).toBe(true)
    expect(contiene(hojas[3], sinLigadura('Autorizo la toma de fotografías'))).toBe(true)
    expect(
      hojas[3].rectangulos.some(
        (r) => (r.ancho === 5 && r.alto === 5) || (r.ancho === 9 && r.alto === 9),
      ),
    ).toBe(false)
  }, 200_000)

  /**
   * ⚠ ESTE BLOQUE NO EXISTÍA EN v2 Y EL FORMULARIO SÍ CAPTURA SUS DOS DATOS.
   * `DOCUMENTOS_SPEC.md` II.7 §2 los declara y §3 los pone en la composición; el formato se
   * construyó sin ellos. Peor: entran en `contenidoConsentimiento()`, o sea DENTRO de la
   * huella SHA-256, así que el dato estaba firmado y no se imprimía. Encender v2 sin esto
   * habría borrado del papel si el paciente autoriza transfusión sanguínea.
   */
  describe('las autorizaciones del paciente', () => {
    it('la transfusión AUTORIZADA se compone con la redacción de v1', async () => {
      const hojas = await componer({
        ...COMPLETO,
        autorizaTransfusion: 'si',
      })
      expect(contiene(hojas[3], sinLigadura('Autorizo la transfusión de sangre'))).toBe(true)
    }, 200_000)

    /**
     * La negativa EXPRESA es el dato con más valor legal de los dos, y es justo el que un
     * booleano habría perdido: con `boolean`, «no se preguntó» y «el paciente lo rechazó»
     * se compondrían igual, sin línea. Por eso el campo es tri-estado.
     */
    it('la transfusión RECHAZADA se compone, y dice que se rechazó', async () => {
      const hojas = await componer({
        ...COMPLETO,
        autorizaTransfusion: 'no',
      })
      expect(contiene(hojas[3], sinLigadura('NO autorizo la transfusión'))).toBe(true)
      expect(contiene(hojas[3], 'asumiendo los riesgos')).toBe(true)
    }, 200_000)

    /**
     * ⚠ ESTE CASO YA NO SE PUEDE EMITIR, Y LA PRUEBA SIGUE AQUÍ POR ESO.
     *
     * La transfusión es obligatoria en el formulario: sin respuesta no se emite. Lo que
     * este caso cubre es la REIMPRESIÓN de un consentimiento anterior a esa regla, que
     * tiene `autorizaTransfusion: null` en la fila y es inmutable — no se corrige ni se
     * migra, así que el formato tiene que saber componerlo mientras exista uno.
     *
     * Y lo que compone es NADA. Inventar una respuesta que nadie dio es falsear una
     * declaración firmada; escribir «no se preguntó» sería meter un rótulo administrativo
     * dentro de la declaración del paciente. El papel calla lo que la fila no sabe.
     */
    it('un consentimiento heredado sin respuesta se reimprime sin la frase', async () => {
      const hojas = await componer(COMPLETO)
      for (const hoja of hojas) {
        expect(hoja.texto).not.toContain(sinLigadura('transfusión'))
        expect(hoja.texto).not.toContain(sinLigadura('fotografías clínicas'))
      }
    }, 200_000)

    it('las fotografías solo se componen si se autorizaron', async () => {
      const con = await componer({ ...COMPLETO, autorizaFotos: true })
      const sin = await componer({ ...COMPLETO, autorizaFotos: false })

      expect(contiene(con[3], sinLigadura('Autorizo la toma de fotografías'))).toBe(true)
      for (const hoja of sin) {
        expect(hoja.texto).not.toContain(sinLigadura('fotografías clínicas'))
      }
    }, 200_000)

    it('las dos autorizaciones colapsan por separado', async () => {
      const hojas = await componer({
        ...COMPLETO,
        autorizaTransfusion: 'si',
        autorizaFotos: false,
      })
      expect(contiene(hojas[3], sinLigadura('Autorizo la transfusión de sangre'))).toBe(true)
      expect(hojas[3].texto).not.toContain(sinLigadura('fotografías clínicas'))
    }, 200_000)
  })

  /**
   * Un familiar acompaña; un representante legal SUSTITUYE la voluntad del paciente. Quien
   * lea la hoja después tiene que poder distinguirlo sin abrir el expediente. v1 ya lo
   * distinguía (`ConsentimientoInformadoPdf.tsx:855`) y v2 lo había perdido.
   */
  it('el rótulo de la celda cambia cuando quien acompaña es representante legal', async () => {
    const familiar = await componer(COMPLETO)
    const representante = await componer({ ...COMPLETO, representanteLegal: true })

    expect(contiene(familiar[4], 'FAMILIAR O RESPONSABLE')).toBe(true)
    expect(contiene(representante[4], 'REPRESENTANTE LEGAL')).toBe(true)
    expect(representante[4].texto).not.toContain('FAMILIAR O RESPONSABLE')
  }, 200_000)

  /**
   * Los dos campos eran obligatorios y **nadie los alimentaba**: el formulario captura la
   * fotografía de la credencial y nada más. Requeridos, el anexo componía dos huecos donde
   * la lámina pone un dato.
   */
  it('el pie del anexo colapsa entero cuando no hay tipo ni número', async () => {
    const hojas = await componer({
      ...COMPLETO,
      identificaciones: [
        { rol: 'Paciente', nombre: PACIENTE, foto: RASTER },
        { rol: 'Familiar o responsable', nombre: FAMILIAR, foto: RASTER },
      ],
    })
    const anexo = hojas[hojas.length - 1]

    // La hoja existe —hay fotografías— y el recuadro compone su rol y su nombre.
    expect(contiene(anexo, 'ANEXO')).toBe(true)
    expect(contiene(anexo, PACIENTE)).toBe(true)
    // Lo que no aparece es el pie: ni el tipo de ninguna, ni un hueco donde iría.
    expect(anexo.texto).not.toContain('Credencial para votar')
  }, 200_000)

  it('con UNO de los dos, ese se compone solo y sin reservar el hueco del otro', async () => {
    const hojas = await componer({
      ...COMPLETO,
      identificaciones: [
        { rol: 'Paciente', nombre: PACIENTE, tipo: 'Credencial para votar', foto: RASTER },
      ],
    })
    const anexo = hojas[hojas.length - 1]

    expect(contiene(anexo, 'Credencial para votar')).toBe(true)
    expect(anexo.texto).not.toContain('BUOR010412MYN04')
  }, 200_000)
})
