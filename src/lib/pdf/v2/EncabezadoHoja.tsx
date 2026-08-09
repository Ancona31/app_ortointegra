/**
 * Sistema de documentos v2 — componente 2.V · `EncabezadoHoja`.
 *
 * FUENTE DE VERDAD: las fichas de 2.B, 2.C, 2.D, 2.G y 2.H, que es de donde sale
 * cada pieza. **Este componente no aporta ninguna geometría propia**: coloca las que
 * ya existen y decide cuál va en cada hoja.
 *
 * POR QUÉ EXISTE, Y POR QUÉ NO VIVE EN LOS FORMATOS
 *
 * La hoja de continuación se resuelve **una sola vez, en el chasis**. Antes de esto,
 * los tres formatos construidos componían su encabezado a mano en el flujo, así que
 * salía en la hoja 1 y en ninguna más: si la lista desbordaba, la hoja 2 llegaba sin
 * membrete, sin folio y **sin nombre de paciente** — el hallazgo más grave de la
 * auditoría del sistema viejo, con una hoja de indicaciones que no se podía atribuir
 * a nadie.
 *
 * Si esta composición viviera en los ocho formatos, serían ocho sitios donde
 * equivocarse y ocho sitios que arreglar. Aquí los formatos declaran **datos** —su
 * título, su paciente, su folio, el sustantivo de su lista— y nunca cómo se compone
 * una hoja de continuación. Por eso las props de abajo no llevan un solo `ReactNode`
 * de encabezado: si lo llevaran, el formato volvería a componer.
 *
 * QUÉ CAMBIA ENTRE LAS DOS VARIANTES
 *
 *   membrete    `completo` con panel y especialidad  →  `continuacion`, nombre a 14/18
 *   título      bloque propio con su filete          →  PLEGADO dentro de la cabecera
 *   paciente    riel `completo`, hasta siete celdas  →  una línea gris de 7.5 / 12
 *   badge       colgado del título                   →  a la derecha de la línea
 *   cabecera    el sustantivo de la lista            →  con el rótulo de continuación
 *
 * **LO QUE PESA CADA UNA, Y POR QUÉ IMPORTA.** El encabezado completo mide 220.88 pt
 * y el de continuación tiene que ser mucho más ligero o no compensa: si pesara lo
 * mismo, cortar una lista costaría una hoja entera de identidad repetida. Las tres
 * cifras de arriba salen de la lámina y valen 59 pt frente a la primera versión de
 * este componente, que montaba las piezas de la hoja 1 encogidas —membrete con el
 * nombre a tamaño de portada, bloque de título entero y el riel con sus filetes—.
 *
 * ⚠ **LA CUARTA LÁMINA PESA 70.5 pt DE CONTINUACIÓN Y ESTE COMPONENTE COMPONE 83.5.**
 *
 * La de Suplementación es la primera que mide su hoja 2 pieza por pieza, y no cuadra
 * con lo que el chasis monta. La diferencia son **13 pt** y se cierra exacta con dos
 * sumandos, así que no hay nada que buscar:
 *
 *     −17   el renglón de cédula y su aire de 6, que esta lámina NO compone
 *     + 4   su espaciador de cierre, 16 en vez de los 12 de 2.B
 *     ────
 *     −13   83.5 → 70.5
 *
 * (Sobre esos 83.5 va además el aire hasta la cabecera de la lista, que declara el
 * formato: con los 10 de Receta salen los **93.50** que fija la prueba de 2.N, y con
 * los 14 de Suplementación, 97.5. Por eso las dos cifras que se comparan son 83.5 y
 * 70.5, no 93.5 y 70.5: aquella lleva dentro un aire de otro formato.)
 *
 * **No se ajusta ninguno de los dos**, y el motivo es el mismo en los dos casos: la
 * cédula bajo el nombre y el espaciador de 12 los componen hoy Laboratorio,
 * Imagenología y Receta, los tres conciliados contra su propia lámina, y ninguno de
 * los tres tiene una lámina de continuación medida con la que contrastarlos. Mover
 * cualquiera de los dos aquí los movería a los tres a ciegas. Lo que sí se compone es
 * lo que no arrastra a nadie: el peso en la línea de paciente, que solo sale donde hay
 * peso. **Reportado.**
 *
 * ⚠ Esa misma lámina cierra su línea con la emisión —`… · Peso 72.5 kg | 4 ago 2026 ·
 * 10:15`— y aquí sigue sin componerse: la emisión es dato de cabecera y este
 * componente la deja en la hoja 1 a propósito (ver el comentario del título). Ponerla
 * ahora la haría aparecer en la hoja 2 de los tres formatos anteriores, que es
 * exactamente el cambio a ciegas de arriba. **Reportado.**
 *
 * **La identificación del paciente NO ES OPCIONAL** (regla 2 de 2.D). Una hoja de
 * estudios o de indicaciones sin nombre es un riesgo clínico, no un detalle de
 * maquetación: en el hospital las hojas se separan. Lo que la lámina retira es la
 * CAJA —el riel con sus filetes— y no el dato: el nombre y el expediente siguen ahí,
 * en una línea. Por eso `paciente` es una prop exigible y no hay ninguna rama de este
 * archivo que componga una continuación sin ella.
 *
 * QUIÉN LO INSTANCIA
 *
 * Nadie directamente: lo monta 2.N, que es quien sabe en qué hoja está. Un formato
 * que lo instancie por su cuenta se estará componiendo un encabezado de hoja 1 que no
 * se repite — que es exactamente el defecto que este componente cierra.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement, ReactNode } from 'react'
import Membrete, {
  type ConsultorioMembrete,
  type MedicoMembrete,
} from './Membrete'
import type { PanelCircularProps } from './PanelCircular'
import TituloDocumento, { CeldaFolio, ETIQUETA_FOLIO_RIEL } from './TituloDocumento'
import BloquePaciente, {
  type RielHonorarios,
  type ValoresPaciente,
} from './BloquePaciente'
import BloqueNegativo from './BloqueNegativo'
import { CabeceraEntradas, CabeceraLista } from './EntradaNumerada'
import { tieneValor } from './Campo'
import {
  ESPACIO,
  TINTA,
  TIPOGRAFIA,
  estiloTipografico,
  type AcentoResuelto,
  type Lamina,
} from './tokens'

/**
 * EL RÓTULO DE CONTINUACIÓN, UNA SOLA VEZ EN EL SISTEMA.
 *
 * Las láminas lo componen sobre tres cadenas distintas —`Receta médica ·
 * continuación`, `Medicamentos · continuación`, `Estudios · continuación`— y siempre
 * con la misma forma: la cadena del formato, la raya del sistema y esta palabra. Por
 * eso no entra por prop: si la declarara cada formato, el sistema acabaría con ocho
 * redacciones de lo mismo, que es la deriva que `CONCILIA D5` ya tuvo que conciliar
 * en los avisos de pie.
 */
const ROTULO_CONTINUACION = 'continuación'
const SEPARADOR = ' · '

/** `Receta médica` → `Receta médica · continuación`. */
function continua(cadena: string): string {
  return `${cadena}${SEPARADOR}${ROTULO_CONTINUACION}`
}

/**
 * La cabecera de la lista, en sus dos anatomías.
 *
 * `columnas` distingue las dos que el sistema tiene: la tabla de tres rótulos que
 * compone Laboratorio (2.G `CabeceraEntradas`) y el rótulo único de la lista apilada
 * que componen Imagenología y Receta (2.G `CabeceraLista`). No es una variante de
 * este componente: es cuál de las dos piezas de 2.G se instancia, y lo decide el
 * formato al declarar si su lista tiene columnas.
 */
export interface ListaEncabezado {
  /** El sustantivo de la lista, en capitalización de oración. */
  readonly titulo: string
  /**
   * Rótulo a la derecha del sustantivo (2.G `CabeceraLista`). Colapsa si no viene.
   *
   * Sale en TODAS las hojas, igual que el sustantivo: es lo que califica la lista, y
   * una hoja de continuación de suplementos sin `Dosis calculada para 72.5 kg` diría
   * dosis sin decir contra qué se calcularon. `DERIVADO` — la lámina de continuación
   * no lo mide, y por eso queda anotado en vez de dado por medido.
   */
  readonly rotulo?: string
  /** Los tres rótulos, si la lista se compone en columnas. */
  readonly columnas?: {
    readonly numero: string
    readonly ancla: string
    readonly nota: string
  }
}

export interface EncabezadoHojaProps {
  /** Qué hoja se está componiendo. Lo decide 2.N, nunca el formato. */
  readonly variante: 'primera' | 'continuacion'
  readonly medico: MedicoMembrete
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  readonly lamina?: Lamina
  /** En capitalización de oración. La versalita y el rótulo los pone el chasis. */
  readonly titulo: string
  /**
   * Subtítulo del bloque de título y su rótulo (2.C, reglas 5 y 6). Los dos colapsan y
   * **solo salen en la hoja 1**: en las de continuación el título va plegado en la
   * cabecera del membrete y no hay bloque del que colgarlos.
   *
   * Hoy los lleva un formato —II.5 rotula el suyo `Procedimiento o motivo`— y los dos
   * son cadenas del FORMATO, así que entran por prop y no las escribe este componente.
   */
  readonly subtitulo?: string
  readonly rotuloSubtitulo?: string
  /**
   * El paciente. **Exigible**, y no solo en la hoja 1: la regla 2 de 2.D declara el
   * riel reducido obligatorio en cuanto el documento tiene más de una hoja.
   */
  readonly paciente: ValoresPaciente
  readonly emision?: string
  readonly folio?: string
  /** Badge del documento. El chasis lo reduce solo en las hojas de continuación. */
  readonly urgente?: boolean
  /** La cabecera de la lista, si el formato tiene lista. */
  readonly lista?: ListaEncabezado
  /** Separación entre el riel de identificación y la cabecera de la lista. */
  readonly aireLista?: number
  /**
   * Cuál de las dos filas del riel de Honorarios (2.D). Se pasa tal cual y solo lo lee
   * esa lámina.
   */
  readonly rielHonorarios?: RielHonorarios
  /**
   * ECO DE LA HOJA ANTERIOR, al final de la línea de paciente y **solo en las hojas de
   * continuación**.
   *
   * Lo lleva un formato y ninguno más: la hoja 2 de un recibo cierra con la firma y sin
   * un solo importe, así que sin el eco sería una hoja firmada que no dice cuánto se
   * está cobrando. La lámina compone `14 conceptos · total $18,400.00 USD en la hoja 1`.
   *
   * La cadena entera la redacta el FORMATO —lleva su sustantivo, su cifra y su divisa—,
   * como todas las del sistema. Este componente la coloca y la une con la raya.
   *
   * ⚠ **VA EN EL MISMO RENGLÓN QUE EL PACIENTE Y LA LÁMINA LO ESCRIBE EN DOS.** Su
   * propia cota lo desmiente: esa hoja mide 12 pt de línea de paciente, que es UN
   * renglón de 7.5 / 12, y con dos serían 24. Se compone en uno y queda reportado.
   */
  readonly eco?: string
  /**
   * RÓTULO PROPIO DE ESTA HOJA DE CONTINUACIÓN, en vez del `titulo · continuación` que
   * compone el chasis. Lo redacta el FORMATO y lo elige 2.N por número de hoja.
   *
   * Existe por un formato y por una razón que no es de estilo: la hoja 3 de II.6 **no es
   * la continuación de la 2**. La sección 1 la leen el paciente y Admisión; la 2, la
   * enfermería y el residente de piso. Son dos documentos dentro del mismo folio, así que
   * su cabecera dice `Solicitud de internamiento · sección 2 de 2` y **nunca
   * «continuación»** (II.6 §6, y la regla 1 de 2.Q).
   *
   * ⚠ **ABRE LA PUERTA QUE `ROTULO_CONTINUACION` CERRABA**, y por eso está acotada: quien
   * pase una cadena aquí puede escribir la palabra prohibida. Lo que la protege es que
   * ninguna hoja la recibe por defecto —sin ella, el rótulo lo sigue componiendo el
   * chasis— y que la única cadena que la usa hoy vive en la ficha de su formato, donde se
   * lee al lado de la regla que la prohíbe.
   */
  readonly rotuloHoja?: string
  /**
   * ALTO DEL ESPACIADOR QUE CIERRA LA CABECERA DE ESTA HOJA. Sin él, el que fija la lámina.
   *
   * Lo lleva un formato: II.7 mide 26 en sus hojas 2 y 3, 12 en las 4 y 5 y 20 en la del
   * anexo. Ver `espaciador` en 2.B.
   */
  readonly espaciadorHoja?: number
  /**
   * LO QUE VA ENTRE EL BLOQUE DE TÍTULO Y EL RIEL DE IDENTIFICACIÓN, **y solo en la hoja 1**.
   *
   * ⚠ **NO ES UNA PUERTA PARA QUE UN FORMATO SE COMPONGA EL ENCABEZADO.** Lo que entra aquí
   * no puede repetirse por hoja —la variante de continuación ni lo mira— y no toca ninguna
   * de las piezas que este componente coloca. Si algún día lleva un membrete, un título o
   * una línea de paciente, la ranura se cerró mal.
   *
   * Existe por un formato y por una razón de ORDEN, no de estilo: II.7 mete un bloque de
   * fundamento legal y el rótulo `Datos de identificación` **entre el título y el riel**, y
   * el riel lo monta este componente. Sin la ranura, el formato solo puede poner esos dos
   * bloques DETRÁS del riel, y entonces el rótulo que nombra el riel se imprime debajo de
   * él, que es exactamente lo que la regla 1 de 2.E prohíbe por el otro lado: una caja con
   * su etiqueta en el sitio equivocado.
   *
   * Los seis formatos anteriores no la pasan y su encabezado no cambia ni un punto.
   */
  readonly antesDelRiel?: ReactNode
}

/**
 * GEOMETRÍA DE LA LÍNEA DE PACIENTE — 7.5 / 12, `tinta.etiqueta`.
 *
 * ⚠ **AQUÍ IBA UN `RielDatos` REDUCIDO Y LA LÁMINA COMPONE UNA LÍNEA.** La variante
 * `reducido` de 2.D monta el riel entero con sus dos filetes de cierre: 31.5 pt para
 * decir un nombre y un expediente. La lámina compone un solo renglón gris —B.3 §2,
 * hoja 2, bloque 3: «línea de paciente y fecha de emisión, 7.5 / 12 pt, #737373»—, que
 * son 12. Son 19 pt de encabezado, el tercero de los tres tramos.
 *
 * **Lo que NO cambia es la regla 2 de 2.D:** el nombre y el expediente siguen en la
 * hoja, que es lo único que esa regla exige —que una hoja suelta se pueda atribuir a
 * un paciente—. Lo que se retira es la caja, no el dato.
 *
 * Es una desviación de `medico.credencial` en dos sumandos, con el patrón de siempre:
 * el interlineado sube de 11 a 12 —el mismo 12 que 2.B ya usa en su banda de dos
 * renglones— y el color pasa de `tinta.secundaria` a `tinta.etiqueta`. Familia,
 * cuerpo, peso y tracking los sigue poniendo el rol.
 */
const LINEA_PACIENTE = { interlineado: 12 } as const

/**
 * LA MISMA LÍNEA EN LA LÁMINA DE INTERNAMIENTO — **12.5**, medio punto más alta.
 *
 * Es la única pieza de esa hoja de continuación que no coincide con lo que el chasis ya
 * compone, y no es residuo: sus 69 pt solo cierran con 12.5 —32 + 8 + 2.5 + 14 + 12.5—.
 * Medio punto es poco para abrir una desviación y aun así se compone, por lo mismo que se
 * componen los hairlines de 0.475: **la cota es la medida dura** y taparla con «es
 * residuo» es lo que hace que un presupuesto deje de cuadrar dos láminas más tarde.
 */
const LINEA_PACIENTE_INTERNAMIENTO = { interlineado: 12.5 } as const

/**
 * Los dos rótulos de la línea, y la raya que une sus piezas.
 *
 * Los escribe el chasis y no el formato, por lo mismo que 2.K escribe «Total de» y
 * 2.M su leyenda: si los declarara cada uno de los ocho, el sistema acabaría con ocho
 * redacciones de la misma línea. La lámina compone
 * `Paciente · Nombre · 25 años · Exp. 2026-0184`.
 */
const ROTULO_PACIENTE = 'Paciente'
const ROTULO_EXPEDIENTE = 'Exp.'
/**
 * ⚠ **EL PESO SOLO APARECE DONDE HAY PESO, Y HOY ESO ES UN SOLO FORMATO.**
 *
 * La lámina de Suplementación compone su línea de continuación como
 * `Paciente · Nombre · 25 años · Exp. 2026-0184 · Peso 72.5 kg`, y es la única que
 * lleva la última pieza: en ese formato el peso no es un dato clínico más sino la base
 * de todo lo que la hoja calcula, así que una hoja 2 sin él tiene dosis que no se
 * pueden comprobar. Los otros tres no pasan `peso` y su línea no se mueve ni un punto.
 */
const ROTULO_PESO = 'Peso'
/**
 * ⚠ **EL HOSPITAL VA SIN RÓTULO, Y SOLO LO LLEVA UN FORMATO.**
 *
 * La lámina de Internamiento compone `Paciente · Nombre · 25 años · Exp. 2026-0184 · Star
 * Médica Mérida`: la quinta pieza es el sitio del ingreso y entra sin rotular, al revés
 * que el expediente y el peso. Es lo que corresponde —un nombre propio de hospital no
 * necesita que le digan que es un hospital— y es también el dato que hace que la hoja 2 de
 * este formato se pueda devolver a su piso si se separa de la 1, que es para lo que la
 * regla 2 de 2.D existe.
 *
 * ⚠ **VA POR LÁMINA Y NO POR PRESENCIA DEL DATO**, que es lo contrario de lo que hacen el
 * expediente y el peso. Consentimiento también rotula un `Hospital o clínica` en su riel y
 * su línea de continuación **no lo lleva**: compone `Paciente · Nombre | Expediente
 * 2026-0184 · 22 jun 2026`, en dos zonas, con el rótulo entero y con la fecha en vez de la
 * edad. Es la TERCERA construcción de esta línea y **no se compone**, por lo mismo que no se
 * compuso la emisión que Suplementación pone al final de la suya: esta línea es una sola
 * forma para los siete formatos, y abrirla por prop es la deriva que `CONCILIA D5` ya tuvo
 * que conciliar en los avisos de pie. Reportado.
 */
const RAYA = ' · '

const estilos = StyleSheet.create({
  /**
   * El aire entre el riel y la cabecera de la lista. Lo declara el FORMATO —cada
   * lámina lo mide distinto: 12 en Laboratorio, 14 en Imagenología, 10 en Receta— y
   * por eso entra por prop en vez de vivir aquí con un valor. Sin él, ninguno: una
   * lista sin cabecera no tiene de qué separarse.
   */
  hastaLista: { width: '100%' },
  lineaPaciente: {
    ...estiloTipografico('medico.credencial'),
    lineHeight: LINEA_PACIENTE.interlineado / TIPOGRAFIA['medico.credencial'].cuerpo,
    color: TINTA.etiqueta,
    flex: 1,
  },
  /** La misma línea medio punto más alta. Ver `LINEA_PACIENTE_INTERNAMIENTO`. */
  lineaPacienteInternamiento: {
    lineHeight:
      LINEA_PACIENTE_INTERNAMIENTO.interlineado /
      TIPOGRAFIA['medico.credencial'].cuerpo,
  },
  /** La línea y, a su derecha, el badge reducido de los formatos que lo llevan. */
  filaContinuacion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
})

/**
 * La línea de identificación: rótulo, nombre, edad y expediente, unidos por la raya
 * del sistema. Las piezas que no vienen no dejan raya suelta.
 */
function lineaDePaciente(
  paciente: ValoresPaciente,
  lamina: Lamina,
  eco?: string,
): string {
  return [
    ROTULO_PACIENTE,
    paciente.paciente,
    paciente.edad,
    tieneValor(paciente.expediente)
      ? `${ROTULO_EXPEDIENTE} ${paciente.expediente}`
      : undefined,
    tieneValor(paciente.peso) ? `${ROTULO_PESO} ${paciente.peso}` : undefined,
    // Sin rótulo, y SOLO en la lámina que lo mide. Ver la nota de arriba.
    lamina === 'internamiento' ? paciente.hospital : undefined,
    eco,
  ]
    .filter((pieza): pieza is string => tieneValor(pieza))
    .join(RAYA)
}

/** 2.V · `EncabezadoHoja`. */
export default function EncabezadoHoja(props: EncabezadoHojaProps): ReactElement {
  const continuacion = props.variante === 'continuacion'
  const titulo = continuacion
    ? (props.rotuloHoja ?? continua(props.titulo))
    : props.titulo
  /**
   * ⚠ **EL BADGE NO SE REPITE EN LAS HOJAS DE CONTINUACIÓN DE INTERNAMIENTO.**
   *
   * Las dos láminas que componen un bloque en negativo lo repiten reducido en su hoja 2, y
   * esta **no lo compone en ninguna de las dos suyas**: el badge sale bajo el título de la
   * hoja 1 y ahí se queda. No se compone lo que la lámina no tiene, aunque el chasis sepa
   * componerlo. **Reportado**, porque va contra la regla 4 de 2.H leída de corrido —un
   * badge marca el DOCUMENTO, no una hoja— y aquí el documento queda marcado en una sola.
   */
  const badgeEnContinuacion = props.lamina !== 'internamiento'
  const internamiento = props.lamina === 'internamiento'

  return (
    <View>
      {continuacion ? (
        /*
          LA CABECERA DE CONTINUACIÓN, CON EL TÍTULO PLEGADO DENTRO. No monta un
          bloque de título aparte: el rótulo y el nombre comparten la cabecera y el
          filete que 2.B ya cierra, que es como lo compone la lámina.
        */
        <Membrete
          variante="continuacion"
          lamina={props.lamina}
          acento={props.acento}
          medico={props.medico}
          rotulo={titulo}
          espaciador={props.espaciadorHoja}
          riel={
            props.folio === undefined ? undefined : (
              <CeldaFolio
                etiqueta={ETIQUETA_FOLIO_RIEL}
                valor={props.folio}
                acento={props.acento}
              />
            )
          }
        />
      ) : (
        <Membrete
          variante="completo"
          lamina={props.lamina}
          acento={props.acento}
          medico={props.medico}
          consultorio={props.consultorio}
          panel={props.panel}
        />
      )}

      {/*
        EL TÍTULO, SOLO EN LA HOJA 1. En las de continuación va plegado arriba, dentro
        de la cabecera: ver el `rotulo` que se le pasa al membrete. El folio se
        compone en las dos —es lo que ata la hoja al documento dentro del cuerpo,
        además de la banda de 2.M—, y la emisión solo en la 1: es un dato de cabecera,
        no de identificación.
      */}
      {continuacion ? null : (
        <TituloDocumento
          variante="fijo"
          lamina={props.lamina}
          acento={props.acento}
          titulo={titulo}
          subtitulo={props.subtitulo}
          rotuloSubtitulo={props.rotuloSubtitulo}
          emision={props.emision}
          folio={props.folio}
          bajoTitulo={
            props.urgente === true ? (
              <BloqueNegativo variante="urgente" lamina={props.lamina} />
            ) : undefined
          }
        />
      )}

      {/*
        LO QUE EL FORMATO METE ENTRE EL TÍTULO Y EL RIEL, solo en la hoja 1. Ver
        `antesDelRiel`.
      */}
      {continuacion || props.antesDelRiel === undefined ? null : props.antesDelRiel}

      {/*
        LA IDENTIFICACIÓN DEL PACIENTE, que en continuación NO ES OPCIONAL (regla 2 de
        2.D). Riel completo en la hoja 1, línea gris en las demás: el dato es el mismo,
        la caja no. Ver `LINEA_PACIENTE`.

        El badge viaja con la línea porque en continuación no hay título del que
        colgar, que es donde la hoja 1 lo pone. La lámina lo compone así: «a la derecha
        de la línea de paciente».
      */}
      {continuacion ? (
        <View style={estilos.filaContinuacion}>
          <Text
            style={[
              estilos.lineaPaciente,
              internamiento ? estilos.lineaPacienteInternamiento : {},
            ]}
          >
            {lineaDePaciente(props.paciente, props.lamina ?? 'chasis', props.eco)}
          </Text>
          {props.urgente === true && badgeEnContinuacion ? (
            <BloqueNegativo variante="urgenteReducido" lamina={props.lamina} />
          ) : null}
        </View>
      ) : (
        <BloquePaciente
          variante="completo"
          lamina={props.lamina}
          acento={props.acento}
          rielHonorarios={props.rielHonorarios}
          {...props.paciente}
        />
      )}

      {props.lista === undefined ? null : (
        <View style={[estilos.hastaLista, { marginTop: props.aireLista ?? ESPACIO[12] }]}>
          {props.lista.columnas === undefined ? (
            <CabeceraLista
              titulo={continuacion ? continua(props.lista.titulo) : props.lista.titulo}
              rotulo={props.lista.rotulo}
              acento={props.acento}
            />
          ) : (
            <CabeceraEntradas {...props.lista.columnas} acento={props.acento} />
          )}
        </View>
      )}
    </View>
  )
}
