/**
 * Sistema de documentos v2 — formato II.9 · **Denegación o revocación del consentimiento**.
 *
 * FUENTE DE VERDAD: `GUIA_FORM_DENEGACION.md`, medido sobre el archivo aprobado
 * `Denegacion de Consentimiento.dc.html` en coordenadas absolutas desde el borde del papel.
 *
 * QUÉ ES, Y POR QUÉ NO ES UNA HOJA DE II.7
 *
 * Un documento **independiente de una hoja** que se emite **en lugar** del consentimiento,
 * cuando el paciente rechaza el procedimiento o revoca una autorización previa. Si el paciente
 * deniega, no se imprimen las siete hojas que explican y otorgan lo que acaba de rechazar.
 *
 * Comparte con II.7 el formulario y los datos de identificación —se elige con un conmutador,
 * como recibo y cotización en II.5— y **no comparte su `documentos.tipo`**: un consentimiento y
 * una denegación son actos OPUESTOS, y una denegación etiquetada como consentimiento obligaría
 * a abrirla para saber que el paciente rechazó. El razonamiento entero está en la cabecera de
 * `supabase/migrations/20260811_folio_03_denegacion.sql`.
 *
 * LAS DOS VARIANTES, Y LAS DOS EN UNA HOJA
 *
 *     firma el paciente   3 firmantes   holgura **75.79 pt**
 *     por sustitución     2 firmantes   holgura **26.04 pt** — la más ajustada del documento
 *
 * Lo que separa a la segunda es la constancia del motivo (37.75) más su espaciador (12). Ver
 * `EL RIESGO DECLARADO` abajo.
 *
 * EL PRESUPUESTO DEL ENCABEZADO, SUMADO Y NO DECLARADO
 *
 * La guía mide **240.59 pt** desde el margen de 54. Como en los ocho anteriores, eso no es una
 * constante que copiar: es la suma de sus bloques.
 *
 *     fila superior del membrete    56       (el panel; la guía la mide en 58.85)
 *     aire                           8       `transicion.membreteFilete`
 *     filete principal               2.5
 *     aire                           6       `transicion.membreteLineaFina`
 *     banda de dirección            12       UN renglón, sin cédulas
 *     espaciador de cierre          12       ← 2.B, el del CHASIS
 *     bloque de título              56       título a DOS líneas (40) + 2 + subtítulo 14
 *     aire                           4       `transicion.tituloFilete`
 *     filete del título              2.5
 *     aire                           8       `transicion.tituloRiel`, el del CHASIS
 *     riel de identificación        70.57    (0.8 + 33 + 0.5 + 35.47 + 0.8)
 *                                 ────────
 *                                 237.57    + 2.85 (el panel) = **240.42**
 *
 * contra los **240.59** medidos: **0.17 pt**, del mismo orden que los residuos de las ocho
 * láminas anteriores. El riel se lee con el familiar VACÍO, que es como lo compone la guía —su
 * línea de escritura es lo que sube esa fila de 33 a 35.47—.
 *
 * ⚠⚠ **LOS DOS AIRES DEL ENCABEZADO SON LOS DEL CHASIS Y NO LOS DE II.7. NO LOS CAMBIES.**
 *
 * Este documento comparte con el consentimiento la banda de un renglón, la anatomía de celda
 * del riel y el marco de su declaración, así que la tentación es componerlo con
 * `lamina: 'consentimiento'`. **Con esa lámina el encabezado mide 258.59 y no 240.59**: aquella
 * cierra su membrete con 20 pt en vez de 12 y abre su cuerpo con 18 bajo el filete del título
 * en vez de 8. Los 18 pt de diferencia salen enteros de la holgura, y la variante por
 * sustitución solo tiene 26.04. Por eso existe la lámina `denegacion` — ver su nota en la capa
 * de tokens, que es donde se lee al lado de las otras ocho.
 *
 * LO QUE NO LLEVA, Y CADA COSA POR SU MOTIVO
 *
 *   **Sin QR.** El documento no autoriza nada: es la constancia de que no se autorizó. El
 *   folio se conserva —es lo que lo ata al expediente—, y esa separación entre folio y código
 *   es la misma que ya hace II.7.
 *
 *   **Sin anexo de identificaciones.** Con ello la numeración del pie queda cerrada: siempre
 *   `Página 1 de 1`.
 *
 *   **Sin bloque en negativo.** Con título propio duplicaría la función y competiría con él a
 *   dos renglones de distancia; la distinción de un vistazo la da el título.
 *
 *   **Sin diagnóstico y sin expediente en el riel.** Este documento no asienta un
 *   padecimiento: asienta que no se autorizó un procedimiento, y el procedimiento va como
 *   subtítulo del bloque de título.
 *
 *   **Sin sellos de trazabilidad.** II.7 los compone en dos sitios —pie de celda y bloque de
 *   cierre— y su guía los declara; la de este documento no mide ninguno de los dos y este
 *   archivo no los inventa. **Reportado**: si la NOM-004 los exige también aquí, lo que falta
 *   es medirlos en la lámina, no deducirlos de la de al lado.
 *
 * ⚠ **EL TEXTO CORRIDO VA JUSTIFICADO, y es la MISMA excepción declarada a I.3.2, no una
 * nueva.** I.3.2 prohíbe el justificado sin excepción en todo el sistema; Angel comparó las dos
 * versiones en papel y decidió el justificado para el consentimiento. Este documento es la
 * denegación de ese consentimiento —se emite en su lugar, con su formulario y sus datos—, así
 * que componerlo en bandera dejaría dos piezas del mismo acto con dos alineaciones. La
 * excepción sigue siendo de UN formato leído como uno solo, y los otros siete siguen en bandera
 * izquierda. Ver la cabecera de `ConsentimientoInformado.tsx`.
 *
 * ⚠ **LA PARTICIÓN SIGUE DESACTIVADA**, como allí: `fonts.ts` registra un
 * `registerHyphenationCallback` que devuelve la palabra entera, por el gate de I.3.1. El
 * justificado solo puede estirar espacios.
 *
 * EL RIESGO DECLARADO, Y QUÉ SE HACE CON ÉL
 *
 * La guía lo deja escrito: **con un nombre de procedimiento largo, la variante por sustitución
 * es la primera que desborda**. Su declaración crece un renglón de 16 pt y su holgura es de 26.
 *
 * **Angel decidió que una revocación en dos hojas NO es aceptable.** El documento es la
 * constancia de un acto único y una firma en otra hoja que la declaración es exactamente el
 * defecto que la regla 1 de 2.N existe para evitar. Así que lo que se recorta es el SUBTÍTULO
 * —el nombre del procedimiento bajo el título, que se repite dentro de la declaración dos
 * bloques más abajo—, no el documento. Ver `recortarSubtitulo()`.
 *
 * ⚠ **NO ES UN TRUNCADO DE CORTESÍA Y NO SE PUEDE QUITAR «PORQUE CASI NUNCA PASA».** Es lo
 * único que garantiza la hoja única, y su umbral está fijado en `denegacionConsentimiento.test.ts`
 * con el procedimiento más largo que el formulario admite.
 *
 * ⚠⚠ **Y EL TECHO NO DESAPARECIÓ: SE MOVIÓ, Y EL DIAGNÓSTICO LO VOLVIÓ A ACERCAR.**
 *
 * El diagnóstico entró en la declaración por su valor legal, y con él el primer párrafo pasa de
 * tres renglones a cuatro. **Eso era exactamente lo que la variante por sustitución podía
 * pagar**: su holgura baja de 29.43 a **13.43 pt**, y no queda sitio para un quinto renglón.
 * Medido, con la cadena de la prueba: **84 caracteres de diagnóstico caben y 85 no**.
 *
 * El diagnóstico y el procedimiento **viven en el mismo párrafo y compiten por los mismos
 * renglones**, así que los 84 no son una regla sino una cota de esa cadena; alargar uno acorta
 * al otro. La regla que sí se sostiene es **el párrafo aguanta un renglón de más y no dos**.
 *
 * **Lo que queda por decidir, y es de Angel.** No hay recorte que aplicar sin perder algo: lo
 * único truncable que queda es la declaración, que es la frase que el paciente firma y donde el
 * diagnóstico acaba de entrar —recortarla escondería el dato que el cambio existe para asentar—,
 * y el subtítulo ya va a un renglón. **La palanca que sobra es retirar el subtítulo entero del
 * bloque de título**: 16 pt, un renglón más de declaración. No se compone porque hacer aparecer
 * y desaparecer un bloque según lo que mida el párrafo de abajo es métrica decidida por el
 * contenido, que es lo que I.3.4 prohíbe — y porque dos denegaciones con estructura distinta y
 * sin motivo visible se leen como dos documentos.
 *
 * LOS DOS RECURSOS QUE ESTE FORMATO ESTRENA
 *
 *   **La retícula de firmas con columnas = firmantes** (2.L). Tres firmantes en dos columnas
 *   desbordaban 62 pt y dejaban media fila vacía. Es un parámetro del chasis, declarado en la
 *   ficha de 2.L, no un componente nuevo.
 *
 * ⚠ **LO QUE NO CUADRA CON LA GUÍA: LA CREDENCIAL DEL MÉDICO A 142 pt.**
 *
 * La guía lo da por verificado —«a 142 pt: rol, nombre y nota entran en un renglón cada uno, sin
 * saltos»— y en el PDF **no**: `Céd. Prof. 9552456 · Céd. Esp. 12085805` a 7.5 pt en IBM Plex
 * Sans mide algo más de 142, así que parte, y la celda del médico queda 11 pt más baja que las
 * otras dos. Solo pasa en la variante de tres columnas; en las dos de 228 entra sin partirse.
 *
 * **Se compone así y queda reportado**, porque las tres salidas están prohibidas o son peores:
 * bajar el cuerpo o el tracking es comprimir para cuadrar una hoja (I.3.4); recortar la cédula
 * con elipsis es esconder un dato de identificación profesional, que es lo que 2.H prohíbe; y
 * ensanchar la columna rompe el reparto de la guía. **La holgura lo absorbe**: la variante que lo
 * sufre es la de tres firmantes, que es la que tiene 75.79 pt de sobra, y queda en 68.43.
 * Fijado en `denegacionConsentimiento.test.ts`.
 *
 *   **El bloque con borde completo y fondo** (la constancia). Ya existía sin declarar en la
 *   hoja 4 de II.7, que no lo compuso: el punto (g) de su cabecera lo deja reportado como lo
 *   único del sistema con esa anatomía, y `D34` solo declara marcos parciales. **Este documento
 *   es el segundo consumidor y sí lo compone**, aquí y no en el chasis — por lo mismo que la
 *   caja de fotografía del anexo de II.7 vive en su formato: 2.U declara marcos de dos lados, y
 *   una caja cerrada con fondo no es uno de ellos. Ver `CONSTANCIA`.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { Page, View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import type { ConsultorioMembrete, MedicoMembrete } from '../Membrete'
import type { PanelCircularProps } from '../PanelCircular'
import type { ValoresPaciente } from '../BloquePaciente'
import BloqueFirmas, { type Firma } from '../BloqueFirmas'
import MarcoParcial, { MARCO } from '../MarcoParcial'
import MotorFlujo from '../MotorFlujo'
import PieDocumento from '../PieDocumento'
import { tieneValor } from '../Campo'
import {
  ESPACIO,
  FILETE,
  MARGEN,
  PAPEL,
  TINTA,
  estiloTipografico,
  type AcentoResuelto,
} from '../tokens'

/** La lámina que fija la composición de los componentes del chasis en este formato. */
const LAMINA = 'denegacion' as const

// ─── Cadenas ─────────────────────────────────────────────────────────────────

/**
 * EL TÍTULO, y **ocupa dos renglones a propósito**.
 *
 * La regla 1 de 2.C dice que un título fijo que rompe a dos líneas es un error de redacción del
 * título. Aquí no lo es: la guía lo mide en dos renglones —40 de los 55.99 del bloque— y la
 * cadena no se puede acortar sin perder una de las dos cosas que el documento es. `Denegación`
 * es negarse a autorizar por primera vez y `revocación` es retirar una autorización ya dada;
 * el mismo formato sirve para las dos y el título tiene que decirlo, porque es lo único que un
 * tercero lee de un vistazo para saber que esta hoja **no** autoriza nada.
 */
const TITULO = 'Denegación o revocación del consentimiento'

/**
 * LOS TRES PÁRRAFOS DE LA DECLARACIÓN. **Son texto clínico-legal: no se tocan.**
 *
 * Van literales de la guía, con los tres ajustes ya aprobados en ella. El primero lo REDACTA
 * este archivo porque lleva CUATRO datos dentro —paciente, diagnóstico, procedimiento y
 * médico—, que es el mismo reparto que hace II.7 con el suyo.
 *
 * La guía destaca las menciones con peso **500**, no 600: son las que un tercero busca al leer
 * la hoja, y por eso el destaque no es decorativo. Van como `Text` anidado, que es como
 * react-pdf compone un tramo con otro peso dentro de un párrafo.
 *
 * ⚠ **EL DESTACADO VA EN 500 Y EL PUENTE DE v1 LO COMPONE EN 700.** Aquel archivo destaca sus
 * cuatro menciones con `declBold`, y hace bien: es su convención y sus otros tres destacados ya
 * la usaban, así que darle al diagnóstico otro peso lo leería como un dato de otra clase dentro
 * de la misma frase. **Aquí el peso lo fija el chasis**: el destacado dentro de texto corrido es
 * 500 en todo v2. No es una divergencia que conciliar — son dos sistemas, y cada uno compone el
 * suyo hasta que v1 se apague.
 */
const DECLARACION_2 =
  'No obstante, en pleno uso de mis facultades y de forma libre y voluntaria, manifiesto mi decisión de no autorizar o revocar la autorización previamente otorgada para la realización del procedimiento descrito, asumiendo las consecuencias que de ello puedan derivarse, las cuales me han sido explicadas.'
const DECLARACION_3 =
  'Se me ha informado que puedo cambiar de opinión y otorgar mi consentimiento en cualquier momento.'

/**
 * La casilla de sustitución, textual. **Es la misma cadena que compone II.7**, y se escribe
 * entera en vez de importarse de aquel formato: los dos son documentos distintos y una cadena
 * compartida ataría la redacción de uno a la del otro. Es el criterio del sistema con todas sus
 * cadenas (I.1.7).
 */
const TEXTO_SUSTITUCION =
  'El paciente no puede firmar por sí mismo; firma en su lugar el familiar o responsable, cuyos datos se asientan en el recuadro de la derecha.'

/** El rótulo y el motivo por defecto de la constancia. Ver `motivo` en las props. */
const ROTULO_MOTIVO = 'Motivo por el que el paciente no firma'
const MOTIVO_POR_DEFECTO =
  'Imposibilidad física para firmar. Motivo valorado y asentado por el médico tratante.'

/**
 * LOS TRES ROLES Y SUS NOTAS.
 *
 * **Fuera el anestesiólogo** —entrega su propio consentimiento— y **fuera los testigos**, que
 * son opcionales en una revocación. **Sin niveles y sin campo de parentesco**: los tres firman
 * el mismo acto, así que no hay jerarquía de otorgamiento que rotular, y el parentesco ya está
 * asentado en el riel.
 */
const ROL_MEDICO = 'Médico tratante'
const ROL_PACIENTE = 'Paciente'
const ROL_FAMILIAR = 'Familiar o responsable'
const NOTA_PACIENTE = 'Nombre y firma'
const NOTA_FAMILIAR = 'Representante del paciente'
/** Por sustitución el familiar deja de ser opcional, y su nota lo dice. */
const NOTA_FAMILIAR_SUSTITUCION = 'Firma en representación del paciente'

// ─── Separaciones de primer nivel ────────────────────────────────────────────

/**
 * SEPARACIÓN ENTRE BLOQUES DE PRIMER NIVEL — **12 pt, y son las cuatro iguales**.
 *
 *     riel → declaración          12
 *     declaración → casilla       12
 *     casilla → constancia        12   solo en la variante por sustitución
 *     casilla o constancia → firmas 12
 *
 * Es el único formato del sistema donde todas las separaciones de primer nivel valen lo mismo,
 * y no es casualidad: el documento tiene cuatro bloques y ninguna jerarquía entre ellos —la
 * declaración, la casilla que la califica, la constancia que explica quién firma y las firmas—.
 * Una sola constante, `espacio.12`, y ningún miembro nuevo de la escala.
 *
 * Faltan las tres del encabezado y las tres faltan porque ya están en el chasis: el espaciador
 * de cierre de 2.B, `transicion.tituloFilete` y `transicion.tituloRiel`. Sumar cualquiera aquí
 * la contaría dos veces.
 */
const SEPARACION = ESPACIO[12]

/**
 * LA CONSTANCIA DEL MOTIVO — **el único bloque del sistema con borde en los cuatro lados y
 * fondo**, y por eso su geometría se declara aquí y no en 2.U.
 *
 * Se lee como constancia impresa y no como campo por llenar, que es exactamente lo contrario
 * de lo que dice un renglón de escritura: el motivo ya lo valoró y lo asentó el médico.
 *
 * ⚠ **EL FONDO NO ES EL ÚNICO PORTADOR DE SIGNIFICADO** (I.3.3), y esa es la condición que lo
 * hace componible: la caja se distingue además por su borde de 0.5 en los cuatro lados, así que
 * en fotocopia —donde `papelTenue` desaparece— sigue siendo una caja. **Quien quite el borde
 * deja el color solo y rompe la regla.** Es el mismo cuidado que se toma la caja de fotografía
 * del anexo de II.7, que es el otro sitio del sistema donde vive este octavo neutro.
 *
 * **`minHeight` y no `height`**: la caja crece con su contenido, así que aguanta un motivo más
 * largo sin romperse. Con el motivo por defecto mide 7 + 10 + 13 + 7 + 1 de bordes = **38**
 * contra los 37.75 de la guía: 0.25 pt.
 */
const CONSTANCIA = {
  ancho: MARCO.declaracion.ancho,
  padding: { vertical: 7, lateral: 9 },
  alto: 37.75,
} as const

/**
 * LA CASILLA DE SUSTITUCIÓN — 9 × 9 con marca sólida de 5 × 5, la misma que compone II.7.
 *
 * **No es una tipografía de check**: un glifo de palomita dependería de la fuente y no está en
 * ninguna de las dos familias del sistema.
 */
const CASILLA = { lado: 9, marca: 5, medianil: 7 } as const

// ─── Props ───────────────────────────────────────────────────────────────────

/**
 * Un firmante. **La rúbrica es por persona**, no por documento: el médico la lleva siempre y
 * los otros dos solo si firmaron en pantalla. Quien no firmó sale con el espacio en blanco de
 * 77 pt, sin leyenda de «pendiente»: ese aviso vive en pantalla, no en el papel.
 */
export interface FirmanteDenegacion {
  /** Nombre de quien firma. Sin él, el renglón se reserva para llenarlo a mano. */
  readonly nombre?: string
  /** Trazo capturado, ya normalizado a PNG o JPG por quien llama (I.3.8). */
  readonly rubrica?: string
}

export interface DenegacionConsentimientoProps {
  readonly medico: MedicoMembrete
  /** Consultorio activo, leído por quien construye el documento (I.3.6, P2-3). */
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  /**
   * Los datos del paciente. El riel compone SEIS de ellos en dos filas —**sin expediente**— y
   * `familiar` es campo vacío requerido: conserva su línea si no viene.
   *
   * ⚠ **EL SÉPTIMO ES EL DIAGNÓSTICO, Y NO VA EN EL RIEL SINO DENTRO DE LA DECLARACIÓN.** Una
   * revocación puede acabar en sede legal, y ahí importa no solo qué procedimiento se rechazó
   * sino **de qué se estaba tratando al paciente**; puesto en el riel sería un dato de
   * cabecera más, y lo que hace falta es que esté en la frase que el paciente firma. Se lee de
   * aquí y no de una prop hermana a propósito: dos puertas para el mismo dato son dos valores
   * que pueden discrepar, y el formato tendría que elegir uno en silencio.
   *
   * **Es opcional y su ausencia es un caso real**, no un descuido: en denegación el diagnóstico
   * no es campo obligatorio —exigirlo bloquearía un rechazo por no haber redactado antes lo que
   * el paciente acaba de rechazar—. Sin él la frase se compone **sin el inciso**. Ver el render.
   */
  readonly paciente: ValoresPaciente
  /**
   * El procedimiento que se deniega o cuya autorización se revoca. Va en dos sitios: como
   * subtítulo del bloque de título —recortado si es muy largo, ver `SUBTITULO`— y entero
   * dentro del primer párrafo de la declaración.
   */
  readonly procedimiento: string
  /** Los tres firmantes. El médico es el único cuya rúbrica se imprime siempre. */
  readonly firmantes: {
    readonly medico: FirmanteDenegacion
    readonly paciente: FirmanteDenegacion
    readonly familiar: FirmanteDenegacion
  }
  /**
   * VARIANTE POR SUSTITUCIÓN: el paciente no puede firmar y firma el familiar en su lugar.
   *
   * Cambia cuatro cosas a la vez: la casilla sale marcada, **aparece la constancia del
   * motivo**, la celda del paciente desaparece —la retícula pasa de tres columnas a dos— y la
   * nota del familiar cambia a `Firma en representación del paciente`. Es sustitución y no
   * adición: el familiar firma UNA vez.
   */
  readonly sustitucion?: boolean
  /**
   * MOTIVO POR EL QUE EL PACIENTE NO FIRMA. **Solo se compone en la variante por sustitución**,
   * que es la única donde la pregunta existe.
   *
   * Sin él, la fórmula de la hoja 4 de II.7, que ya está resuelta y medida allí. Entra por prop
   * porque el médico puede asentar otro —la caja crece con su contenido—, y no se inventa texto
   * nuevo cuando no lo hace.
   */
  readonly motivo?: string
  /**
   * Folio del documento, YA generado por la base. **Prefijo `DEN`**, no `D-`: la guía de
   * composición proponía una sola letra siguiendo las láminas viejas, y la convención de las
   * ocho clases existentes es de dos a tres letras. Lo fija
   * `20260811_folio_03_denegacion.sql`; este formato lo recibe como dato y no lo genera.
   */
  readonly folio: string
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

/**
 * LA EXCEPCIÓN A I.3.2, EN UN SOLO SITIO Y CON NOMBRE, igual que en II.7.
 *
 * Se esparce en los estilos de texto corrido del formato para que `grep -rn "'justify'"` sobre
 * este archivo devuelva **una** línea y se vea de un vistazo dónde vive. **No lo copies a
 * ningún otro archivo**: la prohibición sigue en pie para los siete formatos restantes.
 */
const JUSTIFICADO = { textAlign: 'justify' } as const

const estilos = StyleSheet.create({
  hoja: {
    backgroundColor: TINTA.papel,
    paddingTop: MARGEN.superior,
    paddingLeft: MARGEN.izquierdo,
    paddingRight: MARGEN.derecho,
    // Regla 4 de 2.L: reserva los 36 + 16 + 16 pt donde vive la banda de 2.M.
    paddingBottom: MARGEN.inferior,
  },

  // ── La declaración
  declaracion: { marginTop: SEPARACION },
  parrafo: { ...estiloTipografico('seccion.parrafo'), ...JUSTIFICADO },
  /**
   * `espacio.5` + 1 son los 6 pt que la guía mide entre párrafos. Es la misma suma que compone
   * II.7 y por el mismo motivo: 6 no es miembro de la escala y tampoco tiene por qué serlo
   * cuando sale exacto de dos que sí lo son.
   */
  parrafoSiguiente: {
    ...estiloTipografico('seccion.parrafo'),
    marginTop: ESPACIO[5] + 1,
    ...JUSTIFICADO,
  },
  /** Las menciones destacadas van en peso 500, no 600. Ver `DECLARACION_2`. */
  destacado: { fontWeight: 500 },

  // ── La casilla de sustitución
  filaCasilla: {
    width: MARCO.declaracion.ancho,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SEPARACION,
  },
  casilla: {
    width: CASILLA.lado,
    height: CASILLA.lado,
    borderWidth: FILETE.fino,
    borderColor: TINTA.negra,
    marginRight: CASILLA.medianil,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaCasilla: {
    width: CASILLA.marca,
    height: CASILLA.marca,
    backgroundColor: TINTA.negra,
  },
  textoCasilla: { ...estiloTipografico('casilla.texto'), flex: 1 },

  // ── La constancia del motivo
  /** El bloque cerrado con fondo. Ver `CONSTANCIA` antes de tocar cualquiera de sus cifras. */
  constancia: {
    width: CONSTANCIA.ancho,
    minHeight: CONSTANCIA.alto,
    marginTop: SEPARACION,
    borderWidth: FILETE.regla,
    borderColor: TINTA.hairline,
    backgroundColor: TINTA.papelTenue,
    paddingVertical: CONSTANCIA.padding.vertical,
    paddingHorizontal: CONSTANCIA.padding.lateral,
  },
  /**
   * Rótulo en `aseguradora.rotulo` —6.5 / 10, peso 600, 0.22 em, `tinta.etiqueta`—, que son las
   * cinco cifras que la guía mide para esta línea. El rol se llama así por su primer consumidor
   * y no por su contenido; es el mismo criterio con el que II.7 lo reutiliza para el parentesco.
   */
  rotuloMotivo: { ...estiloTipografico('aseguradora.rotulo') },
  /**
   * El motivo en `cita.nota` —9.5 / 13, humanista, peso 400—, las tres cifras de la guía. **El
   * color es `DERIVADO`**: la guía no lo declara, y `tinta.secundaria` es lo que el sistema
   * pone en toda línea de esta anatomía. Anotado.
   */
  textoMotivo: { ...estiloTipografico('cita.nota') },
})

// ─── El formato ──────────────────────────────────────────────────────────────

/** II.9 · Denegación o revocación del consentimiento. */
export default function DenegacionConsentimiento({
  medico,
  consultorio,
  panel,
  acento,
  paciente,
  procedimiento,
  firmantes,
  sustitucion,
  motivo,
  folio,
}: DenegacionConsentimientoProps): ReactElement {
  const porSustitucion = sustitucion === true

  /**
   * LOS TRES FIRMANTES. El médico imprime su rúbrica siempre; los otros dos, solo si firmaron.
   * Los renglones bajo la línea salen de I.1.9 y el del médico son sus cédulas, que se toman de
   * `MedicoMembrete` en vez de pedirlas otra vez.
   */
  const firmaMedico: Firma = {
    rol: ROL_MEDICO,
    nombre: firmantes.medico.nombre ?? medico.nombre,
    credenciales: medico.cedulas,
    rubrica: firmantes.medico.rubrica,
  }
  const firmaPaciente: Firma = {
    rol: ROL_PACIENTE,
    nombre: firmantes.paciente.nombre,
    credenciales: [NOTA_PACIENTE],
    rubrica: firmantes.paciente.rubrica,
  }
  const firmaFamiliar: Firma = {
    rol: ROL_FAMILIAR,
    nombre: firmantes.familiar.nombre,
    credenciales: [porSustitucion ? NOTA_FAMILIAR_SUSTITUCION : NOTA_FAMILIAR],
    rubrica: firmantes.familiar.rubrica,
  }

  /**
   * TANTAS COLUMNAS COMO FIRMANTES, UNA SOLA FILA SIEMPRE. Por sustitución la celda del
   * paciente desaparece y quedan dos de 228; sin ella, tres de 142.
   *
   * ⚠ **`columnas` SE PASA Y NO SE DEDUCE DE `firmas.length`.** Es el formato quien sabe cuántas
   * columnas quiere su lámina, y deducirlo en 2.L sería métrica decidida por el contenido en
   * tiempo de render (I.3.4). Aquí las dos cifras salen del mismo sitio —la variante— y por eso
   * se leen juntas. Ver `columnas` en la ficha de 2.L.
   */
  const firmas: readonly Firma[] = porSustitucion
    ? [firmaMedico, firmaFamiliar]
    : [firmaMedico, firmaPaciente, firmaFamiliar]

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
          /*
            EL PROCEDIMIENTO VA ENTERO Y **2.C LO RECORTA A UN RENGLÓN** en esta lámina, que es
            lo único que garantiza la hoja única: si rompiera a dos, el encabezado subiría 14 pt
            y la variante por sustitución solo tiene 26.04 de holgura. Se recorta por
            maquetación y no por caracteres — ver `subtituloRecortado` en 2.C—, y el nombre
            completo se imprime abajo, dentro de la declaración.
          */
          subtitulo: procedimiento,
          paciente,
          folio,
        }}
        /*
          El aire entre lo último del contenido y las firmas: los mismos 12 pt que separan todo
          en este documento. Sin él, 2.N pondría `espacio.16`.
        */
        aireFirma={SEPARACION}
        firmas={
          <BloqueFirmas
            variante="reticula"
            lamina={LAMINA}
            calibracion="compacta"
            columnas={firmas.length}
            firmas={firmas}
          />
        }
      >
        {/*
          ═══ LA DECLARACIÓN ═══

          Marco parcial de 2 pt en acento, **el mismo de la declaración de otorgamiento de
          II.7**: comparten anatomía —426 pt, padding 9 / 12 / 11— y lo que las diferencia es el
          título del documento. Las cifras se leen de `MARCO.declaracion`, donde ya están.

          `wrap={false}` no hace falta aquí: el documento es de una hoja y el marco cabe entero.
          Lo que garantiza esa hoja única es `recortarSubtitulo()`, no un `avoid` que solo
          empujaría el desborde a la hoja siguiente.
        */}
        <View style={estilos.declaracion}>
          <MarcoParcial
            ancho={MARCO.declaracion.ancho}
            padding={MARCO.declaracion.padding}
            grosor={FILETE.acento}
            acento={acento}
          >
            <Text style={estilos.parrafo}>
              {'Yo, '}
              <Text style={estilos.destacado}>{paciente.paciente}</Text>
              {/*
                EL INCISO DEL DIAGNÓSTICO, Y **DESAPARECE ENTERO CUANDO NO HAY DIAGNÓSTICO**:
                sin hueco, sin guion y sin coma doble. La coma que abre el inciso viaja DENTRO
                de él y la que cierra abre el tramo siguiente, así que `Yo, X, declaro…` sale
                bien puntuado en los dos casos. Es la misma fórmula del puente de v1.
              */}
              {tieneValor(paciente.diagnostico) ? (
                <>
                  {', con diagnóstico de '}
                  <Text style={estilos.destacado}>{paciente.diagnostico}</Text>
                </>
              ) : null}
              {', declaro que he sido informado de manera clara y completa sobre el procedimiento '}
              <Text style={estilos.destacado}>{procedimiento}</Text>
              {', sus riesgos, beneficios y alternativas, por el '}
              <Text style={estilos.destacado}>{medico.nombre}</Text>
              {'.'}
            </Text>
            <Text style={estilos.parrafoSiguiente}>{DECLARACION_2}</Text>
            <Text style={estilos.parrafoSiguiente}>{DECLARACION_3}</Text>
          </MarcoParcial>
        </View>

        {/*
          ═══ LA CASILLA DE SUSTITUCIÓN ═══

          Va debajo de la declaración, **fuera del marco**, y en las DOS variantes: lo que
          informa es que existe la posibilidad y si se ejerció. Una casilla que solo apareciera
          al marcarse no diría nada del caso normal. Es la regla que ya sigue II.7.
        */}
        <View style={estilos.filaCasilla}>
          <View style={estilos.casilla}>
            {porSustitucion ? <View style={estilos.marcaCasilla} /> : null}
          </View>
          <Text style={estilos.textoCasilla}>{TEXTO_SUSTITUCION}</Text>
        </View>

        {/*
          ═══ LA CONSTANCIA DEL MOTIVO — SOLO POR SUSTITUCIÓN ═══

          Responde en el texto a por qué el paciente no firma, que es lo que un tercero pregunta
          al ver una hoja firmada por otro. En la variante en que el paciente firma no hay nada
          que constatar, y por eso el bloque no existe en ella en vez de salir vacío.

          `wrap={false}`: el rótulo y su línea son una sola cosa.
        */}
        {porSustitucion ? (
          <View style={estilos.constancia} wrap={false}>
            <Text style={estilos.rotuloMotivo}>{ROTULO_MOTIVO.toUpperCase()}</Text>
            <Text style={estilos.textoMotivo}>
              {tieneValor(motivo) ? motivo : MOTIVO_POR_DEFECTO}
            </Text>
          </View>
        ) : null}
      </MotorFlujo>

      {/*
        Variante `completo`: folio · paginación · leyenda, con el prefijo `DEN`. **Sin QR**: el
        documento no autoriza nada, es la constancia de que no se autorizó. La paginación es
        siempre `Página 1 de 1` — no hay anexo que la abra.
      */}
      <PieDocumento variante="completo" folio={folio} acento={acento} />
    </Page>
  )
}
