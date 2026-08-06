/**
 * Sistema de documentos v2 — componente 2.B · `Membrete`.
 *
 * FUENTE DE VERDAD: `DOCUMENTOS_SPEC.md` I.2 · 2.B. Transcripción, no diseño.
 *
 * Propósito: identidad del médico y del consultorio donde se emite.
 * Contenido: nombre · especialidad · cédulas (una línea por cédula) ·
 * universidad emisora · riel del consultorio activo (domicilio y teléfono).
 *
 * LAS CUATRO REGLAS DE LA FICHA
 *
 * 1. Es el ÚNICO consumidor de `ConsultorioActivoContext` en todo el sistema
 *    (I.3.6). Ningún otro componente lo lee.
 *
 *    Aquí el consultorio entra por prop, y no por `useContext`, por una razón
 *    técnica: el PDF se renderiza con `pdf()` FUERA del árbol de providers de la
 *    app, así que un `useContext` dentro de este árbol devolvería el valor por
 *    defecto y el membrete imprimiría el consultorio equivocado en silencio —
 *    exactamente el defecto que la regla existe para evitar. La lectura única
 *    ocurre en el sitio que construye el documento, que es lo que ya hacen los
 *    formularios de v1. Si algún día un segundo componente pide `consultorio`,
 *    eso es el defecto que describe la verificación visible de la ficha.
 *
 * 2. NADA COLAPSA POR AUSENCIA. Universidad, cédulas y domicilio son exigibles:
 *    si faltan, la emisión está bloqueada aguas arriba (I.3.7). Eso se implementa
 *    aquí como AUSENCIA DE CONDICIONALES: todas las props son obligatorias, no
 *    hay `?`, no hay `&&` de contenido y no hay validación en tiempo de render.
 *    Un `if (universidad)` en este archivo sería el defecto nivel 1 del sistema
 *    viejo, que emitía recetas sin universidad y sin domicilio sin avisar.
 *
 * 3. La especialidad NUNCA se abrevia para que quepa. Si no cabe, rompe a dos
 *    líneas. Por eso el bloque del nombre es `flex: 1` y no lleva `maxLines`,
 *    `textOverflow` ni truncado de ninguna clase. No los agregues.
 *
 * 4. Cierra con `FileteGruesoFino` (2.O) a todo `caja.ancho`. Ese filete es
 *    estructural: `TituloDocumento` en su variante `ausente` se apoya en él.
 *
 * `CONCILIA D23` — Laboratorio y Recibo emiten hoy sin línea de cédulas. No es
 * una variante: es el defecto nivel 1 de I.3.7. Los ocho formatos llevan
 * membrete completo.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import PanelCircular, { type PanelCircularProps } from './PanelCircular'
import FileteGruesoFino from './FileteGruesoFino'
import {
  CAJA,
  FILETE,
  TINTA,
  TRANSICION,
  estiloTipografico,
  type AcentoResuelto,
} from './tokens'

/**
 * Geometría interna de ESTE componente, de la tabla de 2.B.
 *
 * Las otras dos transiciones de esa tabla —fila superior → filete (14 pt) y
 * filete → línea fina (6 pt)— NO se repiten aquí: son `transicion.membreteFilete`
 * y `transicion.membreteLineaFina`, ya nombradas en I.1.7, y se consumen de ahí.
 * Un token tiene exactamente un sitio de definición (§0).
 *
 * `COINCIDENCIA` — 24 y 12 valen lo mismo que `espacio.24` y `espacio.12`, y no
 * son ellos: son geometría interna de componente, que I.1.7 declara en la ficha
 * y no en la escala. No los fusiones.
 */
const GEOMETRIA = {
  /** Medianil panel → bloque de nombre. */
  medianilPanelNombre: 18,
  /** Nombre → especialidad. */
  nombreEspecialidad: 7,
  /** Medianil de la línea fina: contacto ↔ cédulas. */
  medianilLineaFina: 24,
  /**
   * Sangría de la regla vertical de cédulas. Se lee como el aire entre la regla
   * y el texto de las cédulas, que es lo que la separa de la columna izquierda.
   */
  sangriaReglaCedulas: 12,
} as const

/** Datos del médico que el membrete imprime. Ninguno es opcional (regla 2). */
export interface MedicoMembrete {
  readonly nombre: string
  readonly especialidad: string
  /** Universidad emisora. Exigible por I.3.7. */
  readonly universidad: string
  /**
   * Una línea por cédula, YA COMPUESTA por quien llama: la ficha declara «una
   * línea por cédula» pero no la redacción de cada línea, así que este
   * componente no la inventa. La primera es la principal, que es la única que
   * imprime la variante `continuacion`.
   */
  readonly cedulas: readonly string[]
}

/** Consultorio activo. Llega por prop; ver regla 1 en la cabecera. */
export interface ConsultorioMembrete {
  readonly domicilio: string
  readonly telefono: string
}

export type MembreteProps =
  | {
      variante: 'completo'
      medico: MedicoMembrete
      consultorio: ConsultorioMembrete
      acento: AcentoResuelto
      /** El panel de 2.A, en la variante que corresponda a este médico. */
      panel: PanelCircularProps
    }
  | {
      variante: 'continuacion'
      medico: MedicoMembrete
      acento: AcentoResuelto
    }

const estilos = StyleSheet.create({
  membrete: {
    width: CAJA.ancho,
  },
  filaSuperior: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bloqueNombre: {
    // Regla 3: el bloque toma el ancho restante para que la especialidad pueda
    // romper a dos líneas en vez de abreviarse.
    flex: 1,
  },
  // El spread no es adorno: el tipo `Style` de react-pdf no admite una interfaz
  // sin índice de media queries, así que un rol se esparce, nunca se asigna
  // directo. Vale para los 18 componentes que faltan.
  nombre: { ...estiloTipografico('medico.nombre') },
  especialidad: {
    ...estiloTipografico('medico.especialidad'),
    marginTop: GEOMETRIA.nombreEspecialidad,
  },
  hastaFilete: {
    marginTop: TRANSICION.membreteFilete,
  },
  lineaFina: {
    flexDirection: 'row',
    marginTop: TRANSICION.membreteLineaFina,
  },
  columnaContacto: {
    flex: 1,
  },
  columnaCedulas: {
    marginLeft: GEOMETRIA.medianilLineaFina,
    paddingLeft: GEOMETRIA.sangriaReglaCedulas,
    borderLeftWidth: FILETE.regla,
    borderLeftColor: TINTA.hairline,
    alignItems: 'flex-end',
  },
  credencial: { ...estiloTipografico('medico.credencial') },
})

/** 2.B · `Membrete`. */
export default function Membrete(props: MembreteProps): ReactElement {
  const { acento, medico } = props

  return (
    <View style={estilos.membrete}>
      {props.variante === 'completo' ? (
        <View style={estilos.filaSuperior}>
          <PanelCircular {...props.panel} />
          <View
            style={[
              estilos.bloqueNombre,
              // 2.A regla 4: la variante `oculto` no reserva espacio, así que
              // tampoco se reserva su medianil.
              props.panel.variante === 'oculto'
                ? {}
                : { marginLeft: GEOMETRIA.medianilPanelNombre },
            ]}
          >
            <Text style={estilos.nombre}>{medico.nombre}</Text>
            <Text style={estilos.especialidad}>{medico.especialidad}</Text>
          </View>
        </View>
      ) : (
        <Text style={estilos.nombre}>{medico.nombre}</Text>
      )}

      <View style={estilos.hastaFilete}>
        <FileteGruesoFino acento={acento} />
      </View>

      {props.variante === 'completo' ? (
        <View style={estilos.lineaFina}>
          <View style={estilos.columnaContacto}>
            <Text style={estilos.credencial}>{props.consultorio.domicilio}</Text>
            <Text style={estilos.credencial}>{props.consultorio.telefono}</Text>
            <Text style={estilos.credencial}>{medico.universidad}</Text>
          </View>
          <View style={estilos.columnaCedulas}>
            {medico.cedulas.map((cedula) => (
              <Text key={cedula} style={estilos.credencial}>
                {cedula}
              </Text>
            ))}
          </View>
        </View>
      ) : (
        // La ficha no declara dónde va la cédula principal en `continuacion`:
        // queda bajo el nombre, a la izquierda. Sin columna izquierda no hay
        // nada que separar, así que tampoco lleva la regla vertical.
        <View style={estilos.lineaFina}>
          <Text style={estilos.credencial}>{medico.cedulas[0]}</Text>
        </View>
      )}
    </View>
  )
}
