/**
 * Sistema de documentos v3 — 2.N · **MotorFlujo**. «Decidir qué se queda en cada
 * hoja. Sólo mueve bloques.»
 *
 * ── LO QUE HACE, Y SON CUATRO COSAS ─────────────────────────────────────────
 *
 * 1. Monta el encabezado de hoja `fixed`, dos veces: `primera` en la hoja 1 y
 *    `continuacion` en las demás. El formato pasa DATOS, no composición.
 * 2. Deja fluir el contenido del formato.
 * 3. Cierra con el contador de lista, el último bloque de contenido y la banda de
 *    cierre, con `transicion.contenidoCierre` (12) entre los dos últimos.
 * 4. Cuelga el aviso de continuación en las hojas que no son la última.
 *
 * ── LO QUE DEJA DE HACER ────────────────────────────────────────────────────
 *
 * ⚠ **`umbralFirma()` SE RETIRA Y CON ÉL LA REGLA 1.** «Si en la hoja no cabe el
 * umbral, las últimas tres líneas del contenido bajan con la firma» era un cálculo de
 * altura hecho a mano contra un motor que no lo expone: el umbral se computaba de
 * `FIRMA_RENGLONES`, y cualquier ranura que el formato colgara de la celda de firma
 * —`anadido`, `sello`— lo dejaba corto sin que nada avisara. Lo sustituye
 * **`minPresenceAhead` por formato** (brief 00 §9.2), que es el mecanismo del propio
 * motor.
 *
 * ⚠ **`minPresenceAhead` ES UN TECHO, NO UNA RESERVA.** El motor aplica
 * `min(valor, altoRealDeLoQueSigue)`: se lee «pide hasta N pt por delante». Basta para
 * que la firma no viaje sola porque lo que sigue al último bloque es **siempre** la
 * banda de cierre, de 84 a 95 pt; deja de bastar si alguien afina los valores a la
 * baja. **Lo declara el formato en su último bloque**, no este archivo: es el formato
 * quien sabe cuál es ese bloque. Este componente no puede ponerlo por su cuenta —su
 * `cierre` es un `ReactNode` ya construido— y por eso los nueve lo declaran.
 *
 * ⚠ **EL MAPA DE RÓTULOS POR NÚMERO DE HOJA SE RETIRA** (defecto §4). `hojasPropias`
 * indexaba por hoja —`{ 5: { rotulo: 'Anexo · …' } }`— y bastaba que el documento
 * creciera una hoja para que el rótulo cayera sobre la hoja equivocada. Las hojas con
 * rótulo propio son ahora `Page` propios (brief 00 §9.5).
 *
 * ── LA APUESTA DE ESTE ARCHIVO, Y HAY QUE MIRARLA PRIMERO ───────────────────
 *
 * `APUESTA` — el encabezado va en un `View fixed` con `render`, y **las dos variantes
 * no miden lo mismo**: 136.6 + ficha en la hoja 1 y 37.47 en las demás. Se espera que
 * el motor mida el nodo `fixed` por hoja y reserve en cada una lo que ese render
 * devuelve. **Si no lo hace**, lo que se verá es una de estas dos cosas: la hoja 2 con
 * un hueco de ~150 pt sobre su primer bloque (midió con la altura de la hoja 1), o el
 * contenido de la hoja 1 pisando la ficha (midió con la de la continuación). Es el
 * mismo patrón que v2 componía, así que si v2 no tenía el defecto, esto tampoco. Lo
 * que hay que mirar si aparece: montar el encabezado como dos nodos hermanos, cada
 * uno con su `render` devolviendo `null` en las hojas que no le tocan. Ver
 * `dudas.md` §7.
 */

import { StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement, ReactNode } from 'react'
import ContadorLista, { type ContadorListaProps } from './ContadorLista'
import EncabezadoHoja, { type EncabezadoHojaProps } from './EncabezadoHoja'
import {
  ESPACIO,
  PIE_ANCLAJE,
  TRANSICION,
  ZONA_SEGURA,
  estiloTipografico,
  TINTA,
} from './tokens'

/**
 * Las dos cadenas del aviso, constantes del sistema.
 *
 * `válido` en masculino: concuerda con «documento», no con el nombre del formato. Es
 * la concordancia que `CONCILIA D22` fijó y que la lámina de Receta contradecía con
 * `válida`.
 */
const CONTINUA = 'Continúa en la hoja'
const SIN_FIRMA = 'Sin firma no es válido'

const estilos = StyleSheet.create({
  /**
   * El aviso vive en `bottom: 52` —zona segura + alto de la banda de pie—, así que
   * queda ENTRE la banda y el suelo de la caja de contenido, que empieza en 63. No
   * invade ninguna de las dos: es la razón de que `MARGEN.inferior` sean 63 y no 36.
   */
  aviso: {
    position: 'absolute',
    left: ZONA_SEGURA,
    right: ZONA_SEGURA,
    bottom: PIE_ANCLAJE.aviso,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  /** Las dos cajas del aviso llevan la geometría: su texto es dinámico. */
  celdaAviso: { flexShrink: 0 },
  avisoIzquierda: {
    ...estiloTipografico('pie'),
    color: TINTA.negra,
  },
  avisoDerecha: {
    ...estiloTipografico('pie'),
    color: TINTA.etiqueta,
    textAlign: 'right',
  },
  aireContador: { marginTop: ESPACIO[4] },
})

export interface MotorFlujoProps {
  /** Los DATOS del encabezado. El motor los pasa a 2.V dos veces y elige la variante. */
  readonly encabezado: Omit<EncabezadoHojaProps, 'variante'>
  /** El contador de la lista. Sin él, el formato no tiene lista que contar. */
  readonly contador?: ContadorListaProps
  /**
   * El último bloque de contenido: recomendaciones, notas, instrucciones. **Es quien
   * lleva el `minPresenceAhead`** del formato, y lo declara el formato al construirlo.
   */
  readonly cierre?: ReactNode
  /** La banda de cierre: firmas y, donde la haya, zona de QR. */
  readonly firmas?: ReactNode
  /** Aire hasta la banda de cierre. Sin él, `transicion.contenidoCierre` (12). */
  readonly aireCierre?: number
  /**
   * `false` en los formatos de una sola hoja por construcción —la Denegación— donde un
   * aviso de continuación que nunca se cumple es tinta muerta. Sin ella, `true`: el
   * aviso ya se calla solo en la última hoja.
   */
  readonly aviso?: boolean
  readonly children?: ReactNode
}

/** 2.N · `MotorFlujo`. */
export default function MotorFlujo({
  encabezado,
  contador,
  cierre,
  firmas,
  aireCierre = TRANSICION.contenidoCierre,
  aviso = true,
  children,
}: MotorFlujoProps): ReactElement {
  /**
   * Las dos variantes, compuestas de antemano. Se montan LAS DOS aunque sólo salga
   * una: ver la advertencia de abajo.
   */
  const primera = <EncabezadoHoja {...encabezado} variante="primera" />
  const continuacion = <EncabezadoHoja {...encabezado} variante="continuacion" />

  return (
    <>
      {/*
        ⚠⚠ **EL ENCABEZADO SON DOS PIEZAS EN DOS SITIOS, Y NO ES CAPRICHO.**

        Un nodo `fixed` se mide UNA sola vez y el renderer **reutiliza esa misma caja en
        todas las hojas**. De ahí sale la regla que gobierna este bloque: lo que viva
        dentro del nodo repetido tiene que medir lo mismo en la hoja 1 que en la 5.

        Montarlo de la forma evidente —el mástil y la banda como hijos del mismo nodo
        `fixed`, y un `render` que elige— reserva la SUMA de los dos en todas las hojas.
        Medido con `@react-pdf/layout` instrumentado sobre este documento: **268 pt
        reservados contra 42 compuestos** en cada hoja de continuación. Y como el reparto
        en hojas se decide sobre lo medido y no sobre lo compuesto, ese mástil fantasma
        cortaba los párrafos 226 pt antes del final real de la hoja: el punto 7 del
        Consentimiento partía a media frase y dejaba dos tercios de hoja en blanco debajo.

        La forma que sí mide lo que compone:

          · **En el nodo `fixed` vive SÓLO la banda de continuación**, como hijo declarado
            —que es lo único que ve la prebúsqueda de tipografías (I.3.8)— y el `render`
            devuelve `null` en la hoja 1.
          · **El mástil va FUERA, como hijo normal.** Un hijo normal se consume en la hoja
            1 y no reaparece: no hace falta `render` para que salga sólo ahí.

        ⚠ **NO HACE FALTA COMPENSAR NADA EN LA HOJA 1, Y SE COMPROBÓ ANTES DE CREERLO.**
        El primer montaje llevaba un margen negativo del alto de la banda, suponiendo que
        el nodo `fixed` reservaría su caja también donde no imprime; con él, el mástil se
        salía por arriba del papel y el nombre del médico quedaba cortado. Medido sobre el
        PDF: el nodo reserva 0 donde su `render` devuelve `null` y su alto completo donde
        devuelve la banda, así que el mástil se apoya solo en el margen. La cota que lo
        fija: `yMin` del nombre del médico = 41.0 pt, el mismo valor que componía el
        montaje anterior.
      */}
      <View
        fixed
        render={({ subPageNumber }) => ((subPageNumber ?? 1) === 1 ? null : continuacion)}
      >
        {continuacion}
      </View>

      {primera}

      {children}

      {contador === undefined ? null : (
        /*
          ⚠ **`fixed`, Y SIN ÉL EL CONTADOR SALE UNA SOLA VEZ.**

          El nodo vive DETRÁS de `children`, así que en un documento que desborda sólo
          alcanza la última hoja: las intermedias se quedaban sin contador y la forma
          `ESTUDIOS · HOJA 1 DE 3 · TOTAL 9` de 2.K —la razón de que el componente lea
          `subPageNumber`— no se componía nunca. Con `fixed` el renderer lo copia a todas
          las hojas CONSERVANDO su posición entre hermanos, que es lo que lo deja caer
          detrás del contenido de cada una y delante de los bloques de cierre en la
          última. Cazado por `motorFlujo.test.ts`.
        */
        <View style={estilos.aireContador} fixed>
          <ContadorLista {...contador} />
        </View>
      )}

      {cierre}

      {firmas === undefined ? null : (
        <View style={{ marginTop: aireCierre }} wrap={false}>
          {firmas}
        </View>
      )}

      {aviso ? (
        <View style={estilos.aviso} fixed>
          {/*
            `render` va en cada `Text` y no en el `View`: en este motor `render`
            SUSTITUYE a los hijos, y el tipo de `ViewProps.render` ni siquiera declara
            `totalPages`. Es el mismo patrón que compone la paginación de 2.M.
          */}
          <Text
            style={estilos.celdaAviso}
            render={({ pageNumber, totalPages }) =>
              pageNumber >= totalPages ? null : (
                <Text style={estilos.avisoIzquierda}>
                  {`${CONTINUA} ${pageNumber + 1}`.toUpperCase()}
                </Text>
              )
            }
          />
          <Text
            style={estilos.celdaAviso}
            render={({ pageNumber, totalPages }) =>
              pageNumber >= totalPages ? null : (
                <Text style={estilos.avisoDerecha}>{SIN_FIRMA.toUpperCase()}</Text>
              )
            }
          />
        </View>
      ) : null}
    </>
  )
}
