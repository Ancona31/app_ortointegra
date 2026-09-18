/**
 * II.8 · Escrito Médico — **la prueba que mide el PDF real**.
 *
 * POR QUÉ EXISTE, Y POR QUÉ MIDE EN VEZ DE COMPARAR TOKENS
 *
 * El encabezado de un formato no es una constante: es la suma de sus bloques. Aquí se
 * renderiza el PDF, se leen las coordenadas de su flujo de contenido y se mide. El lector
 * sale entero de `solicitudInternamiento.test.ts`.
 *
 * LO QUE ESTA PRUEBA VIGILA Y NINGUNA OTRA PUEDE
 *
 * **Los cuatro estados del título.** Es el único formato cuyo título lo escribe el médico,
 * así que lo que hay que fijar no es una cadena sino un COMPORTAMIENTO: que envuelva sin
 * recortarse, que cada renglón extra cueste 20 pt, y que **sin título el bloque siga midiendo
 * 20 y no cero**, que es donde la regla 4 de 2.C dice lo contrario que su lámina.
 *
 * **Que la fecha se alinee con la PRIMERA línea del título.** Con tres renglones es lo único
 * que puede fallar en silencio: alinearse con la última o con el centro se ve raro pero no
 * lanza nada.
 *
 * **Que no haya folio en ninguna parte.** Es el único formato sin él, y el único cuyo pie
 * lleva el nombre del documento en el centro con recorte por elipsis.
 */

import { describe, it, expect } from 'vitest'
import zlib from 'node:zlib'
import path from 'node:path'
import React from 'react'
import { Document, Font, renderToBuffer } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import EscritoMedico, {
  type EscritoMedicoProps,
} from '@/lib/pdf/v2/formatos/EscritoMedico'
import {
  FILETE,
  FIRMA,
  ESPACIO,
  MARGEN,
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
      // La única itálica del sistema, y la carga este formato. Ver `fonts.ts`.
      { src: ruta('IBMPlexSans-Italic.ttf'), fontWeight: 400, fontStyle: 'italic' },
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
  /**
   * Cuántos TRAZOS cierra la hoja — operadores `S` del flujo.
   *
   * Existe por el subrayado, y por una razón que costó descubrir: react-pdf **no compone
   * `textDecoration` como un rectángulo relleno** sino como una trayectoria trazada
   * (`m … l … S`), así que contando `rectangulos` un párrafo subrayado y otro sin subrayar
   * salen idénticos. Medido sobre el flujo de los dos.
   */
  readonly trazos: number
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
    // `S` como palabra suelta: el operador de trazado. Ver `Hoja.trazos`.
    const trazos = (contenido.match(/(?:^|\s)S(?=\s|$)/g) ?? []).length
    return { texto, cuerpos, renglones, rectangulos, trazos }
  })
}

// ─── Los datos, inventados y compartidos ─────────────────────────────────────

const acento = resolverAcento(ACENTO_BASE_POR_DEFECTO)

/**
 * ⚠ Ninguna cadena de anclaje lleva la secuencia `fi` en MINÚSCULA: react-pdf incrusta la
 * ligadura como un glifo propio y su `ToUnicode` no la descompone.
 */
const CORTO = 'Certificado médico'
const LARGO =
  'Constancia de atención médica y valoración ortopédica para trámite escolar ante la Secretaría de Educación'
const TITULO_PIE = 'Constancia de atención médica'
const FECHA = '4 ago 2026'
const MEDICO = 'Dra. Elena Marin Solis'
const CEDULAS = 'Ced. Prof. 7000001 · Ced. Esp. 8000002'

/**
 * ⚠ **EL CUERPO SE DUPLICA PARA QUE EL DOCUMENTO VUELVA A PARTIR.**
 *
 * Con la tipografía de v3 —`texto.corrido` de 11.5/18 a 10.5/15, encabezado de 91.6 pt en
 * vez de 160— el cuerpo de v2 cabe entero en una hoja y las cuatro pruebas que miden la
 * hoja de CONTINUACIÓN se quedaban sin hoja 2. El caso se repite hasta que vuelve a
 * desbordar: lo que ejercita son los seis nodos y el reparto, no su longitud.
 */
const CUERPO_BASE: EscritoMedicoProps['cuerpo'] = [
  {
    tipo: 'parrafo',
    tramos: [
      { texto: 'A quien corresponda: por medio del presente hago constar que ' },
      { texto: 'Renata Bustamante Oceguera', negrita: true },
      {
        texto:
          ', de 25 años de edad, acudió a consulta en este consultorio el día 4 de agosto de 2026 por dolor lumbar de tres semanas de evolución.',
      },
    ],
  },
  { tipo: 'encabezado1', texto: 'Valoración' },
  {
    tipo: 'parrafo',
    tramos: [
      {
        texto:
          'A la exploración física se encuentra contractura paravertebral bilateral, sin déficit neurológico ni datos de radiculopatía. La maniobra de Lasègue resulta ',
      },
      { texto: 'negativa', cursiva: true },
      { texto: ' de forma bilateral.' },
    ],
  },
  { tipo: 'encabezado2', texto: 'Estudios revisados' },
  {
    tipo: 'lista',
    marca: 'vineta',
    items: [
      [{ texto: 'Radiografía simple de columna lumbar en dos proyecciones.' }],
      [{ texto: 'Biometría hemática completa dentro de parámetros normales.' }],
      [
        {
          texto:
            'Resonancia magnética de columna lumbosacra, sin evidencia de hernia discal ni compromiso radicular.',
        },
      ],
    ],
  },
  { tipo: 'encabezado1', texto: 'Indicaciones' },
  {
    tipo: 'lista',
    marca: 'numero',
    items: [
      [{ texto: 'Reposo relativo durante siete días, sin reposo absoluto en cama.' }],
      [{ texto: 'Analgesia con paracetamol de 1 g cada ocho horas por cinco días.' }],
      [{ texto: 'Aplicación de calor local veinte minutos, dos veces al día.' }],
      [{ texto: 'Inicio de fisioterapia dirigida a partir de la segunda semana.' }],
    ],
  },
  { tipo: 'separador' },
  {
    tipo: 'cita',
    tramos: [
      {
        texto:
          'Se recomienda evitar el levantamiento de cargas superiores a cinco kilogramos y la permanencia sentada por más de una hora sin pausa durante las próximas cuatro semanas.',
      },
    ],
  },
  {
    tipo: 'parrafo',
    tramos: [
      {
        texto:
          'Se extiende la presente constancia a petición de la interesada, para los fines legales y administrativos que estime convenientes, sin que ello implique valoración de aptitud laboral ni certificación de incapacidad.',
      },
    ],
  },
]

/** El mismo cuerpo dos veces: la segunda copia es la que empuja a la hoja 2. */
const CUERPO: EscritoMedicoProps['cuerpo'] = [...CUERPO_BASE, ...CUERPO_BASE]

const BASE: EscritoMedicoProps = {
  medico: {
    nombre: MEDICO,
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
  asunto: CORTO,
  fecha: FECHA,
  cuerpo: CUERPO,
}

/** Tres renglones de título, y un nombre corto propio para la banda de pie. */
const CON_TITULO_LARGO: EscritoMedicoProps = {
  ...BASE,
  asunto: LARGO,
  tituloPie: TITULO_PIE,
}

/** Sin título: el bloque deja 20 pt con la fecha sola y conserva su filete. */
const SIN_TITULO: EscritoMedicoProps = { ...BASE, asunto: undefined }

/** Un `Document` con un solo `Page`, que es lo que ocurre en emisión real. */
async function componer(props: EscritoMedicoProps): Promise<Hoja[]> {
  return leer(await renderToBuffer(h<DocumentProps>(Document, {}, h(EscritoMedico, props))))
}

/**
 * react-pdf sitúa la línea base a `ascendente × cuerpo` del borde superior de la caja de
 * línea. **El ascendente es de la FAMILIA**: Archivo declara 878 / 1000 em e IBM Plex Sans
 * 1025 / 1000. Medido sobre el PDF.
 */
const ASCENDENTE_ARCHIVO = 878 / 1000
const ASCENDENTE_PLEX = 1025 / 1000

function renglon(hoja: Hoja, texto: string): Renglon {
  const encontrado = hoja.renglones.find((r) => r.texto === texto)
  expect(encontrado, `no se encontró el renglón «${texto}»`).toBeDefined()
  return encontrado as Renglon
}

/** El primer renglón que empieza por este texto. Para los que el ancho parte. */
function empiezaPor(hoja: Hoja, texto: string): Renglon {
  const encontrado = hoja.renglones.find((r) => r.texto.startsWith(texto))
  expect(encontrado, `no se encontró un renglón que empiece por «${texto}»`).toBeDefined()
  return encontrado as Renglon
}

/**
 * Del margen de 54 al borde superior del cuerpo. Se mide desde la línea base del primer
 * párrafo restando lo único que hay en medio: el ascendente de la humanista.
 */
function encabezado(hoja: Hoja): number {
  return (
    empiezaPor(hoja, 'A quien corresponda').arriba -
    54 -
    ASCENDENTE_PLEX * TIPOGRAFIA['texto.corrido'].cuerpo
  )
}

describe('II.8 · Escrito Médico', () => {
  it('el encabezado mide 91.6 pt, el menor del sistema', async () => {
    const [hoja1] = await componer(BASE)

    /*
      ⚠ **ERAN 160 pt Y SON 91.6, Y SIGUE SIENDO EL MENOR DEL SISTEMA.**

      v2 lo medía contra los 165.22 de la lámina y explicaba la diferencia con dos
      residuos —2.85 del panel y 2.37 del *strut* del bloque de título—. En v3 el panel
      mide 40, el nombre del médico 15, la banda de dirección es de un renglón y el
      rótulo del documento 15, así que la cota de la lámina deja de ser el objetivo.

      Este formato es el que menos compone —sin folio, sin ficha de paciente— y por eso
      es el que dice si el chasis se sostiene solo: 91.6 pt contra los 178.5 de los
      cuatro con ficha.
    */
    expect(encabezado(hoja1)).toBeCloseTo(91.6, 1)
  }, 200_000)

  it('el título envuelve a DOS renglones y se recorta con elipsis', async () => {
    const [corto] = await componer(BASE)
    const [largo] = await componer(CON_TITULO_LARGO)

    /*
      ⚠⚠ **LA COTA SE INVIERTE: v3 RECORTA EL TÍTULO Y v2 NO.**

      v2 dejaba crecer el título a tres renglones —20 pt cada uno, 40 de más— y componía
      la cadena entera. v3 le pone `maxLines: 2` + elipsis (brief 00 §4), que es lo que
      cierra dos defectos a la vez: el **§5.1 de este formato**, con un título de 104
      caracteres a cuatro renglones, y el **§7 de la Denegación**, cuyo título de dos
      renglones la echaba de su hoja única.

      **Lo que se pierde, y hay que decirlo:** el final de un asunto muy largo no se lee
      en la cabecera. No se pierde del documento — el pie compone `tituloPie`, que es un
      campo aparte y no un truncado, y la prueba de más abajo lo fija.
    */
    expect(largo.texto).toContain('CONSTANCIA DE ATENCIÓN MÉDICA Y')
    expect(largo.texto).not.toContain('SECRETARÍA DE EDUCACIÓN')
    expect(largo.texto).toContain('…')

    /*
      UN RENGLÓN MÁS SON 18 pt MÁS —el interlineado de `titulo.documento`—, y con eso se
      acaba: el tercero ya no existe. Es lo que hace que un título largo no necesite
      ninguna regla especial ni pueda comerse la hoja.
    */
    /*
      **14 pt, y no los 18 del interlineado.** La fila de título mide lo que mide su celda
      más alta, y con un renglón esa celda es la de EMISIÓN —rótulo 9 + valor 13 = 22—, no
      el título de 18. El segundo renglón lleva el título a 36 y a partir de ahí manda él:
      36 − 22 = 14. Es la cuenta de 2.C y no un residuo.
    */
    const celdaEmision =
      (TIPOGRAFIA.etiqueta.interlineado ?? 9) + (TIPOGRAFIA['titulo.valor'].interlineado ?? 13)
    const dosRenglones = 2 * (TIPOGRAFIA['titulo.documento'].interlineado ?? 18)
    expect(encabezado(largo) - encabezado(corto)).toBeCloseTo(dosRenglones - celdaEmision, 1)
  }, 200_000)

  it('la fecha se alinea con la PRIMERA línea del título, tenga las que tenga', async () => {
    const [corto] = await componer(BASE)
    const [largo] = await componer(CON_TITULO_LARGO)

    /*
      LA REGLA 3 DE 2.C, MEDIDA EN EL CASO QUE LA PUEDE ROMPER.

      ⚠ **SON 5.049 pt Y ERAN 1.976, y la cuenta es OTRA porque la fila es otra.** En v2
      las dos cajas se apoyaban por su borde inferior; en v3 la fila de título alinea por
      ARRIBA (`alignItems: 'flex-start'`, ver 2.C) y la celda de emisión compone su rótulo
      encima del valor. Así que lo que separa las dos bases es el renglón del rótulo menos
      lo que la base sube al crecer el cuerpo del título:

          9 + 0.878 × (10.5 − 15) = 5.049

      Lo que se comprueba no cambia: que **no crece con dos renglones de título**. Si la
      fecha se alineara con la última línea, aquí saldrían 23.
    */
    const desfase =
      (TIPOGRAFIA.etiqueta.interlineado ?? 9) +
      ASCENDENTE_ARCHIVO *
        (TIPOGRAFIA['titulo.valor'].cuerpo - TIPOGRAFIA['titulo.documento'].cuerpo)
    expect(desfase).toBeCloseTo(5.049, 2)

    expect(
      empiezaPor(corto, '4 ').arriba - renglon(corto, 'CERTIFICADO MÉDICO').arriba,
    ).toBeCloseTo(desfase, 2)
    expect(
      empiezaPor(largo, '4 ').arriba - empiezaPor(largo, 'CONSTANCIA').arriba,
    ).toBeCloseTo(desfase, 2)
  }, 200_000)

  it('sin título el bloque deja 20 pt, NO cero, y conserva su filete', async () => {
    const [corto] = await componer(BASE)
    const [sin] = await componer(SIN_TITULO)

    /*
      ⚠ **LA REGLA 4 DE 2.C DICE QUE LA VARIANTE `ausente` COLAPSA ENTERA Y ESTA LÁMINA NO.**
      Si colapsara, el cuerpo subiría 20 pt —el renglón del título— más 5 y 2.5 del filete.
      Sale a la MISMA altura que con título: el bloque conserva su hueco y su filete, y la
      fecha sigue teniendo dónde apoyarse. Reportado.
    */
    expect(encabezado(sin)).toBeCloseTo(encabezado(corto), 1)
    expect(sin.texto).not.toContain('CERTIFICADO MÉDICO')

    // Y la fecha sigue exactamente donde estaba, ahora sola y a la derecha.
    expect(empiezaPor(sin, '4 ').arriba).toBeCloseTo(empiezaPor(corto, '4 ').arriba, 2)
    expect(empiezaPor(sin, '4 ').x).toBeCloseTo(empiezaPor(corto, '4 ').x, 1)
  }, 200_000)

  it('`tituloPie` es un campo aparte, no un truncado del título', async () => {
    const hojas = await componer(CON_TITULO_LARGO)

    /*
      `CONCILIA D41`. El encabezado imprime la constancia entera y el rótulo de continuación
      imprime el nombre corto. Si fuera un truncado automático, el rótulo diría
      `Constancia de atención médica y valo…`.

      ⚠ **LA BANDA DE PIE YA NO LO IMPRIME.** Repetía el nombre del documento en todas las
      hojas y con uno largo empujaba la leyenda fuera de la banda de 16 pt. El nombre vive
      donde sirve: entero en la hoja 1 y en el rótulo de cada continuación, que es lo que
      permite atribuir una hoja suelta.
    */
    /*
      ⚠ v3 · el encabezado RECORTA el título con elipsis, así que la constancia entera ya
      no está en la hoja 1. Lo que esta prueba defiende sigue en pie y es lo que importa:
      que `tituloPie` sea un CAMPO APARTE y no un truncado automático del título.
    */
    expect(hojas[0].texto).toContain('CONSTANCIA DE ATENCIÓN MÉDICA Y')
    expect(hojas[0].texto).not.toContain('SECRETARÍA DE EDUCACIÓN')
    /*
      ⚠⚠ **DÓNDE SE LEE EL NOMBRE CORTO CAMBIA DE SITIO EN v3.**

      v2 lo componía en el rótulo de continuación y NO en la banda de pie. v3 hace lo
      contrario: 2.V compone el rótulo con el `titulo` que recibe —el asunto, recortado
      como en la hoja 1— y **es la banda de pie la que lleva el nombre corto**, en su zona
      de nombre del documento, que es nueva.

      Lo que la cota defiende no cambia y se comprueba igual de bien: que `tituloPie` sea
      un CAMPO APARTE y no un truncado automático del título. Si lo fuera, el pie diría
      `Constancia de atención médica y valo…` en vez del nombre que el médico eligió.
    */
    for (const hoja of hojas) {
      expect(hoja.texto).toContain(TITULO_PIE)
      expect(hoja.texto).toContain('Documento generado por Spinus')
    }
  }, 200_000)

  it('sin título y sin nombre, el rótulo de continuación cae al genérico', async () => {
    const [, hoja2] = await componer(SIN_TITULO)

    /*
      La cascada: `tituloPie`, el título del encabezado, y `Escrito médico`. Se comprueba en
      la hoja 2 y no en la 1 porque el nombre solo se compone donde hace falta —el rótulo de
      continuación—, desde que la banda de pie dejó de repetirlo.
    */
    expect(hoja2.texto).toContain('ESCRITO MÉDICO · CONTINUACIÓN')
  }, 200_000)

  it('ningún folio en ninguna hoja, y el pie con sus dos zonas', async () => {
    const hojas = await componer(BASE)

    /*
      **ES EL ÚNICO FORMATO SIN FOLIO Y SIN QR.** No es un documento seriado: es una hoja
      membretada multiuso. Sin folio no hay identificador humano que mostrar en una página de
      verificación, y por eso tampoco lleva código.
    */
    for (const hoja of hojas) {
      expect(hoja.texto).not.toContain('FOLIO')
      expect(hoja.texto).not.toContain('Folio ')
      expect(hoja.texto).not.toContain('VERIFICACIÓN')
    }

    /*
      LAS DOS ZONAS EN SU ORDEN: paginación a la izquierda y leyenda a la derecha.

      ⚠⚠ **v3 · SON TRES ZONAS Y EL NOMBRE DEL DOCUMENTO VUELVE, EN MEDIO.**

      v2 lo había retirado porque un nombre largo empujaba la leyenda fuera de la banda de
      16 pt. v3 lo repone con **ancho declarado y recorte por elipsis** (`PIE.documento`),
      que es lo que hace que no pueda volver a empujar nada: el nombre se recorta, la
      leyenda no. Es lo que permite atribuir una hoja suelta de un formato sin folio.
    */
    const pagina = renglon(hojas[0], 'PÁGINA 1 DE 2')
    /*
      ⚠ `Certificado` llega al extractor como `Certicado`: react-pdf incrusta la LIGADURA
      `fi` como glifo propio y su `ToUnicode` no la descompone. Se sondea por el prefijo.
    */
    const documento = empiezaPor(hojas[0], 'Cert')
    const leyenda = empiezaPor(hojas[0], 'Documento generado por Spinus')
    expect(pagina.x).toBeLessThan(documento.x)
    expect(documento.x).toBeLessThan(leyenda.x)
  }, 200_000)

  it('la hoja de continuación se identifica con tres datos y sin paciente', async () => {
    const hojas = await componer(BASE)
    expect(hojas.length).toBeGreaterThan(1)
    const [, hoja2] = hojas

    /*
      SIN FOLIO Y SIN PACIENTE, lo que ata la hoja 2 a la 1 son tres cosas, y las tres están:
      el título en el rótulo, el médico con SUS DOS CÉDULAS bajo el filete, y la fecha en el
      riel derecho —**rotulada `Emisión`**, que es el segundo tratamiento de la misma fecha
      dentro del formato (`D40`, reportado).
    */
    expect(hoja2.texto).toContain(`${CORTO.toUpperCase()} · CONTINUACIÓN`)
    expect(hoja2.texto).toContain(MEDICO)
    expect(hoja2.texto).toContain(CEDULAS)
    expect(hoja2.texto).toContain('EMISIÓN')

    // Y NO hay línea de paciente: este formato no tiene paciente que poner.
    expect(hoja2.texto).not.toContain('Paciente · ')

    /*
      ⚠ **MIDE 41.47 pt Y MEDÍA 57.5: la cabecera de continuación se cierra en v3.**

      v2 la componía por formato y aquí pesaba 57.5 —rótulo y nombre a 29, aire de 8,
      filete de 2.5, aire de 6 y la línea de cédulas de 12— contra los 54.5 de la lámina.
      v3 la resuelve **una sola vez para los nueve formatos, en 37 pt de cabecera**: los
      41.47 de aquí son esos 37 más lo que la línea de crédito baja dentro de su caja.

      Lo que la cota defiende no cambia: que la hoja 2 se identifique sola y que la
      cabecera no crezca por formato. Si esta cifra se separa de la de los otros ocho,
      alguien volvió a componer la continuación dentro de un formato.
    */
    const finDeLaCabecera =
      renglon(hoja2, CEDULAS).arriba -
      ASCENDENTE_ARCHIVO * TIPOGRAFIA['medico.credencial'].cuerpo +
      12
    // El margen se lee del token: escrito a mano dejó de valer al igualar los cuatro.
    expect(finDeLaCabecera - MARGEN.superior).toBeCloseTo(41.47, 1)
  }, 200_000)

  it('el cuerpo compone sus seis nodos, con las marcas de lista en su eje', async () => {
    const hojas = await componer(BASE)
    const todo = hojas.map((h) => h.texto).join('\n')

    /*
      ⚠ **LOS ENCABEZADOS CONSERVAN LA CAJA QUE ESCRIBIÓ EL MÉDICO, y v2 los subía a
      mayúsculas.** Es el único formato cuyo cuerpo sale de un editor de texto rico: lo
      que va en un `encabezado1` lo teclea el médico, y componerlo en versalita altera su
      texto. Los rótulos que el SISTEMA redacta —el del documento, el de la lista, los de
      la ficha— siguen en versalita; éstos no son del sistema.
    */
    expect(todo).toContain('Valoración')
    expect(todo).toContain('Estudios revisados')
    expect(todo).toContain('Indicaciones')

    // Lista con viñeta: la raya del sistema, en la neo-grotesca (noveno caso de `D30`).
    // Con el cuerpo repetido la lista puede caer en cualquiera de las dos hojas.
    const rayas = hojas.flatMap((h) => h.renglones).filter((r) => r.texto === '—')
    expect(rayas.length).toBeGreaterThan(0)

    /*
      LISTA NUMERADA: `1.` a `4.`, y **las cuatro marcas comparten eje**. El riel va alineado
      a la DERECHA, así que lo que coincide es dónde acaban, no dónde empiezan — con dos
      cifras el texto del ítem no se desplaza.
    */
    const numeros = hojas
      .flatMap((h) => h.renglones)
      .filter((r) => /^\d+\.$/.test(r.texto))
    expect(numeros.length).toBeGreaterThanOrEqual(4)

    // La cita, que sigue componiéndose con su filete izquierdo.
    expect(todo).toContain('Se recomienda evitar el levantamiento de cargas')

    /*
      ⚠ **EL SEPARADOR SE MIDE POR EL HUECO QUE ABRE, NO COMO RECTÁNGULO.**

      v2 lo componía como una caja rellena de 486 × 0.5 y por eso salía en el flujo como
      un `re`; v3 lo compone como `borderTop` de un `View` vacío, y un borde lo dibuja el
      renderer como trazo: **no aparece entre los rectángulos y no se puede contar**. Lo
      que sí se ve es su efecto —`marginVertical: espacio.12` arriba y abajo—, así que se
      mide el hueco entre el último renglón antes y el primero después.
    */
    const conCita = hojas.find((h) =>
      h.renglones.some((r) => r.texto.startsWith('Se recomienda evitar')),
    )
    expect(conCita).toBeDefined()
    const antes = conCita!.renglones.filter((r) => /^\d+\.$/.test(r.texto))
    const cita = empiezaPor(conCita!, 'Se recomienda evitar')
    const ultimaMarca = Math.max(...antes.map((r) => r.arriba))
    // Dos aires de 12 más el renglón de la instrucción: el separador está y pesa.
    expect(cita.arriba - ultimaMarca).toBeGreaterThan(2 * ESPACIO[12])

    // Negrita y cursiva: los dos tramos salen como piezas propias del párrafo.
    expect(todo).toContain('Renata Bustamante Oceguera')
    expect(todo).toContain('negativa')
  }, 200_000)

  it('la firma va sola, a la izquierda, y con el rótulo de la lámina', async () => {
    const hojas = await componer(BASE)
    const ultima = hojas[hojas.length - 1]

    /*
      ⚠ v3 · **la celda del médico va SIN rótulo** (brief 00 §6.1): quien firma lo dicen su
      nombre y sus cédulas. `FIRMA Y SELLO DEL MÉDICO` desaparece del papel en los nueve
      formatos, así que la cota pasa a ser dónde abre la celda.
    */
    expect(ultima.texto).not.toContain('FIRMA Y SELLO DEL MÉDICO')
    const nombresFirma = ultima.renglones.filter((r) => r.texto === MEDICO)
    expect(nombresFirma[nombresFirma.length - 1].x).toBeCloseTo(MARGEN.izquierdo, 1)

    /*
      LA COMPOSICIÓN DE 2.L SIN ROL: `altoBloqueFirma(false)` = 72.75, y era 118.75 con la
      de v2. Bajan las tres partes —el hueco de la rúbrica de 61.6 a 44, el nombre de
      11.5/16 a 10.5/14 y la credencial de 7.5/11 a 7/10— y se va el renglón del rol.

      Lo que se mide es la distancia de la línea de firma al nombre, que es lo único que
      el extractor da: el hueco, el filete y el aire que los separan.
    */
    const saltoFirma =
      FIRMA.espacio + FILETE.firma + ESPACIO[4] + ASCENDENTE_ARCHIVO * TIPOGRAFIA['firma.nombre'].cuerpo
    expect(saltoFirma).toBeCloseTo(44 + 0.75 + 4 + 0.878 * 10.5, 2)
  }, 200_000)

  /**
   * LO QUE EL EDITOR PRODUCE Y EL FORMATO NO SABÍA COMPONER.
   *
   * El chasis se midió contra las láminas y nadie comprobó el otro extremo: que el formato
   * pudiera componer lo que el editor del médico genera. Faltaban dos cosas de su barra
   * —el subrayado y las cuatro alineaciones— y sin ellas se habrían perdido en silencio al
   * encender v2. La traducción vive en `v2/cuerpoEscrito.ts` y se prueba aparte; esto mide
   * que lleguen **al papel**.
   */
  describe('el marcado de la barra del editor llega al papel', () => {
    /** Un texto sin `fi`: la ligadura rompe el anclaje del lector. Ver `sinLigadura`. */
    const SUBRAYADO = 'texto subrayado del editor'

    it('el subrayado dibuja su línea, y no es solo un cambio de peso', async () => {
      const marcado = await componer({
        ...BASE,
        cuerpo: [{ tipo: 'parrafo', tramos: [{ texto: SUBRAYADO, subrayado: true }] }],
      })
      const plano = await componer({
        ...BASE,
        cuerpo: [{ tipo: 'parrafo', tramos: [{ texto: SUBRAYADO }] }],
      })

      expect(marcado[0].texto).toContain(SUBRAYADO)

      /*
        ⚠ SE MIDEN TRAZOS Y NO RECTÁNGULOS. react-pdf compone `textDecoration` como una
        trayectoria TRAZADA —`m … l … S`— y no como un rectángulo relleno, así que contando
        `rectangulos` los dos párrafos salen idénticos y la prueba pasaría sin subrayado
        alguno. Verificado sobre el flujo de los dos PDF.

        Se compara contra el plano y no contra una cifra absoluta: así los filetes del
        chasis, que están en las dos hojas, quedan fuera de la cuenta.
      */
      expect(marcado[0].trazos).toBe(plano[0].trazos + 1)
    }, 200_000)

    it('el subrayado se acumula con negrita y cursiva sin pedir una cara nueva', async () => {
      const hojas = await componer({
        ...BASE,
        cuerpo: [{
          tipo: 'parrafo',
          tramos: [{ texto: SUBRAYADO, negrita: true, cursiva: true, subrayado: true }],
        }],
      })
      const plano = await componer({
        ...BASE,
        cuerpo: [{ tipo: 'parrafo', tramos: [{ texto: SUBRAYADO, negrita: true, cursiva: true }] }],
      })

      // El texto sale entero y la línea se dibuja igual: la decoración no compite con la
      // familia, que es lo que sí ocurre entre negrita y cursiva.
      expect(hojas[0].texto).toContain(SUBRAYADO)
      expect(hojas[0].trazos).toBe(plano[0].trazos + 1)
    }, 200_000)

    /**
     * La alineación se mide por dónde EMPIEZA el renglón. El margen izquierdo de la caja
     * son 72 pt —el mismo que ancla la firma en la prueba de arriba—, así que un párrafo en
     * bandera arranca ahí y uno centrado o a la derecha arranca más adentro.
     */
    it('centrado y derecha desplazan el arranque del renglón', async () => {
      const corto = 'Constancia'
      const medir = async (alineacion?: 'center' | 'right'): Promise<number> => {
        const hojas = await componer({
          ...BASE,
          cuerpo: [{ tipo: 'parrafo', tramos: [{ texto: corto }], alineacion }],
        })
        return renglon(hojas[0], corto).x
      }

      const izquierda = await medir(undefined)
      const centro = await medir('center')
      const derecha = await medir('right')

      expect(izquierda).toBeCloseTo(MARGEN.izquierdo, 1)
      expect(centro).toBeGreaterThan(izquierda)
      expect(derecha).toBeGreaterThan(centro)
    }, 200_000)

    /**
     * ⚠ EL JUSTIFICADO ES LA SEGUNDA EXCEPCIÓN DECLARADA A I.3.2 del sistema, y la primera
     * es el cuerpo del consentimiento. Se admite aquí porque esta es la hoja membretada del
     * médico y el trámite manda; si algún día aparece una tercera sin nota, la regla habrá
     * dejado de ser una regla. Ver `AlineacionEscrito`.
     */
    it('el justificado se compone: no se descarta por I.3.2', async () => {
      const largo =
        'Se extiende la presente constancia a petición de la persona interesada para los usos legales y administrativos que estime convenientes ante la autoridad que corresponda.'
      const bandera = await componer({
        ...BASE,
        cuerpo: [{ tipo: 'parrafo', tramos: [{ texto: largo }] }],
      })
      const justificado = await componer({
        ...BASE,
        cuerpo: [{ tipo: 'parrafo', tramos: [{ texto: largo }], alineacion: 'justify' }],
      })

      /*
        El justificado no mueve dónde corta cada renglón: reparte el sobrante DENTRO del
        renglón. Así que lo que cambia no es el número de renglones sino su contenido — en
        bandera, el primero acaba donde acaba; justificado, el renglón se estira hasta el
        borde y react-pdf lo compone con otros desplazamientos.
      */
      expect(justificado[0].texto).toContain('Se extiende la presente constancia')
      expect(justificado[0].renglones.length).toBe(bandera[0].renglones.length)
    }, 200_000)

    it('los encabezados también admiten alineación', async () => {
      const hojas = await componer({
        ...BASE,
        cuerpo: [{ tipo: 'encabezado1', texto: 'Constancia', alineacion: 'center' }],
      })
      // v3 · el encabezado conserva la caja que escribió el médico.
      expect(renglon(hojas[0], 'Constancia').x).toBeGreaterThan(72)
    }, 200_000)
  })

})
