/**
 * Sistema de documentos v3 — formato **II.8 · Escrito Médico**. Brief `08`.
 * Especial: **el chasis más desnudo.** Sin folio, sin ficha de identificación, sin
 * paciente y con un título que escribe el médico. Es el que dice si el chasis se
 * sostiene solo.
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
 * 4. **La hoja de continuación no lleva paciente** —no lo hay— y su línea inferior
 *    compone **las dos cédulas del médico**, que es lo que ata la hoja a su emisor.
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
  /** Fecha de emisión, YA compuesta. Va en la celda `EMISIÓN` de la fila de título. */
  readonly fecha?: string
  /** El cuerpo, ya analizado por el editor. **Bloquea emisión** si viene vacío. */
  readonly cuerpo: readonly NodoEscrito[]
  readonly rubrica?: string
}

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
          emision: fecha,
          /* Sin `paciente`: no hay ficha en la hoja 1 y la línea de continuación
             compone las cédulas del médico. Ver el punto 4 de la cabecera. */
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
