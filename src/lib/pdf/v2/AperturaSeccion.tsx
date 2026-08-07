/**
 * Sistema de documentos v2 — componente 2.Q · `AperturaSeccion`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.Q. Transcripción, no diseño.
 *
 * Propósito: la transición entre las dos secciones de Internamiento. Es **más
 * fuerte que un `EncabezadoSeccion` porque cambia de LECTOR, no de tema**: la
 * sección 1 la leen el paciente y Admisión, la 2 enfermería y el residente.
 *
 * ES 2.P UN NIVEL ARRIBA, Y DE AHÍ SALE TODO
 *
 * Misma anatomía —filete que abre, número colgado del riel, título al lado— con
 * tres cosas subidas de tono: el filete es `filete.transicion`, el más grueso del
 * sistema; el número es `seccion.numero` **a 26 pt**, desviación declarada en
 * I.1.4; y hay un subtítulo de lector, que 2.P no tiene. Todo lo demás —familia,
 * peso, tracking, `acento.tinta`— lo sigue poniendo el rol.
 *
 * REGLA 1 — LA CADENA ES DEL COMPONENTE, PARA QUE NADIE ESCRIBA «CONTINUACIÓN»
 *
 * La cabecera dice `SECCIÓN 2 DE 2` y nunca «continuación»: una hoja de
 * indicaciones de enfermería **no es la continuación** de la hoja del paciente,
 * es otro documento dentro del mismo folio. Por eso el formato entrega dos
 * números y no un texto — igual que `urgente` en 2.H entra como booleano y no
 * como cadena. Si el texto entrara por prop, la palabra prohibida podría entrar
 * con él.
 *
 * REGLA 2 — EL FILETE MÁS GRUESO DEL SISTEMA, Y SOLO AQUÍ
 *
 * `filete.transicion` (4 pt) tiene su uso limitado a este componente. Si aparece
 * en otro sitio, la jerarquía de la hoja deja de significar: la apertura de
 * sección se reconoce **porque nada más en el documento pesa tanto**.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import {
  CAJA,
  FILETE,
  RETICULA,
  TINTA,
  TIPOGRAFIA,
  estiloTipografico,
  type AcentoResuelto,
} from './tokens'

/**
 * Geometría interna de este componente.
 *
 * `fileteCabecera` — el aire entre el filete que abre y la cabecera. La ficha no
 * lo declara y se toma el mismo tramo que 2.P declara para el suyo, que es la
 * misma relación un nivel más abajo. `COINCIDENCIA` con el de 2.P y con
 * `espacio.8`: **no se fusionan**, porque son el aire de dos aperturas distintas
 * y una puede querer moverse sin la otra (anexo A, P2-26).
 *
 * `cuerpoNumero` — los 26 pt de la desviación declarada. El interlineado sale de
 * la razón 1 que declara el rol (15 / 15), así que a 26 pt es 26.
 */
const GEOMETRIA = {
  fileteCabecera: 8,
  cuerpoNumero: 26,
} as const

/** El rol base del número, del que solo cambia el cuerpo. */
const ROL_NUMERO = TIPOGRAFIA['seccion.numero']

const estilos = StyleSheet.create({
  apertura: {
    width: CAJA.ancho,
    borderTopWidth: FILETE.transicion,
    borderTopColor: TINTA.negra,
    paddingTop: GEOMETRIA.fileteCabecera,
  },
  cabecera: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  riel: {
    width: RETICULA.riel,
    marginRight: RETICULA.medianil,
    flexShrink: 0,
  },
  texto: {
    flex: 1,
  },
  rotulo: { ...estiloTipografico('titulo.seccion') },
  /**
   * El subtítulo de lector es la única línea secundaria del sistema —humanista,
   * `tinta.secundaria`, colgada de un título— y 2.C ya la usa así bajo el título
   * del documento. Inventar una segunda para las secciones sería, en la capa de
   * tokens, lo que I.3.5 prohíbe en la de componentes.
   */
  lector: { ...estiloTipografico('titulo.subtitulo') },
})

export interface AperturaSeccionProps {
  /** Cuál sección abre. Con `total`, compone `SECCIÓN n DE m` (regla 1). */
  numero: number
  total: number
  /** Quién lee esta sección: «Enfermería y residente de piso». */
  lector: string
  /** El número va en `acento.tinta`. */
  acento: AcentoResuelto
}

/** 2.Q · `AperturaSeccion`. */
export default function AperturaSeccion({
  numero,
  total,
  lector,
  acento,
}: AperturaSeccionProps): ReactElement {
  return (
    <View style={estilos.apertura}>
      <View style={estilos.cabecera}>
        <View style={estilos.riel}>
          {/*
            La desviación declarada: el rol entero con el cuerpo sustituido. El
            interlineado se recalcula con la razón del propio rol —15/15 = 1— en
            vez de dejar el del rol base, que a 26 pt apretaría la línea.
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
          {/* Regla 1: la cadena se compone aquí. «Continuación» no cabe. */}
          <Text style={estilos.rotulo}>{`SECCIÓN ${numero} DE ${total}`}</Text>
          <Text style={estilos.lector}>{lector}</Text>
        </View>
      </View>
    </View>
  )
}
