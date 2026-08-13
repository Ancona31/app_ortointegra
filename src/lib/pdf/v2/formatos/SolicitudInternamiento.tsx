/**
 * Sistema de documentos v2 — formato II.6 · **Solicitud de Internamiento**.
 *
 * FUENTE DE VERDAD: **las coordenadas medidas de la lámina aprobada**, con
 * `DOCUMENTOS_SPEC.md` II.6 como segunda lectura. Donde las dos difieren manda la lámina.
 *
 * POR QUÉ ESTE FORMATO EXISTE EN EL PLAN
 *
 * Porque es el único con **dos secciones y dos lectores**, y el único cuyo reparto en
 * hojas es ESTRUCTURAL y no por capacidad. La sección 1 la leen el paciente y Admisión; la
 * 2, la enfermería y el residente de piso. Un documento así no se puede paginar por lo que
 * quepa: la hoja donde empieza la sección 2 la abre un filete, no un desbordamiento.
 *
 * EL REPARTO — TRES HOJAS FIJAS, Y NO ES UNA LIMITACIÓN
 *
 *     1   diagnósticos · procedimiento · requerimientos · justificación
 *     2   instrucciones al paciente · las dos firmas
 *     3   apertura de sección · los cuatro bloques numerados · la firma del médico
 *
 * Se compone con dos saltos declarados (`break`), que es la única forma de que una hoja
 * empiece donde el documento dice y no donde acaba la anterior. **No contradice a I.3.4**:
 * ahí no se mueve ni un bloque para cuadrar una hoja ni se comprime nada — es el orden del
 * documento el que declara dónde corta, y lo declara igual con un ítem que con veinte. Si
 * la sección 1 crece, la hoja 1 desborda a una hoja propia y las otras dos siguen detrás.
 *
 * ⚠ **FOLIO: NO LLEVA, Y LA LÁMINA LO COMPONE EN LAS TRES HOJAS CON PREFIJO `H-`.**
 *
 * Decisión de Angel, y coincide con lo que II.6 §1 ya declaraba: es documento de apoyo
 * interno del hospital, sin valor legal propio y sin tercero que cite un número, así que
 * **lo que ata las hojas es la paginación y la línea de paciente**, no un folio. Se compone
 * `PieDocumento` variante `sin folio`, que pone el TÍTULO en la zona donde iría el número.
 * Reportado, con la cifra al lado: es la única de las seis láminas cuyo folio no se
 * compone, y las tres anteriores revirtieron el `sin folio` de su propia ficha por lo
 * contrario.
 *
 * La ranura sigue construida: el riel derecho del bloque de título compone su celda de
 * folio con la desviación medida de esta lámina (2.C), y nadie la alimenta. El día que la
 * decisión se revierta, entra el folio con su `H-` y no hay que medir nada otra vez.
 *
 * ── ⚠ Y LA BASE SÍ LE ASIGNA UNO. NO ES UNA INCONSISTENCIA POR CORREGIR ─────
 *
 * `20260811_folio_03_denegacion.sql:273` mete `solicitud_internamiento` en el `CASE` del
 * generador, así que **la fila va a tener folio `INT-AAAA-NNNN` y el papel no lo va a
 * decir**. Reconfirmado por Angel al reconciliar v1 con v2, con el desacuerdo delante.
 *
 * Las dos cosas son ciertas a la vez y ninguna sobra:
 *
 *   · La FILA lo lleva porque el expediente electrónico numera todo lo que emite, y una
 *     serie con huecos no se puede auditar.
 *   · El PAPEL no lo lleva porque nadie lo va a citar: no hay ventanilla, ni aseguradora,
 *     ni paciente que lea ese número en voz alta.
 *
 * **Quien encuentre este desacuerdo NO tiene que «arreglarlo».** Ni añadiendo la ranura al
 * papel —la lámina no la mide y meterla mueve el encabezado más alto del sistema— ni
 * sacando `int` del generador, que dejaría la serie con huecos. Si alguna vez se revierte,
 * se revierte por decisión de producto y por escrito, no porque las dos mitades «no
 * cuadren» al leerlas juntas.
 *
 * EL PRESUPUESTO DEL ENCABEZADO, SUMADO Y NO DECLARADO
 *
 * La lámina mide **237.61 pt** desde el margen de 54, el más alto del sistema. Como en los
 * cinco anteriores, eso no es una constante que copiar: es la suma de sus bloques.
 *
 *     fila superior del membrete   56       (el panel; la lámina la mide en 58.85)
 *     aire                          8       `transicion.membreteFilete`
 *     filete principal              2.5
 *     aire                          6       `transicion.membreteLineaFina`
 *     banda de dirección           24       dos renglones de 12, con cédulas
 *     espaciador de cierre         10       ← 2.B, los mismos 10 de Receta
 *     bloque de título             38.5     título 20 + aire 4 + badge 14.5
 *     aire                          5       ← 2.C, los mismos 5 de Receta
 *     filete del título             2.5
 *     aire                          8       `transicion.tituloRiel`, el del chasis
 *     riel de identificación       61.325   (0.475 + 30 + 0.375 + 30 + 0.475)
 *     aire                         12
 *                                 ─────────
 *                                 233.825
 *
 * ⚠ **CUADRA POR LOS DOS LADOS Y NINGUNO ES EXACTO.** Sumando los 2.85 pt del panel —56 en
 * el chasis contra 58.85 en la lámina, la SEXTA que lo mide por encima de 56— salen
 * **236.675** contra los 237.61 medidos: **0.935 pt de sobra**, repartidos entre el bloque
 * de título (0.84) y el riel (0.095). Los dos son residuo de caja de línea del mismo signo
 * que el 0.365 de Suplementación y el 0.63 de Honorarios: el HTML añade el *strut* de la
 * fuente donde Yoga no. Reportado.
 *
 * LAS SEIS COSAS QUE ESTA LÁMINA CONTRADICE, Y GANA LA LÁMINA
 *
 * a. **La raya de ítem va en la neo-grotesca.** La lámina la compone en IBM Plex Mono, que
 *    I.1.4 prohíbe en documento impreso. **Octavo caso idéntico** (`CONCILIA D13, D20,
 *    D30`), y el único que la propia ficha del formato ya mandaba sustituir (II.6 §5).
 * b. **Dos composiciones de firma en el mismo documento:** el nombre va a 10 / 14 en la
 *    pareja de la hoja 2 y a 11 / 15 en la firma sola de la hoja 3. Se componen las dos
 *    —ver `CalibracionFirma` en 2.L— y queda reportado: son el cuarto y el segundo valor
 *    del sistema para el mismo renglón.
 * c. **El badge no se repite en las hojas 2 y 3.** Las otras dos láminas con bloque en
 *    negativo lo repiten reducido en su continuación; esta no lo compone. Reportado en 2.V.
 * d. **La caja del título (297) y su riel derecho (190) no caben juntos en `caja.ancho`.**
 *    Se compone la caja y el riel se deriva. Reportado en 2.C.
 * e. **La pareja de firmas declara medianil 30 y dos cajas de 246**, que suman 522 sobre
 *    una caja de 486. Se compone el medianil. Reportado en 2.L.
 * f. **El aviso de pie es el del chasis.** La lámina compone `Continúa en la hoja 2 ·
 *    instrucciones y firmas` a la izquierda y `Sección 1 de 2` a la derecha; 2.N compone
 *    una sola forma para los seis formatos (`CONCILIA D5, D22`) y no la recibe por prop.
 *    Es la CUARTA construcción distinta de la zona derecha, que es lo que `D22` lleva
 *    reportado desde la conciliación. **Reportado, no compuesto.**
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import type { ConsultorioMembrete, MedicoMembrete } from '../Membrete'
import type { PanelCircularProps } from '../PanelCircular'
import type { ValoresPaciente } from '../BloquePaciente'
import AperturaSeccion from '../AperturaSeccion'
import BloqueDestacado from '../BloqueDestacado'
import BloqueFirmas, { type Firma } from '../BloqueFirmas'
import MotorFlujo from '../MotorFlujo'
import ParserBloques, { ListaDeNodos } from '../ParserBloques'
import PieDocumento from '../PieDocumento'
import RielDatos from '../RielDatos'
import { analizar, type NodoParser } from '../analizadorBloques'
import { tieneValor } from '../Campo'
import {
  CAJA,
  ESPACIO,
  FILETE,
  FILETE_INTERNAMIENTO,
  MARGEN,
  PAPEL,
  RETICULA,
  TINTA,
  estiloTipografico,
  type AcentoResuelto,
} from '../tokens'

/** La lámina que fija la composición de los componentes del chasis en este formato. */
const LAMINA = 'internamiento' as const

// ─── Cadenas ─────────────────────────────────────────────────────────────────

/** Las cadenas que este formato declara, textuales de la lámina. */
const TITULO = 'Solicitud de internamiento'

/** Los cinco títulos de bloque de la sección 1. */
const TITULO_DIAGNOSTICOS = 'Diagnósticos'
const TITULO_PROCEDIMIENTO = 'Procedimiento o cirugía'
const TITULO_REQUERIMIENTOS = 'Requerimientos especiales'
const TITULO_JUSTIFICACION = 'Justificación clínica'
const TITULO_INSTRUCCIONES = 'Instrucciones para el paciente'

/**
 * LA APERTURA DE LA SECCIÓN 2. Las tres cadenas de la lámina, y el número va aparte porque
 * es un dígito colgado del riel, no parte del rótulo.
 */
const SECCION_2 = {
  numero: 2,
  rotulo: 'Indicaciones de ingreso a piso',
  lector: 'Para personal de enfermería y médico residente',
} as const

/**
 * EL RÓTULO DE LA HOJA 3, Y ES LA RAZÓN DE QUE `rotulosContinuacion` EXISTA.
 *
 * ⚠ **NUNCA «continuación» PARA LA SECCIÓN 2.** Una hoja de indicaciones de enfermería no
 * es la continuación de la hoja del paciente: es otro documento dentro del mismo folio,
 * con otro lector. La hoja 2 sí es continuación de la 1 —cierra la sección 1 con las
 * instrucciones y las firmas— y por eso **no se declara aquí**: se queda con el rótulo del
 * chasis, que es el único sitio del sistema donde esa palabra está escrita.
 */
const ROTULO_HOJA_SECCION_2 = `${TITULO} · sección 2 de 2`

/** Los dos rótulos de firma de la lámina, y la nota del primero. */
const FIRMA_PACIENTE = 'Firma del paciente o familiar'
const NOTA_FIRMA_PACIENTE = 'Nombre y firma · parentesco si aplica'
const FIRMA_MEDICO = 'Firma y sello del médico'

/**
 * ⚠ **`D14` SIGUE REPORTADO Y ESTA LÁMINA VOTA CON LAS SOLICITUDES.** Laboratorio e
 * Imagenología rotulan la firma con sello y Receta y Suplementación sin él; esta compone
 * `Firma y sello del médico`, así que van tres contra dos. Se compone la cadena de cada
 * lámina y la divergencia no se cierra desde aquí.
 */

// ─── Separaciones de primer nivel ────────────────────────────────────────────

/**
 * SEPARACIÓN ENTRE BLOQUES DE PRIMER NIVEL, medida en la lámina aprobada.
 *
 * Mismo criterio que en los cinco formatos anteriores: I.1.7 no nombra ninguna de estas
 * parejas, así que gobierna la ESCALA y el formato declara qué miembro usa (§0). Ninguna es
 * literal y ninguna es miembro nuevo.
 *
 *   riel → primer bloque            **12 pt**
 *   entre bloques de la hoja 1      **12 pt**
 *   instrucciones → firmas          ** 8 pt**
 *   apertura → primer bloque        **14 pt**
 *   entre bloques de la sección 2   **14 pt**
 *   último bloque → firma           **24 pt**
 *
 * **Faltan tres parejas y las tres faltan porque ya están declaradas en el chasis:**
 * membrete → título es el espaciador de 2.B —10 en esta lámina—, título → riel es el aire
 * de 2.C —8, el del chasis— y filete de transición → apertura son los 8 pt que monta 2.Q.
 * Sumar cualquiera aquí la contaría dos veces.
 *
 * **Y faltan los dos ceros de las hojas 2 y 3**, que también son medidas: el encabezado de
 * continuación cierra pegado a lo que sigue, sin aire propio. Un salto de hoja arranca en
 * el borde de la caja, así que el cero sale solo — no hay nada que declarar y por eso no
 * hay constante.
 */
const SEPARACION_RIEL_BLOQUE = ESPACIO[12]
const SEPARACION_BLOQUES = ESPACIO[12]
const SEPARACION_INSTRUCCIONES_FIRMAS = ESPACIO[8]
const SEPARACION_APERTURA_BLOQUE = ESPACIO[14]
const SEPARACION_BLOQUES_SECCION = ESPACIO[14]
const SEPARACION_ULTIMO_FIRMA = ESPACIO[24]

/**
 * COLUMNAS DEL RIEL DE REQUERIMIENTOS — tres, que sobre la retícula del riel son celdas de
 * 162 pt. `repeat(3, 1fr)` en la lámina del documento; la de demostración compone dos.
 */
const COLUMNAS_REQUERIMIENTOS = 3

// ─── Props ───────────────────────────────────────────────────────────────────

export interface SolicitudInternamientoProps {
  readonly medico: MedicoMembrete
  /** Consultorio activo, leído por quien construye el documento (I.3.6, P2-3). */
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  /**
   * Los datos del riel. Este formato usa OCHO celdas en dos filas, y cuatro de ellas son
   * suyas: hospital, tipo de internamiento, días estimados y ASA. `fecha` y `hora` no
   * viven aquí —suben a la celda `Emisión` del riel derecho del bloque de título, como en
   * Receta— y `diagnostico` tampoco: en este formato es un bloque del cuerpo, no una celda.
   *
   * `paciente` y `hospital` **bloquean emisión** en el formulario (II.6 §2).
   */
  readonly paciente: ValoresPaciente
  /** Fecha y hora de emisión, YA compuestas por quien llama. Colapsa si no viene. */
  readonly emision?: string
  /** Badge `URGENTE` bajo el título, y solo en la hoja 1 (2.H regla 4, y ver (c)). */
  readonly urgente?: boolean
  /**
   * Diagnósticos, como UNA cadena con la sintaxis de bloques (`CONCILIA D10`). El
   * principal y los secundarios entran como viñetas; sin ninguna, sale prosa.
   * **Bloquea emisión.**
   */
  readonly diagnosticos: string
  /** Procedimiento o cirugía. Colapsa el bloque entero si no viene. */
  readonly procedimiento?: string
  /**
   * Catálogo ABIERTO de requerimientos especiales. Colapsa el riel entero si viene vacío,
   * y **no lleva contador**: el médico agrega y quita, así que «3 de 7» sería una cifra
   * falsa (2.K regla 3).
   */
  readonly requerimientos?: readonly string[]
  /** Justificación clínica. Colapsa el bloque entero si no viene. */
  readonly justificacion?: string
  /**
   * Instrucciones al paciente, prellenadas por plantilla. Lista **numerada**, no con raya:
   * primero presentarse, después el ayuno — la secuencia significa (II.6 §5).
   *
   * Colapsa el bloque destacado si no viene; la hoja 2 se queda con las dos firmas.
   */
  readonly instruccionesPaciente?: string
  /**
   * Indicaciones de ingreso a piso, como UNA cadena con la sintaxis de bloques. Cada
   * encabezado con sus viñetas produce un bloque numerado; la prosa suelta sale como
   * párrafo, en minúsculas y sin raya (II.6 §6).
   *
   * **Sin ella COLAPSA LA SECCIÓN 2 ENTERA**, con su apertura, sus bloques y su firma: el
   * documento se queda en dos hojas.
   */
  readonly indicacionesPiso?: string
  /** Trazo capturado del médico (2.L regla 5). */
  readonly rubrica?: string
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

const estilos = StyleSheet.create({
  hoja: {
    backgroundColor: TINTA.papel,
    paddingTop: MARGEN.superior,
    paddingLeft: MARGEN.izquierdo,
    paddingRight: MARGEN.derecho,
    // Regla 4 de 2.L: reserva los 36 + 16 + 16 pt donde vive la banda de 2.M. Sin
    // él vuelve el bug §8.1 y no hay nada que lo detenga (anexo A, P2-27).
    paddingBottom: MARGEN.inferior,
  },
  /**
   * EL BLOQUE SIMPLE — filete superior de 0.63 en `tinta.reglaSuave` y su título.
   *
   * Es el bloque de cuerpo más discreto del sistema: su filete es más fino que el de
   * `recomendaciones` de 2.I por trece centésimas y va en el mismo tono. No se compone con
   * 2.I y no podría —aquel sangra su texto respecto del filete y este no sangra nada: el
   * cuerpo arranca al borde de la caja, a los 486 pt.
   */
  bloqueSimple: {
    width: CAJA.ancho,
    borderTopWidth: FILETE_INTERNAMIENTO.regla,
    borderTopColor: TINTA.reglaSuave,
  },
  tituloSimple: { ...estiloTipografico('bloqueSimple.titulo') },
  /** El cuerpo del bloque simple, a 4 pt de su título. */
  cuerpoSimple: { marginTop: ESPACIO[4] },
  /**
   * EL BLOQUE NUMERADO DE LA SECCIÓN 2 — filete superior de `filete.fino` en tinta plena y
   * padding de 6 por dentro.
   *
   * Pesa más que el simple por los dos ejes a la vez —0.8 contra 0.63, negro contra gris— y
   * eso es la jerarquía funcionando: los bloques de la sección 2 son órdenes de enfermería
   * y los de la 1 son el expediente de la solicitud.
   */
  bloqueNumerado: {
    width: CAJA.ancho,
    borderTopWidth: FILETE.fino,
    borderTopColor: TINTA.negra,
    padding: 6,
  },
  /** La misma anatomía de riel que 2.G, 2.J, 2.P y 2.Q: una columna exacta de retícula. */
  cabeceraNumerada: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  rielNumero: {
    width: RETICULA.riel,
    marginRight: RETICULA.medianil,
    flexShrink: 0,
  },
  /** 486 − 23.25 − 9 = 453.75. Sale de la resta, no se escribe. */
  cajaNumerada: { flex: 1 },
  tituloNumerado: { ...estiloTipografico('titulo.seccion') },
  /** Los ítems del bloque numerado, a 3 pt de su título. */
  cuerpoNumerado: { marginTop: 3 },
  /** El párrafo suelto: texto corrido a la caja entera, sin filete, título ni marca. */
  parrafoSuelto: { ...estiloTipografico('texto.corrido'), width: CAJA.ancho },
  /** Separación entre bloques de la hoja 1 y de la sección 2. */
  siguienteHoja1: { marginTop: SEPARACION_BLOQUES },
  siguienteSeccion: { marginTop: SEPARACION_BLOQUES_SECCION },
  /** El primero de la hoja 1 cuelga del riel de identificación. */
  primerBloque: { marginTop: SEPARACION_RIEL_BLOQUE },
  /** El primero de la sección 2 cuelga de la apertura. */
  primerBloqueSeccion: { marginTop: SEPARACION_APERTURA_BLOQUE },
  /** Las dos firmas de la hoja 2, bajo el bloque de instrucciones. */
  firmasHoja2: { marginTop: SEPARACION_INSTRUCCIONES_FIRMAS },
})

// ─── Composición de bloques ──────────────────────────────────────────────────

/**
 * UN BLOQUE SIMPLE: filete, título y el cuerpo por 2.J con la calibración `simple`.
 *
 * El cuerpo entra como cadena y lo analiza 2.J, así que un bloque con viñetas sale como
 * lista con raya y uno sin ellas como prosa — el mismo dato compone las dos cosas sin que
 * este archivo mire el texto.
 */
function BloqueSimple({
  titulo,
  texto,
  primero,
}: {
  titulo: string
  texto: string
  primero: boolean
}): ReactElement {
  return (
    <View style={[estilos.bloqueSimple, primero ? estilos.primerBloque : estilos.siguienteHoja1]}>
      <Text style={estilos.tituloSimple}>{titulo}</Text>
      <View style={estilos.cuerpoSimple}>
        <ParserBloques texto={texto} marca="raya" calibracion="internamientoSimple" />
      </View>
    </View>
  )
}

/**
 * UN BLOQUE NUMERADO DE LA SECCIÓN 2: filete, número colgado del riel, título al lado y
 * los ítems debajo con la calibración `bloque` —la misma raya que el bloque simple, con
 * tres puntos de margen en vez de dos.
 */
function BloqueNumerado({
  numero,
  titulo,
  nodos,
  primero,
  acento,
}: {
  numero: number
  titulo: string
  nodos: readonly NodoParser[]
  primero: boolean
  acento: AcentoResuelto
}): ReactElement {
  return (
    <View
      style={[
        estilos.bloqueNumerado,
        primero ? estilos.primerBloqueSeccion : estilos.siguienteSeccion,
      ]}
    >
      <View style={estilos.cabeceraNumerada}>
        <View style={estilos.rielNumero}>
          {/* `seccion.numero` sin desviar: 15 / 15, 600, `acento.tinta`. */}
          <Text style={{ ...estiloTipografico('seccion.numero', acento) }}>{numero}</Text>
        </View>
        <View style={estilos.cajaNumerada}>
          <Text style={estilos.tituloNumerado}>{titulo}</Text>
          <View style={estilos.cuerpoNumerado}>
            <ListaDeNodos nodos={nodos} marca="raya" calibracion="internamientoBloque" />
          </View>
        </View>
      </View>
    </View>
  )
}

/**
 * Un bloque de las indicaciones de piso, ya agrupado: con título es numerado, sin él es
 * prosa suelta.
 */
interface BloqueIndicacion {
  /** El encabezado del bloque. Ausente en la prosa suelta. */
  readonly titulo?: string
  /**
   * Ordinal del bloque, **y solo si lleva título**. La prosa suelta no consume número: un
   * párrafo de contexto antes de las órdenes no es una orden.
   *
   * Se calcula aquí y no en el render por una razón que no es de estilo: un contador que
   * se incremente dentro del `map` es una reasignación durante el render, y este renderer
   * compone el árbol más de una vez por documento —una pasada de reparto y otra final—, así
   * que la numeración dependería de cuántas veces se haya recorrido.
   */
  readonly numero?: number
  /** Lo que cuelga de él, ya analizado. Vacío en un bloque de solo encabezado. */
  readonly nodos: readonly NodoParser[]
}

/**
 * AGRUPA LOS NODOS DE 2.J EN LOS BLOQUES QUE LA LÁMINA COMPONE.
 *
 * El analizador ya decide qué es cada línea —y lo hace con el lookahead, que es lo que
 * impide que la prosa salga en versalita como si fuera título—; lo que falta es agrupar
 * sus nodos por el `bloque` que él mismo numera y separar el encabezado de lo que cuelga
 * de él. Esa agrupación es composición de ESTE formato y por eso vive aquí: 2.J compone
 * una tirada de nodos y no sabe que en II.6 cada tirada lleva filete y número.
 *
 * ⚠ **SE ANALIZA UNA SOLA VEZ Y LOS NODOS SE REPARTEN TAL CUAL.** La primera versión
 * reconstruía el cuerpo de cada bloque como texto y lo volvía a pasar por el analizador, y
 * eso **cambia el resultado**: la degradación del ítem único es global a la cadena a
 * propósito, así que un bloque con una sola viñeta perdía su raya al reanalizarse solo.
 * Medido sobre el PDF: tres de los cuatro bloques salían sin marca. Ver `ListaDeNodos` en
 * 2.J, que es la puerta que este reparto necesita.
 */
function bloquesDeIndicaciones(texto: string): readonly BloqueIndicacion[] {
  const porBloque = new Map<number, { titulo?: string; nodos: NodoParser[] }>()

  for (const nodo of analizar(texto)) {
    const grupo = porBloque.get(nodo.bloque) ?? { nodos: [] }
    if (nodo.tipo === 'encabezado') grupo.titulo = nodo.texto
    else grupo.nodos.push(nodo)
    porBloque.set(nodo.bloque, grupo)
  }

  let ordinal = 0
  return [...porBloque.values()].map((grupo) => {
    if (grupo.titulo === undefined) return { nodos: grupo.nodos }
    ordinal += 1
    return { titulo: grupo.titulo, numero: ordinal, nodos: grupo.nodos }
  })
}

// ─── Firmas ──────────────────────────────────────────────────────────────────

/**
 * La firma del paciente o familiar. **Va en blanco**: sin nombre y sin rúbrica, porque
 * quien firma puede no ser el paciente y escribe su nombre y su parentesco a mano sobre la
 * línea. Por eso lleva la nota como credencial —es el renglón que I.1.9 reserva bajo la
 * firma— y no un nombre.
 */
function firmaDelPaciente(): Firma {
  return {
    rol: FIRMA_PACIENTE,
    credenciales: [NOTA_FIRMA_PACIENTE],
    // Ver `pesoNombre` en 2.L: hoy no se ve, y se compone porque la lámina lo mide.
    pesoNombre: 400,
  }
}

/**
 * La firma del médico tratante. Los renglones bajo la línea salen de I.1.9 y son los
 * mismos que el membrete imprime arriba: se toman de `MedicoMembrete` en vez de pedirlos
 * otra vez.
 */
function firmaDelMedico(medico: MedicoMembrete, rubrica?: string): Firma {
  return {
    rol: FIRMA_MEDICO,
    nombre: medico.nombre,
    credenciales: medico.cedulas,
    rubrica,
  }
}

// ─── El formato ──────────────────────────────────────────────────────────────

/** II.6 · Solicitud de Internamiento. */
export default function SolicitudInternamiento({
  medico,
  consultorio,
  panel,
  acento,
  paciente,
  emision,
  urgente,
  diagnosticos,
  procedimiento,
  requerimientos,
  justificacion,
  instruccionesPaciente,
  indicacionesPiso,
  rubrica,
}: SolicitudInternamientoProps): ReactElement {
  const hayRequerimientos = requerimientos !== undefined && requerimientos.length > 0
  const haySeccion2 = tieneValor(indicacionesPiso)
  const indicaciones = haySeccion2 ? bloquesDeIndicaciones(indicacionesPiso) : []

  // Anotado y no aseverado: 2.L pide tuplas y la anotación se las da sin `as`, que este
  // proyecto prohíbe para acallar un tipo.
  const firmasHoja2: readonly [Firma, Firma] = [
    firmaDelPaciente(),
    firmaDelMedico(medico, rubrica),
  ]
  const firmaHoja3: readonly [Firma] = [firmaDelMedico(medico, rubrica)]

  return (
    <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.hoja}>
      <MotorFlujo
        encabezado={{
          medico,
          consultorio,
          panel,
          acento,
          lamina: LAMINA,
          titulo: TITULO,
          paciente,
          emision,
          urgente,
        }}
        // Solo la hoja 3. La 2 se queda con el rótulo del chasis. Ver `ROTULO_HOJA_SECCION_2`.
        hojasPropias={{ 3: { rotulo: ROTULO_HOJA_SECCION_2 } }}
        aireFirma={SEPARACION_ULTIMO_FIRMA}
        firmas={
          /*
            LA FIRMA DE LA HOJA 3 — sola, en la columna izquierda de la fila de cierre, y
            con la composición `estandar`: nombre a 11 / 15, contra el 10 / 14 de la pareja
            de la hoja 2. Ver el punto (b) de la cabecera.

            Cuando no hay sección 2 esta firma **cierra la hoja 2**, detrás de la pareja.
            No es un caso raro: es lo que ocurre con una solicitud sin indicaciones de
            piso, y es también la razón de que el cierre de 2.N no se pueda dejar vacío —
            ese bloque es el que garantiza que la firma nunca se parta.
          */
          <BloqueFirmas variante="simple" lamina={LAMINA} firmas={firmaHoja3} />
        }
      >
        {/*
          ═══ HOJA 1 · SECCIÓN 1 ═══

          Sin apertura y sin número colgado: la sección 1 arranca con su primer bloque
          detrás del riel de identificación. Es la mitad que hace significar a 2.Q.
        */}
        <BloqueSimple titulo={TITULO_DIAGNOSTICOS} texto={diagnosticos} primero />

        {tieneValor(procedimiento) ? (
          <BloqueSimple
            titulo={TITULO_PROCEDIMIENTO}
            texto={procedimiento}
            primero={false}
          />
        ) : null}

        {/*
          EL RIEL DE REQUERIMIENTOS. Su título no lleva filete propio: **el filete de
          apertura del riel es el que cierra el título**, y poner además el del bloque
          simple dibujaría dos reglas a cuatro puntos una de otra. Es la lectura que hace
          cuadrar las dos cosas que la lámina declara —un título de bloque y un riel con
          apertura y cierre— sin inventar una tercera. Anotado.
        */}
        {hayRequerimientos ? (
          <View style={estilos.siguienteHoja1}>
            <Text style={estilos.tituloSimple}>{TITULO_REQUERIMIENTOS}</Text>
            <View style={estilos.cuerpoSimple}>
              <RielDatos
                variante="catalogo"
                lamina={LAMINA}
                sinContador
                items={requerimientos}
                columnas={COLUMNAS_REQUERIMIENTOS}
              />
            </View>
          </View>
        ) : null}

        {tieneValor(justificacion) ? (
          <BloqueSimple
            titulo={TITULO_JUSTIFICACION}
            texto={justificacion}
            primero={false}
          />
        ) : null}

        {/*
          ═══ HOJA 2 · CIERRE DE LA SECCIÓN 1 ═══

          `break` abre hoja. El encabezado de continuación lo repite 2.N por su cuenta —es
          `fixed`— así que aquí no hay nada que componer arriba, y por eso el aire entre el
          encabezado y las instrucciones es cero: la caja empieza donde empieza la hoja.
        */}
        <View break>
          {instruccionesPaciente === undefined ? null : (
            <BloqueDestacado
              variante="instrucciones"
              lamina={LAMINA}
              acento={acento}
              encabezado={TITULO_INSTRUCCIONES}
              texto={instruccionesPaciente}
            />
          )}

          {/*
            LAS DOS FIRMAS DE LA SECCIÓN 1, en la misma fila y con la composición
            `compacta`: nombre a 10 / 14, línea de 0.47. La del paciente va en blanco.

            2.L las cierra con `wrap={false}`, así que la pareja no se parte entre hojas
            aunque las instrucciones crezcan.
          */}
          <View style={estilos.firmasHoja2}>
            <BloqueFirmas
              variante="pareja"
              lamina={LAMINA}
              calibracion="compacta"
              firmas={firmasHoja2}
            />
          </View>
        </View>

        {/*
          ═══ HOJA 3 · SECCIÓN 2 ═══

          Colapsa entera con `indicacionesPiso`: sin ella no hay salto, no hay apertura y no
          hay tercera hoja (II.6 §2). La firma del médico la cierra igual, porque la monta
          2.N como cierre del documento.
        */}
        {haySeccion2 ? (
          <View break>
            <AperturaSeccion
              numero={SECCION_2.numero}
              rotulo={SECCION_2.rotulo}
              lector={SECCION_2.lector}
              acento={acento}
            />

            {indicaciones.map((bloque, indice) => {
              const primero = indice === 0
              if (bloque.titulo === undefined) {
                /*
                  Un bloque sin encabezado es prosa suelta, y sus nodos son párrafos: se
                  imprimen unidos por el salto que los separaba en el dato. No pasan por
                  `ListaDeNodos` porque no hay nada que marcar — es exactamente el bloque
                  `parrafoSuelto` de la lámina: sin filete, sin título y sin marca.
                */
                /*
                  PÁRRAFO SUELTO: sin filete, sin título y sin marca. Es la verificación
                  visible de II.6 §6 —«los dos primeros renglones salen en minúsculas y sin
                  raya»— y sale de que el lookahead del analizador no los ascendió a
                  encabezado.
                */
                return (
                  <Text
                    // El índice ES la identidad: dos bloques pueden decir lo mismo y lo
                    // único que los distingue es su orden.
                    key={indice}
                    style={[
                      estilos.parrafoSuelto,
                      primero ? estilos.primerBloqueSeccion : estilos.siguienteSeccion,
                    ]}
                  >
                    {bloque.nodos.map((nodo) => nodo.texto).join('\n')}
                  </Text>
                )
              }
              return (
                <BloqueNumerado
                  key={indice}
                  numero={bloque.numero ?? 1}
                  titulo={bloque.titulo}
                  nodos={bloque.nodos}
                  primero={primero}
                  acento={acento}
                />
              )
            })}
          </View>
        ) : null}
      </MotorFlujo>

      {/*
        Variante `sin folio`: paginación · TÍTULO · leyenda. Es la única de las seis láminas
        cuyo folio no se compone, y la decisión está razonada en el punto ⚠ de la cabecera.
        El título ocupa la zona donde iría el número, que es lo que esta variante hace.
      */}
      <PieDocumento variante="sinFolio" titulo={TITULO} acento={acento} />
    </Page>
  )
}
