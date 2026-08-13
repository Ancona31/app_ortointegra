/**
 * Sistema de documentos v2 — componente 2.Q · `AperturaSeccion`.
 *
 * FUENTE DE VERDAD: **las coordenadas medidas de la lámina de Internamiento**, con
 * `DOCUMENTOS_SPEC.md` I.2 · 2.Q como segunda lectura. Donde las dos difieren manda la
 * lámina, y difieren en dos cosas que están abajo.
 *
 * Propósito: la transición entre las dos secciones de Internamiento. Es **más fuerte que
 * un `EncabezadoSeccion` porque cambia de LECTOR, no de tema**: la sección 1 la leen el
 * paciente y Admisión, la 2 enfermería y el residente de piso.
 *
 * ⚠ **SOLO LA SECCIÓN 2 TIENE APERTURA.** La 1 arranca directamente con su primer bloque
 * tras el riel de identificación: sin número colgado, sin rótulo y sin filete de
 * transición. **No las compongas iguales** — si la sección 1 abriera con lo mismo, la
 * apertura dejaría de significar «aquí cambia quién lee» y pasaría a ser un adorno de
 * encabezado de sección.
 *
 * ES 2.P UN NIVEL ARRIBA, Y DE AHÍ SALE TODO
 *
 * Misma anatomía —filete que abre, número colgado del riel, título al lado— con tres cosas
 * subidas de tono: el filete es el más grueso del sistema, el número va **a 26 pt** en vez
 * de a 15, y hay un subtítulo de lector, que 2.P no tiene.
 *
 * LO QUE LA LÁMINA CONTRADICE DE LA FICHA, Y GANA LA LÁMINA
 *
 * a. ⚠ **EL RÓTULO ES EL TÍTULO DE LA SECCIÓN, NO `SECCIÓN 2 DE 2`.** La regla 1 de la
 *    ficha hacía que este componente COMPUSIERA la cadena a partir de dos números, para
 *    que la palabra «continuación» no pudiera entrar por prop. La lámina compone
 *    `Indicaciones de ingreso a piso` —el título de la sección— a 17 / 20, que es el
 *    cuerpo del título del documento, con el lector debajo. **La cadena `sección 2 de 2`
 *    no desaparece: se muda** a la cabecera de continuación de esa hoja, que es donde el
 *    riesgo de escribir «continuación» vive de verdad (ver `rotuloHoja` en 2.V). Lo que se
 *    pierde aquí se gana allí, y la verificación visible de II.6 §6 sigue siendo la misma
 *    cadena en la misma hoja. Reportado.
 * b. ⚠ **EL FILETE DE TRANSICIÓN NO ES UNA REGLA A TODO EL ANCHO, ES UN GRUESO-FINO.** La
 *    ficha lo describe como `filete.transicion` —4 pt— y la lámina compone **144 × 4 en
 *    acento más el resto a 0.8 en `tinta.negra`**: es 2.O con la medida más grande del
 *    sistema, no un borde superior. Se compone lo medido y la escala de I.1.6 no se toca:
 *    esos 4 pt siguen siendo `filete.transicion` y siguen teniendo un solo consumidor.
 *
 * REGLA 2 — EL FILETE MÁS GRUESO DEL SISTEMA, Y SOLO AQUÍ
 *
 * `filete.transicion` tiene su uso limitado a este componente. Si aparece en otro sitio,
 * la jerarquía de la hoja deja de significar: la apertura de sección se reconoce **porque
 * nada más en el documento pesa tanto**. Su segmento grueso mide además 144 pt contra los
 * 96 del filete principal, así que se distingue por los dos ejes a la vez.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import FileteGruesoFino from './FileteGruesoFino'
import {
  CAJA,
  ESPACIO,
  RETICULA,
  TINTA,
  TIPOGRAFIA,
  estiloTipografico,
  type AcentoResuelto,
} from './tokens'

/**
 * Geometría interna de este componente, medida en la lámina.
 *
 * `fileteCabecera` — el aire entre el filete que abre y la cabecera. `COINCIDENCIA` con el
 * de 2.P y con `espacio.8`: **no se fusionan**, porque son el aire de dos aperturas
 * distintas y una puede querer moverse sin la otra (anexo A, P2-26).
 *
 * `cuerpoNumero` — los 26 pt de la desviación declarada de `seccion.numero`. El
 * interlineado sale de la razón 1 que declara el rol (15 / 15), así que a 26 pt es 26.
 *
 * `lector` — el aire entre el rótulo y el subtítulo de lector. Es el mismo `espacio.2` con
 * el que 2.C separa su subtítulo del título, y por la misma razón: título y subtítulo son
 * UN bloque y su separación interna es la menor de la escala.
 *
 * **EL BLOQUE MIDE 34 pt Y CIERRA SIN RESIDUO**, que es lo que dice que la lectura es la
 * buena: 20 del rótulo + 2 de aire + 12 del lector. El número, a 26, no lo estira.
 */
const GEOMETRIA = {
  fileteCabecera: ESPACIO[8],
  cuerpoNumero: 26,
} as const

/** El rol base del número, del que solo cambia el cuerpo. */
const ROL_NUMERO = TIPOGRAFIA['seccion.numero']

const estilos = StyleSheet.create({
  apertura: {
    width: CAJA.ancho,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: GEOMETRIA.fileteCabecera,
  },
  /** La misma anatomía de riel que 2.G, 2.J y 2.P: una columna exacta de retícula. */
  riel: {
    width: RETICULA.riel,
    marginRight: RETICULA.medianil,
    flexShrink: 0,
  },
  /** 486 − 23.25 − 9 = 453.75, que es lo que mide la lámina. Sale de la resta, no se escribe. */
  texto: {
    flex: 1,
  },
  /**
   * EL RÓTULO VA EN `titulo.documento` Y NO EN `titulo.seccion`.
   *
   * La lámina lo mide en 17 / 20, peso 600, tracking 0.453 px —que a cuerpo 17 pt son
   * 0.02 em— y `tinta.negra`: es el rol del título del documento hasta la centésima, no el
   * de sección, que va a 10 / 14 con 0.14 em. **Y es correcto que sea ese**: la sección 2
   * es otro documento dentro del mismo folio, así que su rótulo pesa lo que pesa el título
   * de un documento.
   *
   * **No se transforma a mayúsculas**, al revés que el título de 2.C. La regla del
   * preámbulo de II es del TÍTULO DEL DOCUMENTO (`CONCILIA D1`) y la lámina escribe esta
   * cadena en capitalización de oración, igual que 2.P escribe la suya. Se compone textual.
   */
  /**
   * EL ANTETÍTULO — `SECCIÓN 2 DE 2`, en el rol de sección, sobre el rótulo.
   *
   * Compuesto con la versalita del sistema y en `tinta.secundaria`: identifica la hoja
   * sin competir con el rótulo, que es lo que se lee.
   */
  antetitulo: {
    ...estiloTipografico('titulo.seccion'),
    color: TINTA.secundaria,
    marginBottom: ESPACIO[2],
  },
  rotulo: { ...estiloTipografico('titulo.documento') },
  /**
   * El subtítulo de lector: `seccion.lector`, 8 / 12 en 600 con la versalita del sistema y
   * `tinta.secundaria`. Es la única línea del sistema que lleva el tracking de la versalita
   * **sin ir en mayúsculas** — la lámina escribe `Para personal de enfermería y médico
   * residente` en capitalización de oración. Reportado en la ficha del rol.
   */
  lector: {
    ...estiloTipografico('seccion.lector'),
    marginTop: ESPACIO[2],
  },
})

export interface AperturaSeccionProps {
  /** Cuál sección abre. Es el dígito que cuelga del riel, sin cero a la izquierda. */
  numero: number
  /**
   * Título de la sección, en capitalización de oración y **tal como se imprime**: este
   * componente no lo transforma. Ver la nota de `rotulo`.
   */
  rotulo: string
  /**
   * CUÁNTAS SECCIONES TIENE EL DOCUMENTO. Con `numero` compone el antetítulo
   * `SECCIÓN 2 DE 2`, y por eso son dos números y no una cadena: **la palabra
   * «continuación» no puede entrar por prop**, que es la regla 1 de la ficha de 2.Q.
   *
   * ── POR QUÉ VUELVE AQUÍ, SI LA LÁMINA LA HABÍA MUDADO A LA CABECERA ─────────
   *
   * El punto (a) de arriba la mudó al `rotuloHoja` de la hoja de continuación, y eso
   * funcionaba mientras la sección 2 empezara en una hoja de número conocido: 2.V declara
   * los rótulos propios POR NÚMERO DE HOJA. Desde que el cierre de la sección 1 se parte
   * según lo que traiga, la sección 2 empieza en la hoja que toque —la 2 o la 3—, y un
   * rótulo por número acabaría rotulando la hoja equivocada: diría `SECCIÓN 2 DE 2` sobre
   * las instrucciones al paciente.
   *
   * Aquí no puede pasar: **este componente viaja en el flujo**, así que la cadena sale
   * donde la sección empieza, sea cual sea la hoja. Lo que la cabecera de esa hoja dice
   * —`· continuación`— es cierto: es la misma solicitud, y quien la separe la identifica
   * por lo que tiene DEBAJO del filete más grueso del documento.
   */
  de: number
  /** Quién lee esta sección: «Para personal de enfermería y médico residente». */
  lector: string
  /** El número y el segmento grueso del filete van en el acento. */
  acento: AcentoResuelto
}

/** 2.Q · `AperturaSeccion`. */
export default function AperturaSeccion({
  numero,
  de,
  rotulo,
  lector,
  acento,
}: AperturaSeccionProps): ReactElement {
  return (
    <View style={estilos.apertura}>
      {/* El más grueso del sistema, y solo aquí. Ver la regla 2 y el punto (b). */}
      <FileteGruesoFino acento={acento} medida="transicion" />

      <View style={estilos.cabecera}>
        <View style={estilos.riel}>
          {/*
            La desviación declarada: el rol entero con el cuerpo sustituido. El
            interlineado se recalcula con la razón del propio rol —15 / 15 = 1— en vez de
            dejar el del rol base, que a 26 pt apretaría la línea.
          */}
          <Text
            style={{
              ...estiloTipografico('seccion.numero', acento),
              fontSize: GEOMETRIA.cuerpoNumero,
              lineHeight: (ROL_NUMERO.interlineado ?? 0) / ROL_NUMERO.cuerpo,
              letterSpacing: ROL_NUMERO.tracking * GEOMETRIA.cuerpoNumero,
            }}
          >
            {numero}
          </Text>
        </View>

        <View style={estilos.texto}>
          {/*
            LA CADENA QUE IDENTIFICA LA HOJA, compuesta de dos números y no recibida: ver
            la prop `de`. En mayúsculas aquí, como toda versalita del sistema.
          */}
          <Text style={estilos.antetitulo}>{`Sección ${numero} de ${de}`.toUpperCase()}</Text>
          <Text style={estilos.rotulo}>{rotulo}</Text>
          <Text style={estilos.lector}>{lector}</Text>
        </View>
      </View>
    </View>
  )
}
