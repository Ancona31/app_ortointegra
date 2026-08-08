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
 * ⚠ `CONCILIA D23` **QUEDA CONTRADICHO POR LA LÁMINA Y SIN RESOLVER.** D23 declara
 * que Laboratorio y Recibo emitiendo sin línea de cédulas es el defecto nivel 1 de
 * I.3.7, y que los ocho formatos llevan membrete completo. La lámina aprobada de
 * Laboratorio compone su membrete **sin cédulas y sin universidad**, en un solo
 * renglón de domicilio y teléfono. Este archivo compone lo que compone la lámina —
 * ver la nota junto a la banda de dirección— y la contradicción queda REPORTADA
 * para que la decida Angel. Mientras tanto los dos datos siguen siendo props
 * exigibles: lo que cambió es qué se imprime, no qué se exige.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { View, Text, StyleSheet } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import PanelCircular, { type PanelCircularProps } from './PanelCircular'
import FileteGruesoFino from './FileteGruesoFino'
import {
  CAJA,
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
 * `COINCIDENCIA` — 18 vale lo mismo que un miembro futuro de la escala y no es él:
 * es geometría interna de componente, que I.1.7 declara en la ficha y no en la
 * escala. No lo fusiones.
 *
 * LOS TRES MIEMBROS QUE SE RETIRAN, Y POR QUÉ. `medianilLineaFina` (24),
 * `sangriaReglaCedulas` (12) y `separadorContacto` (` · `) componían la columna de
 * cédulas y la segunda línea de contacto de A.7. La lámina de Laboratorio no compone
 * ninguna de las dos —ver la nota junto a la banda de dirección en el render—, así
 * que sus tres valores se quedaron sin consumidor. Un miembro de geometría sin
 * consumidor es deuda, no ficha: si la variante con cédulas vuelve, vuelven con ella
 * y salen de A.7 tal cual.
 */
const GEOMETRIA = {
  /** Medianil panel → bloque de nombre. */
  medianilPanelNombre: 18,
  /** Nombre → especialidad. */
  nombreEspecialidad: 7,
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
  /**
   * LA BANDA DE DIRECCIÓN ES UN SOLO RENGLÓN, CON `space-between`. Domicilio
   * pegado al margen izquierdo, teléfono pegado al derecho, nada en medio. Ver la
   * nota larga junto al render.
   */
  bandaDireccion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: TRANSICION.membreteLineaFina,
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
        /*
          UN SOLO RENGLÓN, Y NI CÉDULAS NI UNIVERSIDAD.

          A.7 compone la línea fina en dos columnas —contacto a la izquierda en dos
          renglones, cédulas a la derecha— y eso son 22 pt de banda. **La lámina de
          Laboratorio compone un solo renglón**, con el domicilio a la izquierda, el
          teléfono a la derecha y `space-between` entre los dos:

              Calle 20 Núm. 110-J, entre 23 y 25, Centro, Umán, Yucatán 97390   Tel. 999 222 3173

          Ni la universidad ni las cédulas aparecen ahí: donde iría la columna de
          cédulas la lámina deja un contenedor vacío que solo ocupa altura. Son
          10 pt de encabezado, la segunda de las tres causas del exceso que impedía
          que 18 estudios cupieran en una hoja.

          ⚠ **CHOCA CON `CONCILIA D23` Y CON I.3.7**, que declaran cédulas y
          universidad obligatorias en el membrete de los ocho formatos —y con que
          Imagenología, Receta y Suplementación sí las llevan—. Se compone como la
          lámina porque la lámina manda en composición, y **queda reportado**: la
          decisión de producto es de Angel, no de este archivo. Si los otros siete
          formatos las conservan, lo que falta es una variante de 2.B, no revertir
          esto. Por eso `MedicoMembrete.universidad` y `.cedulas` siguen siendo
          props exigibles: el dato no deja de ser obligatorio porque esta lámina no
          lo imprima, y `continuacion` sigue componiendo la cédula principal.

          El teléfono llega YA REDACTADO por quien llama, como las cédulas y por la
          misma razón (regla 2 de la ficha): la lámina imprime `Tel. 999 222 3173` y
          el prefijo es redacción, no dato. Este componente coloca, no rotula.
        */
        <View style={estilos.bandaDireccion}>
          <Text style={estilos.credencial}>{props.consultorio.domicilio}</Text>
          <Text style={estilos.credencial}>{props.consultorio.telefono}</Text>
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
