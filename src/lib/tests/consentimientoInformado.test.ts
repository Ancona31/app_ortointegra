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
import type { ReactElement } from 'react'
import { Font, renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import ConsentimientoInformado, {
  type ConsentimientoInformadoProps,
  type IdentificacionAnexo,
} from '@/lib/pdf/v2/formatos/ConsentimientoInformado'
import {
  TIPOGRAFIA,
  FILETE,
  FICHA,
  MARGEN,
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
  // v3 · las dos son requeridas: un formato no adivina si se preguntó o no.
  pacienteNoPuedeFirmar: false,
  autorizaFotos: false,
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

/**
 * Sin ninguna fotografía. **La hoja de anexo SIGUE EXISTIENDO**: ver la prueba del anexo.
 */
const SIN_FOTOGRAFIAS: ConsentimientoInformadoProps = {
  ...COMPLETO,
  identificaciones: SIN_FOTOS,
}

/** Sin identificaciones de ninguna clase: eso, y sólo eso, retira la hoja de anexo. */
const SIN_ANEXO: ConsentimientoInformadoProps = { ...COMPLETO, identificaciones: [] }

/** Por sustitución: el familiar firma en el nivel 1 y el nivel 2 desaparece. */
const SUSTITUCION: ConsentimientoInformadoProps = { ...COMPLETO, pacienteNoPuedeFirmar: true }


/**
 * ⚠⚠ **SIN `Document` ALREDEDOR, Y ES LA DIFERENCIA DE v3.**
 *
 * II.7 compone TRES elementos de página —cuerpo, testigos y anexo— y por eso devuelve su
 * propio `Document` (brief 00 §9.5). Envolverlo en otro produce un documento dentro de un
 * documento y el renderer revienta con `Cannot read properties of null`. Es lo mismo que
 * hace `envolverDocumento()` en el cable y lo que el taller monta desde que se cableó.
 */
async function componer(props: ConsentimientoInformadoProps): Promise<Hoja[]> {
  const documento = h(ConsentimientoInformado, props) as ReactElement<DocumentProps>
  return leer(await renderToBuffer(documento))
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
 * El encabezado propio: del margen superior al borde superior de la primera sección. Se
 * mide desde la línea base de su NÚMERO restando lo único que hay en medio — el filete de
 * la sección, su padding y el ascendente del número.
 *
 * ⚠ v3 · **el margen ya no es 54 sino `ZONA_SEGURA`**: los cuatro se igualaron en 36 y el
 * inferior es el único distinto, porque debajo van la banda del pie y el aviso.
 */
function encabezado(hoja: Hoja): number {
  return (
    renglon(hoja, '1').arriba -
    MARGEN.superior -
    FILETE.tabla -
    7 -
    ASCENDENTE_ARCHIVO * TIPOGRAFIA['seccion.numero'].cuerpo
  )
}

describe('II.7 · Consentimiento Informado', () => {

  /**
   * ⚠ **COTA REESCRITA CONTRA v3. LA VIEJA DESCRIBÍA LA MAQUETA VIEJA**, no un defecto:
   * fijaba 507.385 pt de encabezado contra la lámina de 511.6, y las dos cifras son de un
   * chasis que ya no existe. Lo que las bajó a 346.7 son tres retiradas del rediseño, y
   * ninguna es un recorte de tipografía:
   *
   *   · el margen superior pasa de 54 a 36 (`ZONA_SEGURA`, §14);
   *   · el rótulo `DATOS DE IDENTIFICACIÓN` se retira —la ficha ya rotula cada celda y el
   *     bloque de título ya dice qué documento es— (`dudas.md` §19);
   *   · la ficha baja a una celda de 28.5 y el membrete recompone su banda.
   *
   * Se mide lo mismo que medía: del margen al borde superior de la sección 1.
   */
  it('el encabezado del cuerpo mide 346.7 desde el margen', async () => {
    const [hoja1] = await componer(COMPLETO)

    expect(encabezado(hoja1)).toBeCloseTo(346.7, 1)
  }, 200_000)

  it('con el texto en bandera izquierda salen CINCO hojas', async () => {
    const hojas = await componer(COMPLETO)

    /*
      ⚠ **LA CIFRA SE MIDE, NO SE FUERZA.** El cuerpo de este formato va JUSTIFICADO —la
      excepción declarada a I.3.2— y el justificado no cambia dónde corta cada renglón, solo
      reparte el sobrante, así que el documento no repagina por él: medido con las dos
      alineaciones antes de decidir, las dos daban seis hojas y el mismo reparto.

      **Si esta prueba falla al tocar un texto, la respuesta NO es apretar el interlineado**
      (I.3.4): es actualizar la cifra y decirlo. Esto es decirlo: **eran SEIS, las de la
      lámina, y son cinco desde que se retiraron las dos zonas de escritura** —96 pt bajo la
      descripción del procedimiento y 64 bajo los riesgos específicos, renglones pautados que
      el médico no llenaba porque esas secciones las escribe en el formulario—. Los 160 pt
      recuperados son la hoja que sobraba.

      Y el reparto sigue el de la lámina en qué abre cada hoja:
    */
    expect(hojas).toHaveLength(5)

    // El título es el de II.7 —el término de la NOM-004—, no el de la lámina.
    expect(contiene(hojas[0], TITULO)).toBe(true)
    expect(hojas[0].texto).not.toContain('CONSENTIMIENTO MÉDICO INFORMADO')

    expect(contiene(hojas[0], 'FUNDAMENTO LEGAL')).toBe(true)
    expect(contiene(hojas[0], 'EVALUACIÓN Y DECISIÓN TERAPÉUTICA')).toBe(true)
    /*
      ⚠ v3 · **EL RÓTULO `DATOS DE IDENTIFICACIÓN` SE RETIRA** y esta prueba fija que no
      vuelva: la ficha rotula cada una de sus ocho celdas y el bloque de título dice qué
      documento es, así que el rótulo costaba 15 pt de hoja 1 para nombrar lo nombrado.
      Decisión del rediseño, `dudas.md` §19 — no es una pérdida de contenido.
    */
    expect(hojas[0].texto).not.toContain('DATOS DE IDENTIFICACIÓN')

    /*
      ⚠ v3 · **EL REPARTO CORRE UNA HOJA HACIA ARRIBA.** Las tres retiradas del encabezado
      —margen, rótulo y ficha— devuelven la declaración a la hoja 2, y la banda de cierre
      con ella a la 3. La 4 y la 5 no se reparten: son `Page` propios.
    */
    expect(contiene(hojas[1], 'DECLARACIÓN DE CONSENTIMIENTO')).toBe(true)
    expect(contiene(hojas[2], 'OTORGAMIENTO')).toBe(true)
    expect(contiene(hojas[3], 'REPRESENTACIÓN')).toBe(true)
    expect(contiene(hojas[3], 'TESTIGOS')).toBe(true)
    expect(contiene(hojas[4], 'ANEXO · IDENTIFICACIÓN DE FIRMANTES')).toBe(true)
    expect(hojas[4].texto).toContain('PÁGINA 5 DE 5')
  }, 200_000)

  it('el pie de sello sale solo en quien firmó, y remite al anexo', async () => {
    const hojas = await componer(COMPLETO)

    /*
      DOS FIRMARON Y TRES NO. Los dos que firmaron llevan su hora; los tres omitidos no llevan
      pie —no firmaron, no hay nada que sellar—. Las dos horas son distintas entre sí, que es
      lo que la evidencia necesita: cinco firmas en el mismo segundo son sospechosas.
    */
    expect(hojas[2].texto).toContain(`Firmado ${SELLO_MEDICO}`)
    expect(hojas[2].texto).toContain(`Firmado ${SELLO_PACIENTE}`)
    expect(hojas[3].texto).not.toContain('Firmado ')

    /*
      Y EL PACIENTE REMITE AL ANEXO PORQUE TIENE FOTOGRAFÍA ALLÍ; el médico no, porque el
      anexo reproduce la identificación de quien CONSIENTE, no la de quien informa.
    */
    const pie = (hoja: Hoja, sello: string): string => {
      const encontrado = hoja.renglones.find((r) => r.texto.startsWith(`Firmado ${sello}`))
      expect(encontrado, `no se encontró el pie de «${sello}»`).toBeDefined()
      return (encontrado as Renglon).texto
    }
    expect(pie(hojas[2], SELLO_PACIENTE)).toContain(
      sinLigadura('con identificación anexa'),
    )
    expect(pie(hojas[2], SELLO_MEDICO)).not.toContain('anexa')

    /*
      ⚠ v3 · **EL PIE CUESTA 10 pt POR CELDA Y NO 11.46.** La cota vieja describía la
      maqueta vieja: la ranura de 2.L declaraba 2 pt de aire propio sobre un renglón de
      `sello.pie` de 9, y las dos calidades se componían en familias distintas, así que la
      diferencia entre líneas base arrastraba los dos ascendentes. En v3 la nota y el sello
      comparten interlineado y la ranura no añade aire: 10 pt clavados, que es el
      interlineado del rol. Lo que la prueba fija sigue siendo lo mismo —que el pie va
      DEBAJO de la calidad y no encima— y ahora con una cifra que se lee de un vistazo.
    */
    const nota = hojas[2].renglones.find((r) => r.texto === 'Nombre y rma')
    expect(nota).toBeDefined()
    const sello = hojas[2].renglones.find((r) =>
      r.texto.startsWith(`Firmado ${SELLO_PACIENTE}`),
    )
    expect(sello).toBeDefined()
    expect((sello as Renglon).arriba - (nota as Renglon).arriba).toBeCloseTo(10, 1)
  }, 200_000)

  it('el bloque de verificación va en la ÚLTIMA hoja, con y sin anexo', async () => {
    const conAnexo = await componer(COMPLETO)
    const sinAnexo = await componer(SIN_ANEXO)

    /*
      ⚠ **NO ES LA HOJA DE FIRMAS: ES LA ÚLTIMA DEL DOCUMENTO.** Con fotografías el documento
      termina en el anexo, así que el bloque baja con él. Un sello que dice que el documento no
      se alteró no puede tener páginas detrás.
    */
    expect(conAnexo).toHaveLength(5)
    expect(sinAnexo).toHaveLength(4)
    expect(conAnexo[4].texto).toContain(`Documento sellado el ${SELLO_DOCUMENTO}`)
    expect(sinAnexo[3].texto).toContain(`Documento sellado el ${SELLO_DOCUMENTO}`)
    // Y en ninguna otra: es un cierre, no una marca de página.
    for (const hoja of conAnexo.slice(0, 4)) {
      expect(hoja.texto).not.toContain('Documento sellado')
    }

    /*
      EL RECUENTO SE HACE SOBRE LAS CELDAS COMPUESTAS. Cinco firmantes, dos con hora: la
      diferencia es lo que responde a la pregunta de por qué hay celdas en blanco.
    */
    expect(conAnexo[4].texto).toContain(
      sinLigadura('5 firmantes previstos, 2 firmaron, 3 omitidos'),
    )
    expect(conAnexo[4].texto).toContain(`Huella SHA-256 · ${HUELLA}`)
    expect(conAnexo[4].texto).toContain(
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
      // v3 · `identificaciones` es una lista REQUERIDA: la ausencia se dice con `[]`.
      identificaciones: [],
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
      // v3 · `identificaciones` es una lista REQUERIDA: la ausencia se dice con `[]`.
      identificaciones: [],
    })

    /*
      LA HOJA ENTERA DESAPARECE. Con los cinco firmantes y sin anexo son cinco hojas —tres de
      secciones, otorgamiento y la de representación y testigos—; sin nadie a quien
      representar ni testigos que firmen, esa quinta no tiene nada que componer y el `break`
      la habría abierto igualmente, numerada y con folio.
    */
    expect(sinNadie).toHaveLength(3)

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
    expect(contiene(sinNadie[2], 'OTORGAMIENTO')).toBe(true)
    expect(contiene(sinNadie[2], 'MÉDICO TRATANTE')).toBe(true)
    expect(contiene(sinNadie[2], 'PACIENTE')).toBe(true)
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
      // v3 · `identificaciones` es una lista REQUERIDA: la ausencia se dice con `[]`.
      identificaciones: [],
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
      // v3 · `identificaciones` es una lista REQUERIDA: la ausencia se dice con `[]`.
      identificaciones: [],
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
    expect(hojas).toHaveLength(5)
  }, 200_000)

  it('el riel son ocho celdas en cuatro filas, sin sexo y con celda base de 28.5', async () => {
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
      ⚠ v3 · **LA CELDA BASE MIDE 28.5 Y NO 33.** Cota reescrita contra la maqueta nueva, no
      defecto: el riel tiene ahora dos calibraciones declaradas en `FICHA` —`chasis` de 27 y
      `declaracion` de 28.5— y este formato es uno de los dos que declaran algo, así que
      toma la segunda. La cifra no se copia: se lee del token, que es donde está derivada
      (2.5 + 9 + 14 + 3). Lo que suma el paso entre filas es la regla que las separa.
    */
    const paso =
      renglon(hoja1, 'FAMILIAR O RESPONSABLE').arriba - renglon(hoja1, 'PACIENTE').arriba
    expect(paso).toBeCloseTo(FICHA.declaracion.base + FILETE.regla, 2)

    /*
      ⚠ v3 · **EL DESTAQUE DEL HOSPITAL SE RETIRA, Y ESTA PRUEBA FIJA QUE NO VUELVA.**

      La cota vieja medía que `Hospital o clínica` compusiera a 12.5 pt contra los 11 de
      `Lugar`, que comparte fila con él —1.317 pt de diferencia entre líneas base—. Era una
      excepción tipográfica escrita dentro de un formato, y el rediseño se lleva por delante
      la familia entera: el riel tiene UNA calibración y todas sus celdas componen su valor
      con el mismo rol. Quien necesite destacar un dato lo hace con la celda, no con el
      cuerpo.

      No es pérdida de contenido: el hospital sigue impreso y sigue rotulado. Lo que se
      comprueba ahora es que las dos celdas de la fila apoyan su valor en la MISMA línea
      base, que es lo que delata que ninguna se salió del rol.
    */
    const destaque =
      renglon(hoja1, HOSPITAL).arriba - renglon(hoja1, 'Mérida, Yucatán').arriba
    expect(destaque).toBeCloseTo(0, 2)
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
    expect(contiene(hojas[2], 'MÉDICO TRATANTE')).toBe(true)
    expect(contiene(hojas[2], 'Ced. Prof. 7000001 · Ced. Esp. 8000002')).toBe(true)
    expect(hojas[2].texto).not.toContain('TESTIGO 1')

    // Niveles 2 y 3 en la hoja 5, con el parentesco colgando solo del familiar.
    expect(contiene(hojas[3], 'FAMILIAR O RESPONSABLE')).toBe(true)
    expect(contiene(hojas[3], 'PARENTESCO CON EL PACIENTE')).toBe(true)
    expect(contiene(hojas[3], 'TESTIGO 1')).toBe(true)
    expect(contiene(hojas[3], 'TESTIGO 2')).toBe(true)

    /*
      LOS TRES NIVELES VAN NUMERADOS 1, 2 Y 3, y el 3 solo aparece en la hoja 5. Es lo que
      distingue esta retícula de una de seis firmas seguidas: la jerarquía es del documento,
      no del hueco que quede.
    */
    expect(contiene(hojas[2], 'OTORGAMIENTO')).toBe(true)
    expect(contiene(hojas[3], 'REPRESENTACIÓN')).toBe(true)
    expect(contiene(hojas[3], 'TESTIGOS')).toBe(true)
  }, 200_000)

  it('por sustitución desaparece el nivel 2 y Testigos se renumera a 2', async () => {
    const hojas = await componer(SUSTITUCION)

    /*
      SUSTITUCIÓN Y NO ADICIÓN: el familiar firma en el nivel 1, en la celda del paciente, y
      el nivel de Representación deja de existir. El de Testigos pasa de 3 a 2.
    */
    expect(hojas[3].texto).not.toContain('REPRESENTACIÓN')
    expect(contiene(hojas[3], 'TESTIGOS')).toBe(true)
    expect(contiene(hojas[2], 'OTORGAMIENTO')).toBe(true)

    // El familiar sube al nivel 1, con su parentesco, y ya no está en la hoja 5.
    expect(contiene(hojas[2], 'FAMILIAR O RESPONSABLE')).toBe(true)
    expect(contiene(hojas[2], 'PARENTESCO CON EL PACIENTE')).toBe(true)
    expect(hojas[3].texto).not.toContain('PARENTESCO CON EL PACIENTE')

    // El número del nivel de testigos es el 2, y en la hoja 5 no hay ningún 3.
    const numeros = hojas[3].renglones.filter((r) => r.texto === '3')
    expect(numeros).toHaveLength(0)
  }, 200_000)

  /**
   * ⚠ **COTA REESCRITA: LO QUE RETIRA LA HOJA NO ES LA FOTOGRAFÍA, SON LOS DATOS.**
   *
   * La vieja fijaba que un anexo sin ninguna fotografía no compusiera hoja, y describía la
   * maqueta vieja. En v3 el recuadro sin imagen compone **su leyenda de ausencia y sus dos
   * datos** —tipo y número del documento—, que es contenido de identificación y no un
   * hueco: lo que falta es la imagen, no el dato. Retirar la hoja por eso borraría del
   * papel el número de la credencial con la que se identificó quien firmó.
   *
   * La hoja desaparece cuando no hay identificaciones que reproducir, y entonces el bloque
   * de sellado baja a la que quede última — que es la otra mitad de esta prueba.
   */
  it('el anexo desaparece sin identificaciones, no sin fotografías', async () => {
    const conFotos = await componer(COMPLETO)
    const sinFotos = await componer(SIN_FOTOGRAFIAS)
    const sinAnexo = await componer(SIN_ANEXO)

    expect(conFotos).toHaveLength(5)
    expect(sinFotos).toHaveLength(5)
    expect(contiene(sinFotos[4], 'ANEXO · IDENTIFICACIÓN DE FIRMANTES')).toBe(true)
    expect(contiene(sinFotos[4], 'No se capturó fotografía')).toBe(true)
    expect(contiene(sinFotos[4], 'BUOR010412MYN04')).toBe(true)

    expect(sinAnexo).toHaveLength(4)
    for (const hoja of sinAnexo) {
      expect(hoja.texto).not.toContain('ANEXO · IDENTIFICACIÓN DE FIRMANTES')
    }
    expect(sinAnexo[3].texto).toContain('PÁGINA 4 DE 4')
  }, 200_000)

  it('el anexo imprime el tipo y el número haya foto o no', async () => {
    const [, , , , anexo] = await componer(COMPLETO)

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

  /**
   * ⚠ **LOS TRES ESPACIADORES YA NO EXISTEN, Y ESTA PRUEBA FIJA QUE NO VUELVAN.**
   *
   * La cota vieja medía 26, 12 y 20 pt de espaciador según lo que la hoja llevara debajo
   * —texto corrido, firmas o anexo—, y era la misma familia de calibración por lámina que
   * el rediseño retira entera: la cabecera de continuación no puede saber qué viene
   * detrás, y cuando se le decía por prop, la hoja intermedia de una lista mentía.
   *
   * v3 compone UNA cabecera de continuación de altura fija para las nueve hojas de los
   * nueve formatos. Lo que se comprueba es justo eso: que las cuatro hojas de continuación
   * de este documento —dos del cuerpo, la de firmas y la de anexo, que son las tres
   * variantes de la cota vieja— apoyan su línea de paciente en la MISMA cota.
   */
  it('las hojas de continuación comparten una sola cabecera', async () => {
    const hojas = await componer(COMPLETO)

    const linea = (hoja: Hoja): number =>
      hoja.renglones.filter((r) => r.texto.startsWith('Paciente · '))[0].arriba

    for (const hoja of hojas.slice(2)) {
      expect(linea(hoja)).toBeCloseTo(linea(hojas[1]), 2)
    }
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
      hojas.some((hoja) =>
        hoja.rectangulos.some(
          (r) => (r.ancho === 5 && r.alto === 5) || (r.ancho === 9 && r.alto === 9),
        ),
      )

    /*
      ⚠ **SE BUSCA EN EL DOCUMENTO ENTERO Y NO EN UNA HOJA FIJA**, que es lo que hacía la
      cota vieja. Estas tres frases viajan con la declaración, y en qué hoja cae la
      declaración depende de cuánto ocupen las siete secciones: anclarlo a `hojas[2]`
      convertía cualquier cambio de longitud del texto clínico en una prueba roja que no
      dice nada sobre las casillas, que es lo único que aquí se vigila.
    */
    const todo = (hojas: Hoja[]): string => hojas.map((hoja) => hoja.texto).join('')

    expect(todo(sustituido)).toContain('El paciente no puede')
    expect(todo(normal)).not.toContain('El paciente no puede')
    expect(casilla(normal)).toBe(false)
    expect(casilla(sustituido)).toBe(false)
  }, 200_000)

  it('las autorizaciones tampoco llevan casilla: la frase o nada', async () => {
    // El caso más cargado de los tres: la pila entera, con sus tres declaraciones.
    const hojas = await componer({
      ...SUSTITUCION,
      // v3 · el tri-estado es `boolean | undefined`: la negativa expresa es `false`.
      autorizaTransfusion: false,
      autorizaFotos: true,
    })
    const todo = hojas.map((hoja) => hoja.texto).join('')

    expect(todo).toContain('El paciente no puede')
    expect(todo).toContain(sinLigadura('NO autorizo la transfusión'))
    expect(todo).toContain(sinLigadura('Autorizo la toma de fotografías'))
    expect(
      hojas.some((hoja) =>
        hoja.rectangulos.some(
          (r) => (r.ancho === 5 && r.alto === 5) || (r.ancho === 9 && r.alto === 9),
        ),
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
      const hojas = await componer({ ...COMPLETO, autorizaTransfusion: true })
      expect(
        hojas.map((hoja) => hoja.texto).join(''),
      ).toContain(sinLigadura('Autorizo la transfusión de sangre'))
    }, 200_000)

    /**
     * La negativa EXPRESA es el dato con más valor legal de los dos, y es justo el que un
     * booleano habría perdido: con `boolean`, «no se preguntó» y «el paciente lo rechazó»
     * se compondrían igual, sin línea. Por eso el campo es tri-estado.
     */
    it('la transfusión RECHAZADA se compone, y dice que se rechazó', async () => {
      const hojas = await componer({ ...COMPLETO, autorizaTransfusion: false })
      const todo = hojas.map((hoja) => hoja.texto).join('')
      expect(todo).toContain(sinLigadura('NO autorizo la transfusión'))
      expect(todo).toContain('asumiendo los riesgos')
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

      expect(
        con.map((hoja) => hoja.texto).join(''),
      ).toContain(sinLigadura('Autorizo la toma de fotografías'))
      for (const hoja of sin) {
        expect(hoja.texto).not.toContain(sinLigadura('fotografías clínicas'))
      }
    }, 200_000)

    it('las dos autorizaciones colapsan por separado', async () => {
      const hojas = await componer({
        ...COMPLETO,
        autorizaTransfusion: true,
        autorizaFotos: false,
      })
      const todo = hojas.map((hoja) => hoja.texto).join('')
      expect(todo).toContain(sinLigadura('Autorizo la transfusión de sangre'))
      expect(todo).not.toContain(sinLigadura('fotografías clínicas'))
    }, 200_000)
  })

  /**
   * ⚠ LA ALTERNANCIA DE RÓTULO SE RETIRÓ, Y ESTA PRUEBA FIJA QUE NO VUELVA SOLA.
   *
   * `representanteLegal` alternaba la celda entre `Familiar o responsable` y `Representante
   * legal`, y nadie la alimentaba: el formulario tiene UN campo, rotulado `Familiar
   * responsable o representante legal`, que cubre las dos calidades sin distinguirlas.
   *
   * Se justificó en su día diciendo que «v1 ya lo distinguía y v2 lo había perdido».
   * **v1 tiene la rama y tampoco la ejerce**: la enciende `data.representante`
   * (`ConsentimientoInformadoPdf.tsx:855`), que es el NOMBRE del representante —no un
   * booleano— y el formulario no lo pasa nunca. Los dos renderizadores imprimen siempre lo
   * mismo, así que retirarlo no cambia ni un papel.
   */
  it('la celda del acompañante lleva SIEMPRE el mismo rótulo', async () => {
    const hojas = await componer(COMPLETO)
    expect(contiene(hojas[3], 'FAMILIAR O RESPONSABLE')).toBe(true)
    expect(hojas[3].texto).not.toContain('REPRESENTANTE LEGAL')
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
