/**
 * Sistema de documentos v2 — formato II.7 · **Consentimiento Informado**.
 *
 * FUENTE DE VERDAD: **las coordenadas medidas de la lámina aprobada**, con
 * `DOCUMENTOS_SPEC.md` II.7 como segunda lectura. Donde las dos difieren manda la lámina.
 *
 * EL MÁS COMPLEJO DEL SISTEMA, Y CADA UNA DE SUS PARTES LO ES POR UN MOTIVO DISTINTO
 *
 *   encabezado    **511.6 pt**, más del doble que el segundo: mete un bloque de
 *                 fundamento legal entre el título y el riel
 *   riel          ocho celdas en CUATRO filas, sin sexo y con un campo vacío requerido
 *   cuerpo        siete secciones de texto corrido, dos de ellas con zona de escritura
 *   firmas        cinco firmantes en TRES niveles de jerarquía, repartidos en dos hojas
 *   anexo         una hoja más, y **solo si hay al menos una fotografía**
 *
 * ⚠⚠ **EXCEPCIÓN DECLARADA A I.3.2 — ESTE FORMATO COMPONE SU TEXTO CORRIDO JUSTIFICADO.**
 *
 * I.3.2 prohíbe el texto justificado **sin excepción en todo el sistema**, y `D33` lo llevaba
 * reportado desde la conciliación porque esta lámina era el último sitio que lo componía.
 * **Angel comparó las dos versiones en papel y decidió el justificado para II.7.** Los otros
 * siete formatos siguen en bandera izquierda y la prohibición sigue en pie para ellos: esto
 * es una excepción de UN formato, declarada, no una relajación del chasis.
 *
 * **POR QUÉ TODO EL TEXTO CORRIDO Y NO SOLO LAS SIETE SECCIONES.** La lámina justifica las
 * secciones y deja en bandera el fundamento legal y la declaración, que viven en la misma
 * hoja y a dos cuerpos de distancia. Eso no es una decisión de diseño: es que la corrección
 * a bandera se aplicó a medias en su día. Un documento con dos alineaciones de párrafo se
 * lee como dos documentos grapados, así que la excepción se aplica al CUERPO ENTERO.
 *
 * **QUÉ SE JUSTIFICA Y QUÉ NO.** Solo texto corrido:
 *
 *     SÍ   los siete párrafos de sección · el fundamento legal · los tres párrafos de la
 *          declaración · las dos entradillas de las zonas de escritura
 *     NO   rótulos de bloque y de nivel · notas de firmante · pies de foto · la leyenda
 *          del recuadro sin fotografía · la entradilla del anexo
 *
 * El criterio es que **justificar una línea suelta no hace nada y justificar un rótulo lo
 * estropea**: el justificado reparte el sobrante de la línea, y una línea que no llega al
 * final de la caja no tiene sobrante que repartir. La entradilla del anexo compone un solo
 * renglón a 486 pt y por eso se queda fuera aunque sea prosa.
 *
 * ⚠ **LA PARTICIÓN SIGUE DESACTIVADA Y ESO NO CAMBIA.** `fonts.ts` registra un
 * `registerHyphenationCallback` que devuelve la palabra entera, por el gate de I.3.1. La
 * lámina compone `hyphens: auto`; aquí el justificado solo puede estirar espacios, y a 381
 * pt de medida —la más estrecha del sistema— los huecos se notan. **Es lo que Angel miró
 * antes de decidir**, no un efecto que se le escape.
 *
 * ⚠ **`D28` NO SE MUEVE.** Las notas de la cotización (II.5) siguen en bandera: aquella
 * divergencia se compuso a medias a propósito —el cuerpo sí, la justificación no— y esta
 * decisión es de II.7, no del sistema.
 *
 * **SALEN SEIS HOJAS, LAS DE LA LÁMINA.** Justificar no cambia dónde corta cada renglón —el
 * algoritmo de corte es el mismo y solo se reparte el sobrante—, así que el documento no
 * repagina: medido sobre el PDF con las dos alineaciones, las dos dan seis y el mismo
 * reparto por hoja. Fundamento y §1 en la 1, la declaración y el otorgamiento en la 4, los
 * otros dos niveles en la 5 y el anexo en la 6.
 *
 * **No se ha ajustado nada para llegar a esa cifra.** Si un día un texto crece y salen
 * siete, la respuesta es actualizar la prueba, no apretar el interlineado: eso es mover una
 * medida para cuadrar una hoja, que es lo que I.3.4 prohíbe.
 *
 * EL PRESUPUESTO DEL ENCABEZADO, SUMADO Y NO DECLARADO
 *
 * La lámina mide **511.6 pt** desde el margen de 54. Como en los seis anteriores, eso no es
 * una constante que copiar: es la suma de sus bloques.
 *
 *     fila superior del membrete    56       (el panel; la lámina la mide en 58.85)
 *     aire                           8       `transicion.membreteFilete`
 *     filete principal               2.5
 *     aire                           6       `transicion.membreteLineaFina`
 *     banda de dirección            12       UN renglón, sin cédulas
 *     espaciador de cierre          20       ← 2.B, valor único del sistema
 *     bloque de título              56       título a DOS líneas (40) + 2 + subtítulo 14
 *     aire                           4       `transicion.tituloFilete`, el del chasis
 *     filete del título              2.5
 *     aire                          18       ← 2.C, el mayor del sistema
 *     fundamento legal             116       (2 + 8 + rótulo 15 + 6 renglones de 13.5 + 10)
 *     aire                          24
 *     rótulo `Datos de identificación`  13
 *     aire                           5
 *     riel de identificación       136.385   (0.63 + 33 + 0.375 + 33 + 0.375 + 33 + 0.375 + 35 + 0.63)
 *     aire                          28
 *                                 ─────────
 *                                 507.385
 *
 * ⚠ **HAY QUE LEERLO CON EL FAMILIAR VACÍO, QUE ES COMO LO COMPONE LA LÁMINA.** Con dato, la
 * celda del familiar mide 33; con la línea de escritura de su estado «vacío requerido» mide
 * 35.47, y el riel sube a **138.855**. Esa es la cifra que se compara.
 *
 *     507.385  + 2.47 (la línea del familiar) + 2.85 (el panel)  =  **512.705**
 *
 * contra los **511.6** medidos: **1.105 pt de sobra**, y no hay que buscarlos. Son lo que el
 * bloque de fundamento compone de más —116 contra los 114.9 de la lámina— y esa diferencia
 * es la consecuencia directa de `D33`: su párrafo compone seis renglones en bandera donde el
 * HTML compone seis justificados con otro reparto de palabras. **El resto del presupuesto
 * cierra al punto**: el bloque de título, sus dos filetes y el riel dan la cota exacta de la
 * lámina sumando solo el hueco del panel, que es la SÉPTIMA lámina que lo mide en 58.85.
 *
 * LAS OCHO COSAS QUE ESTA LÁMINA CONTRADICE, Y QUÉ SE COMPONE
 *
 * a. **EL TÍTULO — DECIDIDO, Y GANA II.7.** La lámina imprime `CONSENTIMIENTO MÉDICO
 *    INFORMADO`, sin «Carta de»; se compone `CARTA DE CONSENTIMIENTO INFORMADO` porque es el
 *    término con que la NOM-004 nombra la pieza del expediente y el que más se lee en sede
 *    legal. Es la única divergencia de este formato con consecuencia legal y no de
 *    maquetación. `CONCILIA D32` queda **resuelto**, no reportado. Ver `TITULO`.
 * b. **El texto corrido justificado** (`D33`), arriba: excepción declarada a I.3.2.
 * c. **El renglón de escritura mide 15.5 y `manuscrito.alto` son 20.** Es el quinto valor
 *    del sistema para el mismo token —20, 16.47, 13, 11 y 15.5—, y `D27` lo lleva reportado
 *    desde la conciliación. Se compone el medido.
 * d. **Dos aires entre secciones para lo mismo:** 8 en las secciones que la lámina pone en
 *    su hoja 2 y 20 en las de su hoja 3. Se compone el de cada sección **según la hoja de
 *    la lámina**, no según dónde caiga aquí: con el texto en bandera la repaginación mueve
 *    las secciones, y hacer depender un aire de en qué hoja cae sería métrica decidida por
 *    el contenido (I.3.4). Reportado.
 * e. **Tres espaciadores de cabecera de continuación** —26, 12 y 20— en el mismo documento.
 *    Se componen los tres, por hoja. Ver `HOJAS_PROPIAS`.
 * f. **El aviso de pie es el del chasis.** La lámina compone `El consentimiento continúa en
 *    la hoja 2` en **una sola zona**, sin la derecha; 2.N compone dos para los siete
 *    formatos (`CONCILIA D5, D22`) y no las recibe por prop. Reportado, no compuesto.
 * g. **El bloque de constancia de motivo NO se compone.** La lámina lo declara para la
 *    variante por sustitución con **borde en los cuatro lados y fondo**, que es lo único
 *    del sistema con esa anatomía y lo que `D34` prohíbe: el chasis solo declara marcos
 *    parciales. El paso 4.7 no lo lista entre sus cadenas. Reportado, no compuesto.
 * h. **La marca de estado no se compone**, por decisión de producto: no está instanciada en
 *    ninguna de las diez láminas del formato y las dos versiones que existen en otros
 *    archivos difieren entre sí. II.7 §1 la declara (`D36`). Se decide con su lámina.
 *
 * LAS CINCO DECISIONES DE PRODUCTO, YA TOMADAS
 *
 * 1. **Cinco firmantes**: médico, paciente, familiar o responsable y dos testigos. El
 *    anestesiólogo entrega su propio consentimiento y no aparece (`D-anestesiólogo`).
 * 2. **La rúbrica del médico se renderiza SIEMPRE**; las otras cuatro, solo si esa persona
 *    firmó en pantalla. El mismo documento puede mezclar las dos cosas, y por eso la
 *    rúbrica entra por firmante y no por documento.
 * 3. **Sin firmar se imprime en blanco.** No hay leyenda de «pendiente» en el papel: el
 *    aviso vive en pantalla. Es la regla 2 de 2.E aplicada a la firma.
 * 4. **Ni la firma ni la fotografía bloquean la emisión.**
 * 5. **La hoja de anexo solo existe si hay al menos una fotografía.** El tipo y el número
 *    de identificación se imprimen igual, con foto y sin ella.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import type { ConsultorioMembrete, MedicoMembrete } from '../Membrete'
import type { PanelCircularProps } from '../PanelCircular'
import type { ValoresPaciente } from '../BloquePaciente'
import BloqueFirmas, { type Firma } from '../BloqueFirmas'
import MarcoParcial, { MARCO } from '../MarcoParcial'
import MotorFlujo, { type HojaPropia } from '../MotorFlujo'
import PieDocumento from '../PieDocumento'
import { tieneValor } from '../Campo'
import {
  CAJA,
  ESPACIO,
  FILETE,
  FILETE_CONSENTIMIENTO,
  MARGEN,
  PAPEL,
  RETICULA,
  TINTA,
  estiloTipografico,
  type AcentoResuelto,
} from '../tokens'

/** La lámina que fija la composición de los componentes del chasis en este formato. */
const LAMINA = 'consentimiento' as const

// ─── Cadenas ─────────────────────────────────────────────────────────────────

/**
 * EL TÍTULO — **el de II.7, no el de la lámina**. Decisión de Angel, tomada.
 *
 * La lámina imprime `Consentimiento médico informado`, sin «Carta de». Se compone el término
 * de la NOM-004 porque es el que nombra la pieza del expediente y **el que más se lee en
 * sede legal**: que el título del documento coincida con el de la norma pesa más que la
 * preferencia tipográfica de la lámina. Es `CONCILIA D32` resuelto, ya no reportado.
 */
const TITULO = 'Carta de consentimiento informado'

/** Los tres rótulos de bloque, textuales de la lámina. */
const ROTULO_FUNDAMENTO = 'Fundamento legal'
const ROTULO_IDENTIFICACION = 'Datos de identificación'
const ROTULO_DECLARACION = 'Declaración de consentimiento'
const ROTULO_ANEXO = 'Anexo · Identificación de firmantes'

/** El fundamento legal, textual. Cita la norma que obliga a este documento a existir. */
const FUNDAMENTO =
  'De conformidad con la Norma Oficial Mexicana NOM-004-SSA3-2012 del Expediente Clínico, la Ley General de Salud (Art. 80 y 81) y el Reglamento de la Ley General de Salud en Materia de Prestación de Servicios de Atención Médica (Art. 80), este documento informa al paciente o a su representante legal sobre el procedimiento propuesto, sus riesgos, beneficios y alternativas, a fin de obtener su consentimiento libre, voluntario e informado.'

/** Las dos entradillas de las zonas de escritura, textuales. */
const ENTRADILLA_DESCRIPCION =
  'A completar por el médico tratante, en términos comprensibles para el paciente.'
const ENTRADILLA_RIESGOS =
  'Derivados de la localización anatómica y de las condiciones particulares del paciente. Se le han explicado de forma verbal y se detallan a continuación.'

/** La casilla de sustitución, textual. */
const TEXTO_SUSTITUCION =
  'El paciente no puede firmar por sí mismo; firma en su lugar el familiar o responsable, cuyos datos se asientan en el recuadro de la derecha.'

/** Los cinco roles de firmante y las tres notas, textuales. */
const ROL_MEDICO = 'Médico tratante'
const ROL_PACIENTE = 'Paciente'
const ROL_FAMILIAR = 'Familiar o responsable'
const ROL_TESTIGO_1 = 'Testigo 1'
const ROL_TESTIGO_2 = 'Testigo 2'
const NOTA_PACIENTE = 'Nombre y firma'
const NOTA_FAMILIAR = 'Representante del paciente'
const NOTA_TESTIGO = 'Mayor de edad'

/** El campo que solo cuelga de la celda del familiar. */
const ROTULO_PARENTESCO = 'Parentesco con el paciente'

/** Los tres rótulos de nivel. El 3 pasa a ser 2 en la variante por sustitución. */
const NIVEL_OTORGAMIENTO = 'Otorgamiento'
const NIVEL_REPRESENTACION = 'Representación'
const NIVEL_TESTIGOS = 'Testigos'

/** Entradilla y leyenda del anexo, textuales. */
const ENTRADILLA_ANEXO =
  'Reproducción de la identificación oficial del paciente y de las personas que firman el consentimiento.'
const SIN_FOTOGRAFIA =
  'No se capturó fotografía de la identificación de este firmante.'

/**
 * LOS TRES PÁRRAFOS DE LA DECLARACIÓN, que el formato REDACTA porque llevan datos dentro.
 *
 * La lámina destaca dos menciones con peso **500** —no 600—: el nombre del paciente y el
 * procedimiento. Son las dos cosas que un tercero busca al leer la hoja, y por eso el
 * destaque no es decorativo. Van como `Text` anidado, que es como react-pdf compone un
 * tramo con otro peso dentro de un párrafo.
 */
const DECLARACION_2 =
  'He tenido la oportunidad de hacer preguntas y todas han sido respondidas a mi satisfacción. Comprendo que ningún procedimiento médico está libre de riesgos y que los resultados no pueden ser garantizados.'
const DECLARACION_3 =
  'Por lo anterior, otorgo mi consentimiento libre, voluntario e informado para la realización del procedimiento descrito, así como para los procedimientos adicionales que pudieran ser necesarios durante el acto quirúrgico por hallazgos transoperatorios.'

// ─── Separaciones de primer nivel ────────────────────────────────────────────

/**
 * SEPARACIÓN ENTRE BLOQUES DE PRIMER NIVEL, medida en la lámina aprobada.
 *
 * Mismo criterio que en los seis formatos anteriores: I.1.7 no nombra ninguna de estas
 * parejas, así que gobierna la ESCALA y el formato declara qué miembro usa (§0). Ninguna es
 * literal y ninguna es miembro nuevo.
 *
 *   filete del título → fundamento    **18**   lo aporta 2.C, no este archivo
 *   fundamento → rótulo del riel      **24**
 *   rótulo → riel                     ** 5**
 *   riel → §1                         **28**
 *   entre secciones                   ** 8** y **20**   ver el punto (d) de la cabecera
 *   rótulo → declaración              ** 8**
 *   declaración → casilla             **12**
 *   casilla → nivel                   **12**
 *   nivel → celdas                    ** 6**
 *   celdas → nivel                    **12**
 *   espaciador del anexo              **20**   lo aporta 2.B, por hoja
 *
 * **Faltan tres parejas y las tres faltan porque ya están declaradas en el chasis:**
 * membrete → título es el espaciador de 2.B —20 en esta lámina—, título → filete es
 * `transicion.tituloFilete` y filete → cuerpo es el aire de 2.C. Sumar cualquiera aquí la
 * contaría dos veces.
 *
 * **Y faltan los dos ceros de las hojas 2 y 4**, que también son medidas: la cabecera de
 * continuación cierra pegada a lo que sigue. Un salto de hoja arranca en el borde de la
 * caja, así que el cero sale solo — no hay nada que declarar y por eso no hay constante.
 */
const SEPARACION_FUNDAMENTO_ROTULO = ESPACIO[24]
const SEPARACION_ROTULO_RIEL = ESPACIO[5]
const SEPARACION_RIEL_SECCION = ESPACIO[26] + ESPACIO[2]
const SEPARACION_SECCIONES_HOJA_2 = ESPACIO[8]
const SEPARACION_SECCIONES_HOJA_3 = ESPACIO[20]
const SEPARACION_ROTULO_DECLARACION = ESPACIO[8]
const SEPARACION_DECLARACION_CASILLA = ESPACIO[12]
const SEPARACION_CASILLA_NIVEL = ESPACIO[12]
const SEPARACION_NIVEL_CELDAS = ESPACIO[5] + 1
const SEPARACION_CELDAS_NIVEL = ESPACIO[12]

/**
 * ⚠ **DOS SEPARACIONES QUE NO SON MIEMBROS DE LA ESCALA Y SE COMPONEN COMO SUMA.**
 *
 * `riel → §1` son 28 y `nivel → celdas` son 6: ni 28 ni 6 están en `ESPACIO`, y la escala
 * ya creció cinco veces por esta misma puerta —2, 5, 10, 14, 20 y 26 entraron así—. Aquí no
 * se añaden dos miembros más por una razón concreta: **los dos son sumas exactas de
 * miembros que ya existen** —26 + 2 y 5 + 1— y ninguno de los dos separa nada que un
 * segundo formato vaya a repetir. Un miembro de escala con un solo consumidor es deuda, que
 * es lo que ya dicen las notas de `entradaMedicamento.viaOral` y del tramo de 28 pt de
 * firma. Si un segundo formato mide 28 o 6, suben a la escala con nombre propio.
 */

/** Geometría de las siete secciones clínicas y de sus zonas de escritura. */
const SECCION = {
  /** Padding sobre el filete que abre cada sección. */
  paddingSuperior: 7,
  /** Aire entre el título de la sección y su párrafo. */
  aireParrafo: 7,
  /** Caja de texto de las cinco secciones de solo prosa. */
  caja: 381,
  /** Caja de las dos que llevan zona de escritura: la fila entera menos el riel. */
  cajaAncha: CAJA.ancho - RETICULA.riel - RETICULA.medianil,
  /** Aire entre la entradilla de la zona y el primer renglón. */
  aireZona: ESPACIO[8],
} as const

/**
 * EL RENGLÓN DE ESCRITURA — **15.5 pt**, con regla de `filete.regla` en `tinta.hairline`.
 *
 * ⚠ **`manuscrito.alto` SON 20 Y B.7 §3 LEE 16.** Es el quinto valor del sistema para el
 * mismo token y se compone el que manda el paso 4.7. Ver el punto (c) de la cabecera.
 *
 * **Los mínimos se llenan con renglones enteros y el resto queda en blanco**, que es lo que
 * hace el `repeating-linear-gradient` de la lámina: en una caja de 96 con renglón de 15.5
 * caben seis reglas y sobran 3 pt. Redondear hacia arriba estiraría la zona por encima de
 * su mínimo, que es lo contrario de lo que un `min-height` declara.
 */
const RENGLON = { alto: 15.5, grosor: FILETE.regla } as const

/** Geometría de la retícula de firmas y de sus rótulos de nivel. */
const NIVEL = {
  /** Rótulo de nivel: número, rótulo y filete que cierra la fila. Mide 13. */
  medianil: ESPACIO[8],
  /** Alto de la línea de parentesco, bajo su rótulo. Ver `GEOMETRIA.anadido` en 2.L. */
  parentesco: 13,
} as const

/** Geometría del anexo. */
const ANEXO = {
  /** Celda de la retícula: `(486 − 30) / 2`. La misma que la de firmas. */
  celda: (CAJA.ancho - 30) / 2,
  medianil: 30,
  /** Aire entre filas de la retícula. */
  aireFilas: ESPACIO[20],
  /** Aire entre el filete de acento y lo que tiene encima. */
  aireFilete: ESPACIO[5],
  /**
   * Caja de fotografía: **228 × 144**, proporción 1.583 — cercana a la de una credencial
   * para votar mexicana, que es lo que casi siempre se fotografía.
   */
  altoFoto: 144,
  /** Sangría lateral de la leyenda cuando no hay fotografía. */
  sangriaSinFoto: 24,
  /** Aire entre la caja y su pie de dos zonas. */
  airePie: ESPACIO[4],
} as const

// ─── Props ───────────────────────────────────────────────────────────────────

/**
 * Un firmante. **La rúbrica es por persona**, no por documento: el médico la lleva siempre
 * y los otros cuatro solo si firmaron en pantalla (decisión de producto 2).
 */
export interface FirmanteConsentimiento {
  /** Nombre de quien firma. Sin él, el renglón se reserva para llenarlo a mano. */
  readonly nombre?: string
  /** Trazo capturado, ya normalizado a PNG o JPG por quien llama (I.3.8). */
  readonly rubrica?: string
}

/** Una identificación del anexo. Su fotografía es lo único opcional. */
export interface IdentificacionAnexo {
  /** Rol de la persona, con la misma cadena que su celda de firma. */
  readonly rol: string
  readonly nombre: string
  /** Tipo de identificación: `Credencial para votar`. */
  readonly tipo: string
  /** Número o clave del documento. */
  readonly numero: string
  /**
   * Ráster de la identificación, ya normalizado a PNG o JPG. **Sin ella el recuadro se
   * compone igual**, con su leyenda y con el tipo y el número: lo que desaparece es la
   * imagen, no el dato.
   */
  readonly foto?: string
}

/**
 * Los siete textos clínicos. **Los prellena la plantilla y los edita el médico**, así que
 * entran como datos: este archivo no los inventa.
 *
 * `descripcion` y `riesgosEspecificos` bloquean emisión en el formulario (II.7 §2); las
 * otras cinco colapsan su sección entera si no vienen.
 */
export interface SeccionesConsentimiento {
  readonly preoperatorio?: string
  readonly beneficios?: string
  readonly anestesia?: string
  readonly descripcion?: string
  readonly riesgosComunes?: string
  readonly riesgosEspecificos?: string
  readonly alternativas?: string
}

export interface ConsentimientoInformadoProps {
  readonly medico: MedicoMembrete
  /** Consultorio activo, leído por quien construye el documento (I.3.6, P2-3). */
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  /**
   * Los datos del riel. Este formato usa OCHO celdas en cuatro filas y **no tiene sexo**;
   * `familiar` es campo vacío requerido y conserva su línea si no viene.
   */
  readonly paciente: ValoresPaciente
  /** El procedimiento, que va como subtítulo del documento. Bloquea emisión (II.7 §2). */
  readonly procedimiento: string
  readonly secciones: SeccionesConsentimiento
  /** Los cinco firmantes. El médico es el único cuya rúbrica se imprime siempre. */
  readonly firmantes: {
    readonly medico: FirmanteConsentimiento
    readonly paciente: FirmanteConsentimiento
    readonly familiar: FirmanteConsentimiento
    readonly testigo1: FirmanteConsentimiento
    readonly testigo2: FirmanteConsentimiento
  }
  /**
   * VARIANTE POR SUSTITUCIÓN: el paciente no puede firmar y firma el familiar en su lugar.
   *
   * Cambia tres cosas a la vez: la casilla sale marcada, el familiar ocupa la segunda celda
   * del nivel 1, y **el nivel 2 desaparece entero** — ya firmó arriba—, con lo que Testigos
   * se renumera a 2. Es una variante por sustitución, no por adición: no hay nada que
   * añadir, hay un nivel que se va.
   */
  readonly sustitucion?: boolean
  /**
   * Las identificaciones del anexo. **La hoja solo se imprime si al menos una trae
   * fotografía** (decisión de producto 5); sin ninguna, el documento cierra en las firmas.
   */
  readonly identificaciones?: readonly IdentificacionAnexo[]
  /** Folio del documento, ya generado. Prefijo `C-` en la lámina. */
  readonly folio: string
}

// ─── Estilos ─────────────────────────────────────────────────────────────────

/**
 * LA EXCEPCIÓN A I.3.2, EN UN SOLO SITIO Y CON NOMBRE.
 *
 * Se esparce en los cinco estilos de texto corrido del formato en vez de escribirse cinco
 * veces, por dos razones: para que `grep -rn "'justify'" src/lib/pdf/v2` devuelva **una**
 * línea —esta— y se vea de un vistazo que la excepción vive en un solo sitio, y para que
 * revertirla, si algún día se revierte, sea borrar esta constante y sus cinco `...JUSTIFICADO`.
 *
 * **No lo copies a ningún otro archivo.** Ver la cabecera: la prohibición sigue en pie para
 * los otros siete formatos.
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

  // ── Fundamento legal y rótulos de bloque
  rotuloFundamento: { ...estiloTipografico('rotulo.bloque') },
  /**
   * Sin aire respecto de su rótulo. **El cero es la composición del sistema para una pila
   * de rótulo y valor** —la celda de 2.F, el campo de 2.E, la celda de folio de 2.C y el
   * bloque de cita de II.4— y la lámina no mide ninguna separación aquí.
   * `DERIVADO POR PRECEDENTE`.
   */
  cuerpoFundamento: { ...estiloTipografico('fundamento.cuerpo'), ...JUSTIFICADO },
  rotuloRiel: {
    ...estiloTipografico('rotulo.riel'),
    marginTop: SEPARACION_FUNDAMENTO_ROTULO,
    marginBottom: SEPARACION_ROTULO_RIEL,
  },
  rotuloBloque: { ...estiloTipografico('rotulo.bloque') },

  // ── Las siete secciones clínicas
  /**
   * El filete que abre cada sección: 0.63 en tinta plena, a todo el ancho de la caja. El
   * cuerpo no ocupa esos 486 —la caja de texto son 381—, y esa es la diferencia entre lo
   * que ENMARCA la sección y lo que la sección compone.
   */
  seccion: {
    width: CAJA.ancho,
    borderTopWidth: FILETE_CONSENTIMIENTO.regla,
    borderTopColor: TINTA.negra,
    paddingTop: SECCION.paddingSuperior,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  /** La misma anatomía de riel que 2.G, 2.J, 2.P y 2.Q: una columna exacta de retícula. */
  rielSeccion: {
    width: RETICULA.riel,
    marginRight: RETICULA.medianil,
    flexShrink: 0,
  },
  cajaSeccion: { width: SECCION.caja },
  cajaSeccionAncha: { width: SECCION.cajaAncha },
  numeroSeccion: { ...estiloTipografico('seccion.numero') },
  tituloSeccion: { ...estiloTipografico('titulo.seccion') },
  parrafoSeccion: {
    ...estiloTipografico('seccion.parrafo'),
    marginTop: SECCION.aireParrafo,
    ...JUSTIFICADO,
  },
  /** La entradilla de la zona de escritura: mismo cuerpo, tinta secundaria. */
  entradillaZona: {
    ...estiloTipografico('seccion.entradilla'),
    width: SECCION.caja,
    marginTop: SECCION.aireParrafo,
    ...JUSTIFICADO,
  },
  zonaEscritura: { marginTop: SECCION.aireZona },
  renglon: {
    height: RENGLON.alto,
    borderBottomWidth: RENGLON.grosor,
    borderBottomColor: TINTA.hairline,
  },

  // ── Declaración y casilla
  declaracion: { marginTop: SEPARACION_ROTULO_DECLARACION },
  parrafoDeclaracion: { ...estiloTipografico('seccion.parrafo'), ...JUSTIFICADO },
  parrafoDeclaracionSiguiente: {
    ...estiloTipografico('seccion.parrafo'),
    marginTop: ESPACIO[5] + 1,
    ...JUSTIFICADO,
  },
  /** Las dos menciones destacadas van en peso 500, no 600. Ver `DECLARACION_2`. */
  destacado: { fontWeight: 500 },
  filaCasilla: {
    width: MARCO.declaracion.ancho,
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: SEPARACION_DECLARACION_CASILLA,
  },
  /**
   * La casilla: 9 × 9 con borde de `filete.fino` y una marca sólida de 5 × 5 dentro. **No
   * es una tipografía de check**: un glifo de palomita dependería de la fuente y no está en
   * ninguna de las dos familias del sistema.
   */
  casilla: {
    width: 9,
    height: 9,
    borderWidth: FILETE.fino,
    borderColor: TINTA.negra,
    marginRight: 7,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  marcaCasilla: { width: 5, height: 5, backgroundColor: TINTA.negra },
  textoCasilla: { ...estiloTipografico('casilla.texto'), flex: 1 },

  // ── Rótulos de nivel y retícula de firmas
  nivel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SEPARACION_NIVEL_CELDAS,
  },
  numeroNivel: {
    ...estiloTipografico('nivel.numero'),
    marginRight: NIVEL.medianil,
  },
  rotuloNivel: {
    ...estiloTipografico('firma.rol'),
    marginRight: NIVEL.medianil,
  },
  /** El filete que cierra la fila del rótulo: se come lo que sobre. */
  fileteNivel: {
    flex: 1,
    height: FILETE.regla,
    backgroundColor: TINTA.hairline,
  },
  bloqueNivel: { marginTop: SEPARACION_CASILLA_NIVEL },
  bloqueNivelSiguiente: { marginTop: SEPARACION_CELDAS_NIVEL },
  /** Rótulo y línea del parentesco, lo único que cuelga bajo una nota de firma. */
  rotuloParentesco: { ...estiloTipografico('aseguradora.rotulo') },
  lineaParentesco: {
    height: NIVEL.parentesco,
    borderBottomWidth: FILETE.regla,
    borderBottomColor: TINTA.negra,
  },

  // ── Anexo
  rotuloAnexo: {
    ...estiloTipografico('rotulo.bloque'),
  },
  entradillaAnexo: {
    ...estiloTipografico('cita.nota'),
    width: CAJA.ancho,
    marginTop: ESPACIO[4],
  },
  filaAnexo: {
    flexDirection: 'row',
    marginTop: ANEXO.aireFilas,
  },
  celdaAnexo: { width: ANEXO.celda },
  celdaAnexoSiguiente: { marginLeft: ANEXO.medianil },
  cabeceraAnexo: { flexDirection: 'row', alignItems: 'flex-start' },
  rielAnexo: {
    width: RETICULA.riel,
    marginRight: RETICULA.medianil,
    flexShrink: 0,
  },
  numeroAnexo: { ...estiloTipografico('seccion.numero') },
  rolAnexo: { ...estiloTipografico('firma.rol') },
  nombreAnexo: { ...estiloTipografico('anexo.nombre') },
  /** El filete de acento que abre la caja de foto. Es su borde superior. */
  fileteAnexo: {
    height: FILETE.acento,
    marginTop: ANEXO.aireFilete,
  },
  /**
   * La caja de fotografía. **Sin borde superior**: ese lado lo pone el filete de acento, y
   * dibujar los dos daría una línea doble donde la lámina tiene una.
   */
  cajaFoto: {
    height: ANEXO.altoFoto,
    borderLeftWidth: FILETE.regla,
    borderRightWidth: FILETE.regla,
    borderBottomWidth: FILETE.regla,
    borderColor: TINTA.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  conFoto: { backgroundColor: TINTA.papelTenue },
  sinFoto: { paddingHorizontal: ANEXO.sangriaSinFoto },
  /** La imagen no se estira: conserva su proporción dentro de la caja. */
  foto: { width: '100%', height: '100%', objectFit: 'contain' },
  leyendaSinFoto: { ...estiloTipografico('anexo.pie'), textAlign: 'center' },
  pieAnexo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: ANEXO.airePie,
  },
  textoPie: { ...estiloTipografico('anexo.pie') },
})

// ─── Composición ─────────────────────────────────────────────────────────────

/** Una sección clínica declarada: su número, su título y de dónde sale su texto. */
interface SeccionClinica {
  readonly numero: number
  readonly titulo: string
  readonly clave: keyof SeccionesConsentimiento
  /** Separación respecto de la sección anterior. Ver el punto (d) de la cabecera. */
  readonly separacion: number
  /** Las dos que llevan zona de escritura, con su entradilla y su mínimo. */
  readonly zona?: { readonly entradilla: string; readonly minimo: number }
}

/**
 * LAS SIETE SECCIONES, en el orden literal de la lámina.
 *
 * La separación de cada una es la que su hoja usa en la lámina: 8 en la que agrupa §2 a §4
 * y 20 en la que agrupa §5 a §7. §1 no lleva ninguna — abre el cuerpo detrás del riel, con
 * los 28 pt que declara `SEPARACION_RIEL_SECCION`.
 */
const SECCIONES: readonly SeccionClinica[] = [
  { numero: 1, titulo: 'Preoperatorio', clave: 'preoperatorio', separacion: 0 },
  { numero: 2, titulo: 'Beneficios esperados', clave: 'beneficios', separacion: SEPARACION_SECCIONES_HOJA_2 },
  { numero: 3, titulo: 'Anestesia', clave: 'anestesia', separacion: SEPARACION_SECCIONES_HOJA_2 },
  {
    numero: 4,
    titulo: 'Descripción del procedimiento',
    clave: 'descripcion',
    separacion: SEPARACION_SECCIONES_HOJA_2,
    zona: { entradilla: ENTRADILLA_DESCRIPCION, minimo: 96 },
  },
  { numero: 5, titulo: 'Riesgos comunes', clave: 'riesgosComunes', separacion: SEPARACION_SECCIONES_HOJA_3 },
  {
    numero: 6,
    titulo: 'Riesgos específicos',
    clave: 'riesgosEspecificos',
    separacion: SEPARACION_SECCIONES_HOJA_3,
    zona: { entradilla: ENTRADILLA_RIESGOS, minimo: 64 },
  },
  { numero: 7, titulo: 'Alternativas de tratamiento', clave: 'alternativas', separacion: SEPARACION_SECCIONES_HOJA_3 },
]

/**
 * LA ZONA DE ESCRITURA — renglones enteros dentro del mínimo declarado.
 *
 * Los saltos de línea del texto se respetan tal cual: la prosa de estas dos secciones la
 * escribe el médico y no pasa por ningún analizador. Ver `RENGLON`.
 */
function ZonaEscritura({ minimo }: { minimo: number }): ReactElement {
  const renglones = Math.floor(minimo / RENGLON.alto)
  return (
    <View style={[estilos.zonaEscritura, { height: minimo }]}>
      {Array.from({ length: renglones }, (_, i) => (
        // El índice ES la identidad: son renglones vacíos y su orden es lo único que los
        // distingue.
        <View key={i} style={estilos.renglon} />
      ))}
    </View>
  )
}

/**
 * UNA SECCIÓN CLÍNICA: filete, número colgado del riel, título al lado y su prosa debajo.
 *
 * ⚠ **LAS DE PROSA LLEVAN `wrap={false}` Y LAS DE ZONA DE ESCRITURA NO.** Es lo que declara
 * B.7 §3 y es lo correcto: una sección de cinco renglones que se parte en dos hojas deja el
 * título huérfano, y una con 96 pt de renglones para escribir a mano **tiene** que poder
 * partirse o no cabría en ninguna hoja junto a su prosa.
 */
function Seccion({
  seccion,
  texto,
  primera,
}: {
  seccion: SeccionClinica
  texto: string
  primera: boolean
}): ReactElement {
  const conZona = seccion.zona !== undefined
  return (
    <View
      style={[
        estilos.seccion,
        { marginTop: primera ? SEPARACION_RIEL_SECCION : seccion.separacion },
      ]}
      wrap={conZona}
    >
      <View style={estilos.rielSeccion}>
        <Text style={estilos.numeroSeccion}>{seccion.numero}</Text>
      </View>
      <View style={conZona ? estilos.cajaSeccionAncha : estilos.cajaSeccion}>
        <Text style={estilos.tituloSeccion}>{seccion.titulo.toUpperCase()}</Text>
        {conZona ? (
          <>
            <Text style={estilos.entradillaZona}>{seccion.zona?.entradilla}</Text>
            {tieneValor(texto) ? (
              <Text style={[estilos.parrafoSeccion, estilos.cajaSeccion]}>{texto}</Text>
            ) : null}
            <ZonaEscritura minimo={seccion.zona?.minimo ?? 0} />
          </>
        ) : (
          <Text style={estilos.parrafoSeccion}>{texto}</Text>
        )}
      </View>
    </View>
  )
}

/** El rótulo de un nivel de firma: número, rótulo y el filete que cierra la fila. */
function RotuloNivel({
  numero,
  rotulo,
  acento,
}: {
  numero: number
  rotulo: string
  acento: AcentoResuelto
}): ReactElement {
  return (
    <View style={estilos.nivel}>
      <Text style={{ ...estiloTipografico('nivel.numero', acento), marginRight: NIVEL.medianil }}>
        {numero}
      </Text>
      <Text style={estilos.rotuloNivel}>{rotulo.toUpperCase()}</Text>
      <View style={estilos.fileteNivel} />
    </View>
  )
}

/**
 * El campo de parentesco, que solo cuelga de la celda del familiar. Se compone aquí y no en
 * 2.L porque aquel componente no sabe qué es un parentesco (ver `anadido` en su ficha).
 */
function Parentesco(): ReactElement {
  return (
    <>
      <Text style={estilos.rotuloParentesco}>{ROTULO_PARENTESCO.toUpperCase()}</Text>
      <View style={estilos.lineaParentesco} />
    </>
  )
}

/** Una celda vacía de la retícula: el nivel 2 tiene una firma y dos columnas. */
const CELDA_VACIA: Firma = { rol: ' ' }

/** Un recuadro del anexo. Con foto o sin ella, el tipo y el número se imprimen igual. */
function RecuadroAnexo({
  identificacion,
  numero,
  acento,
}: {
  identificacion: IdentificacionAnexo
  numero: number
  acento: AcentoResuelto
}): ReactElement {
  const hayFoto = tieneValor(identificacion.foto)
  return (
    <View wrap={false}>
      <View style={estilos.cabeceraAnexo}>
        <View style={estilos.rielAnexo}>
          <Text style={{ ...estiloTipografico('seccion.numero', acento) }}>
            {String(numero).padStart(2, '0')}
          </Text>
        </View>
        <View>
          <Text style={estilos.rolAnexo}>{identificacion.rol.toUpperCase()}</Text>
          <Text style={estilos.nombreAnexo}>{identificacion.nombre}</Text>
        </View>
      </View>

      <View style={[estilos.fileteAnexo, { backgroundColor: acento.base }]} />

      <View
        style={[
          estilos.cajaFoto,
          hayFoto ? estilos.conFoto : estilos.sinFoto,
        ]}
      >
        {hayFoto ? (
          // `Image` es la primitiva de @react-pdf/renderer, no un `<img>` de HTML: no
          // admite `alt` y su salida es un PDF, no un árbol accesible.
          // eslint-disable-next-line jsx-a11y/alt-text
          <Image src={identificacion.foto} style={estilos.foto} />
        ) : (
          <Text style={estilos.leyendaSinFoto}>{SIN_FOTOGRAFIA}</Text>
        )}
      </View>

      <View style={estilos.pieAnexo}>
        <Text style={estilos.textoPie}>{identificacion.tipo}</Text>
        <Text style={estilos.textoPie}>{identificacion.numero}</Text>
      </View>
    </View>
  )
}

/** Parte las identificaciones en filas de dos, que es la retícula declarada. */
function enParejas<T>(items: readonly T[]): readonly (readonly T[])[] {
  const filas: T[][] = []
  items.forEach((item, indice) => {
    if (indice % 2 === 0) filas.push([item])
    else filas[filas.length - 1].push(item)
  })
  return filas
}

/**
 * LOS TRES ESPACIADORES DE CABECERA, por hoja.
 *
 * Es el único formato del sistema cuya cabecera de continuación no pesa lo mismo en todas
 * sus hojas, y las tres cifras están medidas: **26** en las que siguen texto corrido, **12**
 * en las que abren un bloque de firmas y **20** en la del anexo.
 *
 * ⚠ **VAN POR NÚMERO DE HOJA Y EL DOCUMENTO REPAGINA.** Con el texto en bandera izquierda,
 * la hoja donde cae cada cosa puede no ser la de la lámina, así que estas cifras describen
 * el reparto de la lámina y no el de esta composición. Es la misma decisión que el punto (d)
 * de la cabecera y por el mismo motivo: hacerlas depender de lo que caiga en cada hoja sería
 * métrica decidida por el contenido (I.3.4). Reportado.
 */
const HOJAS_PROPIAS: Readonly<Record<number, HojaPropia>> = {
  2: { espaciador: ESPACIO[26] },
  3: { espaciador: ESPACIO[26] },
  4: { espaciador: ESPACIO[12] },
  5: { espaciador: ESPACIO[12] },
  6: { espaciador: ESPACIO[20], rotulo: ROTULO_ANEXO },
}

// ─── El formato ──────────────────────────────────────────────────────────────

/** II.7 · Consentimiento Informado. */
export default function ConsentimientoInformado({
  medico,
  consultorio,
  panel,
  acento,
  paciente,
  procedimiento,
  secciones,
  firmantes,
  sustitucion,
  identificaciones,
  folio,
}: ConsentimientoInformadoProps): ReactElement {
  /**
   * LOS CINCO FIRMANTES. El médico imprime su rúbrica siempre; los otros cuatro solo si
   * firmaron. Los renglones bajo la línea salen de I.1.9 y el del médico son sus cédulas,
   * que se toman de `MedicoMembrete` en vez de pedirlas otra vez.
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
    credenciales: [NOTA_FAMILIAR],
    rubrica: firmantes.familiar.rubrica,
    anadido: <Parentesco />,
  }
  const firmaTestigo1: Firma = {
    rol: ROL_TESTIGO_1,
    nombre: firmantes.testigo1.nombre,
    credenciales: [NOTA_TESTIGO],
    rubrica: firmantes.testigo1.rubrica,
  }
  const firmaTestigo2: Firma = {
    rol: ROL_TESTIGO_2,
    nombre: firmantes.testigo2.nombre,
    credenciales: [NOTA_TESTIGO],
    rubrica: firmantes.testigo2.rubrica,
  }

  /**
   * LA VARIANTE POR SUSTITUCIÓN, EN TRES LÍNEAS. El familiar sube al nivel 1, el nivel 2
   * desaparece y Testigos se renumera. Es sustitución y no adición: el familiar firma UNA
   * vez, aquí o allí, nunca en los dos sitios.
   */
  const nivel1: readonly [Firma, Firma] = sustitucion
    ? [firmaMedico, firmaFamiliar]
    : [firmaMedico, firmaPaciente]
  const nivel2: readonly [Firma, Firma] = [firmaFamiliar, CELDA_VACIA]
  const nivel3: readonly [Firma, Firma] = [firmaTestigo1, firmaTestigo2]
  const numeroTestigos = sustitucion ? 2 : 3

  /** La hoja de anexo solo existe si al menos una identificación trae fotografía. */
  const identificados = identificaciones ?? []
  const hayAnexo = identificados.some((i) => tieneValor(i.foto))

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
          subtitulo: procedimiento,
          paciente,
          folio,
          antesDelRiel: (
          <View>
            {/*
              ═══ EL FUNDAMENTO LEGAL Y EL RÓTULO DEL RIEL ═══

              Van por la ranura `antesDelRiel` de 2.V y no en el flujo, y eso NO es una
              comodidad: el riel de identificación lo monta aquel componente, así que desde
              el flujo solo se puede componer DETRÁS de él — y el rótulo que nombra el riel
              acabaría impreso debajo del riel. Ver la nota de esa ranura.

              El marco es de `filete.acento` a 381 pt: la misma medida de línea que el
              cuerpo del documento, no la de un apartado. Es lo primero que se lee tras el
              título y lo que dice por qué esta hoja existe.
            */}
            <MarcoParcial
              ancho={MARCO.fundamento.ancho}
              padding={MARCO.fundamento.padding}
              grosor={FILETE.acento}
              acento={acento}
            >
              <Text style={estilos.rotuloFundamento}>{ROTULO_FUNDAMENTO.toUpperCase()}</Text>
              <Text style={estilos.cuerpoFundamento}>{FUNDAMENTO}</Text>
            </MarcoParcial>
            <Text style={estilos.rotuloRiel}>{ROTULO_IDENTIFICACION.toUpperCase()}</Text>
          </View>
          ),
        }}
        hojasPropias={HOJAS_PROPIAS}
      >
        {/*
          ═══ LAS SIETE SECCIONES CLÍNICAS ═══

          Cada una colapsa entera si su texto no viene (II.7 §2). `primera` es la primera que
          SOBREVIVE al colapso, no la §1: si el preoperatorio no viene, quien cuelga del riel
          es la siguiente y es ella la que lleva los 28 pt.
        */}
        {SECCIONES.filter((s) => tieneValor(secciones[s.clave]) || s.zona !== undefined).map(
          (seccion, indice) => (
            <Seccion
              key={seccion.numero}
              seccion={seccion}
              texto={secciones[seccion.clave] ?? ''}
              primera={indice === 0}
            />
          ),
        )}

        {/*
          ═══ HOJA DE OTORGAMIENTO ═══

          `break` abre hoja: la declaración y el nivel 1 empiezan donde el documento dice, no
          donde acabe la última sección. El encabezado de continuación lo repite 2.N por su
          cuenta, así que el aire entre él y el rótulo es cero.
        */}
        <View break>
          <Text style={estilos.rotuloBloque}>{ROTULO_DECLARACION.toUpperCase()}</Text>

          <View style={estilos.declaracion}>
            <MarcoParcial
              ancho={MARCO.declaracion.ancho}
              padding={MARCO.declaracion.padding}
              grosor={FILETE.acento}
              acento={acento}
            >
              <Text style={estilos.parrafoDeclaracion}>
                {'Yo, '}
                <Text style={estilos.destacado}>{paciente.paciente}</Text>
                {`, declaro que ${medico.nombre} me ha explicado de forma clara y comprensible la naturaleza del procedimiento: `}
                <Text style={estilos.destacado}>{procedimiento}</Text>
                {', incluyendo sus riesgos, beneficios esperados y alternativas de tratamiento.'}
              </Text>
              <Text style={estilos.parrafoDeclaracionSiguiente}>{DECLARACION_2}</Text>
              <Text style={estilos.parrafoDeclaracionSiguiente}>{DECLARACION_3}</Text>
            </MarcoParcial>
          </View>

          {/*
            LA CASILLA DE SUSTITUCIÓN. Se imprime SIEMPRE —marcada o sin marcar—, porque lo
            que informa es que existe la posibilidad y si se ejerció: una casilla que solo
            apareciera al marcarse no diría nada del caso normal.
          */}
          <View style={estilos.filaCasilla}>
            <View style={estilos.casilla}>
              {sustitucion === true ? <View style={estilos.marcaCasilla} /> : null}
            </View>
            <Text style={estilos.textoCasilla}>{TEXTO_SUSTITUCION}</Text>
          </View>

          <View style={estilos.bloqueNivel}>
            <RotuloNivel numero={1} rotulo={NIVEL_OTORGAMIENTO} acento={acento} />
            <BloqueFirmas
              variante="pareja"
              lamina={LAMINA}
              calibracion="compacta"
              firmas={nivel1}
            />
          </View>
        </View>

        {/*
          ═══ HOJA DE REPRESENTACIÓN Y TESTIGOS ═══

          Los dos niveles que quedan, en su propia hoja. El 2 desaparece entero en la
          variante por sustitución y el 3 se renumera a 2.
        */}
        <View break>
          {sustitucion === true ? null : (
            <View>
              <RotuloNivel numero={2} rotulo={NIVEL_REPRESENTACION} acento={acento} />
              {/*
                UNA CELDA LLENA Y LA SEGUNDA VACÍA. La retícula no se colapsa a una columna:
                si lo hiciera, la caja del familiar mediría 486 y su línea de firma sería el
                doble de larga que las otras cuatro del documento.
              */}
              <BloqueFirmas
                variante="pareja"
                lamina={LAMINA}
                calibracion="compacta"
                firmas={nivel2}
              />
            </View>
          )}

          <View style={sustitucion === true ? {} : estilos.bloqueNivelSiguiente}>
            <RotuloNivel
              numero={numeroTestigos}
              rotulo={NIVEL_TESTIGOS}
              acento={acento}
            />
            <BloqueFirmas
              variante="pareja"
              lamina={LAMINA}
              calibracion="compacta"
              firmas={nivel3}
            />
          </View>
        </View>

        {/*
          ═══ HOJA DE ANEXO — CONDICIONAL ═══

          Solo si al menos una identificación trae fotografía (decisión de producto 5). Su
          rótulo lo compone la cabecera de continuación, no este bloque: ver `HOJAS_PROPIAS`.
        */}
        {hayAnexo ? (
          <View break>
            <Text style={estilos.entradillaAnexo}>{ENTRADILLA_ANEXO}</Text>
            {enParejas(identificados).map((fila, indiceFila) => (
              <View key={fila[0].rol} style={estilos.filaAnexo}>
                {fila.map((identificacion, columna) => (
                  <View
                    key={identificacion.rol}
                    style={[
                      estilos.celdaAnexo,
                      columna === 0 ? {} : estilos.celdaAnexoSiguiente,
                    ]}
                  >
                    <RecuadroAnexo
                      identificacion={identificacion}
                      numero={indiceFila * 2 + columna + 1}
                      acento={acento}
                    />
                  </View>
                ))}
              </View>
            ))}
          </View>
        ) : null}
      </MotorFlujo>

      {/*
        Variante `completo`: folio · paginación · leyenda, con el prefijo `C-`. II.7 §1
        conserva el folio y retira el QR, y la lámina hace lo mismo: es el único formato del
        sistema donde esas dos decisiones se separan.
      */}
      <PieDocumento variante="completo" folio={folio} acento={acento} />
    </Page>
  )
}
