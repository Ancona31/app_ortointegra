/**
 * Sistema de documentos v3 — formato **II.8 · Escrito Médico**. Brief `08`.
 * Especial: **el chasis más desnudo.** Sin folio y con un título que escribe el médico.
 * Es el que dice si el chasis se sostiene solo.
 *
 * ── LO QUE CAMBIA RESPECTO DE v2 ────────────────────────────────────────────
 *
 * 1. **El título se recorta a dos renglones con elipsis** (defecto §5.1): el caso
 *    medido —104 caracteres— se componía a cuatro renglones y empujaba el cuerpo media
 *    hoja. Lo recorta la fila de título del chasis, no este archivo.
 * 2. **`minPresenceAhead` en los dos encabezados de cuerpo** —50 en el de nivel 1, 46
 *    en el de nivel 2 (defecto §3.2)—: un `VALORACIÓN` al pie de hoja con su párrafo en
 *    la siguiente es lo que más se notaba en los renders de v2. Los valores son el alto
 *    del encabezado más dos renglones de `texto.corrido`.
 * 3. **La banda de pie compone el nombre del documento** (defecto §9.5). Este formato y
 *    el Internamiento eran los dos que dejaban media barra vacía.
 * 4. **La ficha entra, con dos celdas y una sola fila**: `PACIENTE` en la celda ancha y
 *    `FECHA` a la derecha. Era una decisión de producto —«la hoja membretada multiuso no
 *    lleva riel de paciente, y si sale lo escribe el médico dentro del cuerpo»— y se
 *    revierte: el dato se guardaba y no se componía.
 *
 *    ⚠⚠ **Y CON ELLA SALE `EMISIÓN` DE LA FILA DE TÍTULO.** Las dos componían la misma
 *    fecha, así que dejarlas juntas imprimía el dato dos veces — que es el defecto que
 *    este mismo formato ya corrigió una vez. Manda la ficha, como en II.7: el folio
 *    arriba, la fecha en la ficha. Este formato no tiene folio, así que su fila de título
 *    se queda sin riel y el título pasa a disponer de los 540 pt enteros en vez de 436.
 *
 *    ⚠ **LA FECHA SIGUE VIAJANDO A LAS HOJAS DE CONTINUACIÓN**, y por la puerta declarada
 *    para eso: `extraResumen`, la misma que el Internamiento usa para el hospital y la
 *    Suplementación para el peso. Sin ella, una hoja suelta de un escrito largo no
 *    llevaría NI folio —no existe— ni fecha, y su línea inferior sólo diría el nombre del
 *    paciente. Antes ese papel lo ataba la celda de `EMISIÓN`, que es la que se retira.
 *
 * ⚠ **ES EL ÚNICO FORMATO QUE CARGA LA ITÁLICA, Y NO HAY ITÁLICA DE PESO 500.** Un
 * tramo con negrita **y** cursiva a la vez pediría `IBM Plex Sans 500 italic`, que no
 * está registrada; react-pdf compondría la redonda **sin lanzar nada**. Se resuelve
 * aquí y de forma declarada: **gana la cursiva** —400 itálica—, porque una cursiva
 * perdida cambia el sentido de una cita textual y medio punto de peso no. Reportado.
 *
 * ⚠ **LA SEGUNDA EXCEPCIÓN DECLARADA A I.3.2** (prohibición del justificado) vive en
 * este archivo: el médico elige la alineación en la barra del editor y perderla por el
 * camino sería peor que la excepción. `grep -rn "'justify'" src/lib/pdf/v2` tiene que
 * devolver DOS líneas: ésta y la del Consentimiento. Si aparece una tercera sin nota,
 * la regla dejó de ser una regla.
 */

import { Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import type { Style } from '@react-pdf/types'
import BloqueDestacado from '../BloqueDestacado'
import BloqueFirmas, { type Firma } from '../BloqueFirmas'
import MotorFlujo from '../MotorFlujo'
import PieDocumento from '../PieDocumento'
import type { ConsultorioMembrete, MedicoMembrete } from '../Membrete'
import type { PanelCircularProps } from '../PanelCircular'
import type { CeldaPaciente } from '../BloquePaciente'
import {
  ESPACIO,
  FUENTE,
  MARGEN,
  PAPEL,
  TINTA,
  TRANSICION,
  estiloTipografico,
  type AcentoResuelto,
} from '../tokens'

const TITULO_POR_DEFECTO = 'Escrito médico'
const RAYA = '—'

/** Ver el punto 2 de la cabecera. Techos, no reservas. */
const PRESENCIA = { encabezado1: 50, encabezado2: 46 } as const

export interface TramoTexto {
  readonly texto: string
  /** `<strong>` del editor. Peso 500, no 600: 600 es del chasis, no del cuerpo. */
  readonly negrita?: boolean
  /** `<em>` del editor. 400 itálica. */
  readonly cursiva?: boolean
  /**
   * `<u>` del editor. Se compone con `textDecoration`, que es decoración y no familia,
   * así que **se acumula con las otras dos sin pedir una cara nueva**.
   */
  readonly subrayado?: boolean
}

export type AlineacionEscrito = 'left' | 'center' | 'right' | 'justify'

export type NodoEscrito =
  | {
      readonly tipo: 'parrafo'
      readonly tramos: readonly TramoTexto[]
      readonly alineacion?: AlineacionEscrito
    }
  | { readonly tipo: 'encabezado1'; readonly texto: string; readonly alineacion?: AlineacionEscrito }
  | { readonly tipo: 'encabezado2'; readonly texto: string; readonly alineacion?: AlineacionEscrito }
  | {
      readonly tipo: 'lista'
      readonly marca: 'vineta' | 'numero'
      readonly items: readonly (readonly TramoTexto[])[]
    }
  | {
      readonly tipo: 'cita'
      readonly tramos: readonly TramoTexto[]
      readonly alineacion?: AlineacionEscrito
    }
  | { readonly tipo: 'separador' }

export interface EscritoMedicoProps {
  readonly medico: MedicoMembrete
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  /**
   * El título, que lo escribe el médico. Sin él, la fila de título compone sólo su
   * celda de emisión — que es la variante `ausente` de 2.C, y sigue conservando su filete.
   */
  readonly asunto?: string
  /**
   * EL NOMBRE DEL DOCUMENTO EN LA BANDA DE PIE. **Es un campo aparte, no un truncado
   * del título** (`CONCILIA D41`): el encabezado puede llevar una constancia de tres
   * renglones y la banda decir `Constancia de atención médica`.
   */
  readonly tituloPie?: string
  /**
   * El nombre del paciente. Va en la celda ancha de la ficha.
   *
   * **Campo vacío requerido**: sin él la celda no colapsa, deja su rótulo y su línea para
   * llenarla a pluma. Un escrito emitido antes de que la ficha existiera no trae el dato
   * en `contenido`, y una constancia dirigida a nadie es un caso legítimo; en los dos el
   * papel dice dónde va el nombre en vez de disimular que no lo pide.
   */
  readonly paciente?: string
  /**
   * Fecha, YA compuesta. Va en la celda `FECHA` de la ficha —**no en la fila de título**,
   * que es donde estaba: ver el punto 4 de la cabecera— y se repite en la línea inferior
   * de las hojas de continuación.
   */
  readonly fecha?: string
  /** El cuerpo, ya analizado por el editor. **Bloquea emisión** si viene vacío. */
  readonly cuerpo: readonly NodoEscrito[]
  readonly rubrica?: string
}

/**
 * LA FICHA: UNA FILA, DOS CELDAS. El nombre en la ancha y la fecha a la derecha.
 *
 * ⚠⚠ **CUATRO COLUMNAS PARA LA FECHA, Y NO LAS TRES DEL CONSENTIMIENTO.** Las dos fechas
 * del sistema no se componen igual: II.7 recibe `fechaCorta` —`22 jun 2026`— y este
 * formato recibe `fechaLarga`, que es la redacción que pide un certificado —`19 de
 * septiembre de 2026`—. Medido en el rol `dato` a 10.5, el peor mes del año:
 *
 *     30 de septiembre de 2026    120.58 pt
 *     con 3 columnas la celda da  115.00 pt  → se parte en dos renglones
 *     con 4 columnas la celda da  160.00 pt  → entra con 39.42 de sobra
 *
 * Y el ancho sale de donde sobraba. La celda del paciente baja de nueve columnas a ocho
 * —de 395 pt de texto a 350— y sigue holgada para el nombre más largo que se puede
 * esperar: `María de los Ángeles Hernández Villalobos`, 41 caracteres, mide **197.41**.
 * Caben 73 caracteres antes de que ese nombre necesite un segundo renglón.
 *
 * El reparto es 8 + 4 = 12: la fila llega al borde derecho, que es la regla del riel.
 */
const FICHA: readonly (readonly CeldaPaciente[])[] = [
  [
    { campo: 'paciente', columnas: 8, requerido: true },
    { campo: 'fecha', columnas: 4 },
  ],
]

const estilos = StyleSheet.create({
  hoja: {
    backgroundColor: TINTA.papel,
    paddingTop: MARGEN.superior,
    paddingLeft: MARGEN.izquierdo,
    paddingRight: MARGEN.derecho,
    paddingBottom: MARGEN.inferior,
  },
  parrafo: { ...estiloTipografico('texto.corrido'), marginBottom: ESPACIO[6] },
  encabezado1: {
    ...estiloTipografico('cuerpo.encabezado1'),
    marginTop: ESPACIO[12],
    marginBottom: ESPACIO[4],
  },
  encabezado2: {
    ...estiloTipografico('cuerpo.encabezado2'),
    marginTop: ESPACIO[10],
    marginBottom: ESPACIO[4],
  },
  item: { flexDirection: 'row', alignItems: 'flex-start' },
  marca: { ...estiloTipografico('item.raya'), width: 18, flexShrink: 0 },
  itemTexto: {
    ...estiloTipografico('texto.corrido'),
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
  },
  lista: { marginBottom: ESPACIO[6] },
  separador: {
    borderTopWidth: 0.5,
    borderTopColor: TINTA.hairline,
    marginVertical: ESPACIO[12],
  },
  banda: { marginTop: TRANSICION.contenidoCierre },
})

/** El estilo de un tramo. Ver el aviso de la itálica en la cabecera. */
function estiloTramo(tramo: TramoTexto): Style {
  const cursiva = tramo.cursiva === true
  return {
    // Gana la cursiva: sin cara 500 itálica, la negrita cede el peso y no el sentido.
    fontFamily: FUENTE.humanista,
    fontStyle: cursiva ? 'italic' : 'normal',
    fontWeight: cursiva ? 400 : tramo.negrita === true ? 500 : 400,
    ...(tramo.subrayado === true ? { textDecoration: 'underline' } : {}),
  }
}

/** Los tramos de un párrafo, como hijos de un solo `Text`: así envuelven juntos. */
function Tramos({ tramos }: { readonly tramos: readonly TramoTexto[] }): ReactElement {
  return (
    <>
      {tramos.map((tramo, indice) => (
        <Text key={indice} style={estiloTramo(tramo)}>
          {tramo.texto}
        </Text>
      ))}
    </>
  )
}

/** II.8 · Escrito Médico. */
export default function EscritoMedico({
  medico,
  consultorio,
  panel,
  acento,
  asunto,
  tituloPie,
  paciente,
  fecha,
  cuerpo,
  rubrica,
}: EscritoMedicoProps): ReactElement {
  const firmas: readonly [Firma] = [
    { nombre: medico.nombre, credenciales: medico.cedulas, rubrica },
  ]
  const nombrePie = tituloPie ?? asunto ?? TITULO_POR_DEFECTO

  return (
    <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.hoja}>
      <MotorFlujo
        encabezado={{
          medico,
          consultorio,
          panel,
          acento,
          /* El rótulo de continuación sale de aquí: `CONSTANCIA … · CONTINUACIÓN`. Con
             el título vacío, del nombre del pie — nunca de una cadena inventada. */
          titulo: asunto ?? nombrePie,
          /*
            SIN `emision`: la fecha vive en la ficha. Con las dos, el papel imprimía la
            misma fecha dos veces. Ver el punto 4 de la cabecera.
          */
          paciente: { paciente: paciente ?? '', fecha },
          filasFicha: FICHA,
          /*
            La fecha, a la línea inferior de las hojas de continuación. Es lo único que ata
            una hoja suelta a su acto en un formato que no tiene folio.
          */
          extraResumen: fecha === undefined || fecha.trim() === '' ? undefined : [fecha],
        }}
        firmas={
          <View style={estilos.banda}>
            <BloqueFirmas variante="simple" firmas={firmas} />
          </View>
        }
      >
        {cuerpo.map((nodo, indice) => {
          switch (nodo.tipo) {
            case 'encabezado1':
              return (
                <Text
                  key={indice}
                  style={[estilos.encabezado1, { textAlign: nodo.alineacion }]}
                  minPresenceAhead={PRESENCIA.encabezado1}
                >
                  {nodo.texto}
                </Text>
              )
            case 'encabezado2':
              return (
                <Text
                  key={indice}
                  style={[estilos.encabezado2, { textAlign: nodo.alineacion }]}
                  minPresenceAhead={PRESENCIA.encabezado2}
                >
                  {nodo.texto}
                </Text>
              )
            case 'parrafo':
              return (
                <Text key={indice} style={[estilos.parrafo, { textAlign: nodo.alineacion }]}>
                  <Tramos tramos={nodo.tramos} />
                </Text>
              )
            case 'lista':
              return (
                <View key={indice} style={estilos.lista}>
                  {nodo.items.map((item, i) => (
                    <View key={i} style={estilos.item}>
                      <Text style={estilos.marca}>
                        {nodo.marca === 'numero' ? `${i + 1}.` : RAYA}
                      </Text>
                      <Text style={estilos.itemTexto}>
                        <Tramos tramos={item} />
                      </Text>
                    </View>
                  ))}
                </View>
              )
            case 'cita':
              return (
                <BloqueDestacado
                  key={indice}
                  variante="citaEscrito"
                  contenido={
                    <Text style={[estilos.parrafo, { textAlign: nodo.alineacion }]}>
                      <Tramos tramos={nodo.tramos} />
                    </Text>
                  }
                />
              )
            case 'separador':
              return <View key={indice} style={estilos.separador} />
          }
        })}
      </MotorFlujo>

      <PieDocumento variante="sinFolio" documento={nombrePie} acento={acento} />
    </Page>
  )
}
