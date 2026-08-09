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
import type { ReactElement, ReactNode } from 'react'
import PanelCircular, { type PanelCircularProps } from './PanelCircular'
import FileteGruesoFino from './FileteGruesoFino'
import {
  CAJA,
  TIPOGRAFIA,
  TRANSICION,
  estiloTipografico,
  type AcentoResuelto,
  type Lamina,
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
  /**
   * EL ESPACIADOR QUE CIERRA EL MEMBRETE — 12 pt, sin contenido.
   *
   * ⚠ **NO ES UN RENGLÓN VACÍO NI UN DEFECTO.** Una lectura anterior de la lámina
   * de Imagenología lo contó como un tercer renglón de la banda de dirección —«un
   * contenedor vacío que solo ocupa altura»— y lo retiró; y la misma lectura, en la
   * lámina de Laboratorio, lo tomó por un aire del formato. Es lo mismo en los dos
   * sitios y es lo mismo en los ocho: **el elemento que separa el membrete del
   * documento**.
   *
   * Su trabajo se ve al quitarlo: la banda va a 12 pt de interlineado y el título
   * arranca pegado a ella, así que las cinco líneas —nombre, especialidad,
   * dirección, cédulas, título— se leen como un bloque corrido de interlineado
   * uniforme y el título deja de nombrar un documento para parecer la quinta línea
   * del médico. Con él, membrete y documento se distinguen.
   *
   * A AMBOS LADOS EL AIRE ES CERO, y eso es parte de la medida: la banda cierra en
   * 153.5, el espaciador ocupa de 153.5 a 165.5 y el bloque de título arranca
   * exactamente donde termina. Un formato que además ponga su propio aire entre
   * membrete y título estará contando dos veces la misma separación — es lo que
   * hacía `SolicitudLaboratorio` con `espacio.12`.
   *
   * Vive AQUÍ y no en el formato porque cierra el membrete, así que viaja con él a
   * los ocho: es la misma razón por la que el filete grueso-fino tampoco lo pone
   * cada formato.
   */
  espaciadorCierre: 12,
  /**
   * EL MISMO ESPACIADOR EN LA LÁMINA DE RECETA — **10 pt, no 12**.
   *
   * Las coordenadas medidas no dejan margen: la banda de dirección cierra en 153.5
   * y el bloque de título abre en 163.5. Diez.
   *
   * ⚠ **NO ES UN AIRE DEL FORMATO NI UNA VARIANTE DE DISEÑO**, y por eso vive aquí
   * y no en `RecetaMedica.tsx`: es el mismo elemento que separa el membrete del
   * documento en los ocho, medido en una lámina que lo compone dos puntos más
   * bajo. Puesto en el formato volvería el defecto que ya se pagó una vez —contar
   * dos veces la misma separación, una en 2.B y otra como `espacio.*` del formato—
   * y además el día que otro formato mida 10 habría dos sitios que arreglar.
   *
   * Que dos láminas midan 12 y una 10 **queda reportado y no resuelto**: no hay
   * forma de saber desde aquí si el 10 es un valor propio de este formato o una
   * deriva de la ronda de diseño en que se dibujó. Mientras tanto lo declara el
   * formato, que es el mecanismo del sistema para exactamente este caso (`Lamina`).
   */
  espaciadorCierreReceta: 10,
  /**
   * EL MISMO ESPACIADOR EN LA HOJA DE CONTINUACIÓN DE HONORARIOS — **24 pt**.
   *
   * Es el primer valor que este componente declara para la variante `continuacion`, y
   * hasta ahora no había ninguno porque **ninguna lámina de continuación estaba
   * medida**: la nota de abajo lo dejaba anotado —«si al medirla resulta otra cifra, es
   * una variante del espaciador, no un aire del formato»— y esta es esa medición.
   *
   * Los 78.5 pt que mide esa hoja cierran exactos con él y sin el renglón de cédula:
   *
   *     32     cabecera: rótulo `titulo.seccion` (14) + nombre a 14 / 18
   *      8     `transicion.membreteFilete`
   *      2.5   el filete
   *     24     este espaciador
   *     12     la línea de paciente, que la monta 2.V
   *     ─────
   *     78.5
   *
   * ⚠ La lámina enumera la cabecera en **29** y el chasis compone 32; con 29 el total
   * no llega a 78.5 por ningún camino. Se compone lo que cuadra con la cota, que es la
   * medida dura. Reportado.
   *
   * **No lo hereda ninguna otra lámina**: las otras cuatro siguen en 12, que es lo que
   * este componente compone desde el principio para las dos variantes. Cambiarlo para
   * todas movería la hoja 2 de Receta, que está fijada en 93.5 pt por una prueba.
   */
  espaciadorContinuacionHonorarios: 24,
  /**
   * INTERLINEADO DE LA BANDA EN LA LÁMINA DE IMAGENOLOGÍA — 12, no 11.
   *
   * Desviación declarada del rol `medico.credencial`, del mismo tipo que las dos
   * de 2.F: se mueve el interlineado y nada más —familia, cuerpo, peso, tracking y
   * color los sigue poniendo el rol—. No sube a I.1.4 mientras tenga un solo
   * consumidor. Es lo que hace que los dos renglones midan los 24 pt que mide la
   * banda de esa lámina.
   */
  interlineadoBandaImagenologia: 12,
  /**
   * EL NOMBRE EN LA VARIANTE `continuacion` — **14 / 18, no 26 / 28**.
   *
   * ⚠ Esta variante componía el nombre con el rol `medico.nombre` tal cual, es decir
   * **a tamaño de portada en una hoja de continuación**. Las TRES láminas medidas lo
   * componen a 14 / 18 y coinciden entre sí: `SPEC_DISENO_PARTE_B.md` B.3, pregunta
   * transversal B, lo dice con la cifra al lado —«14 / 18 pt continuación, idéntico a
   * Laboratorio e Imagenología»—. No es una divergencia de un formato: es un defecto
   * del chasis con tres láminas de respaldo.
   *
   * Es una DESVIACIÓN DECLARADA de variante, con el patrón que ya usan 2.F, 2.D y
   * 2.L: **el rol no se toca** —`medico.nombre` sigue en 26 / 28 y lo sigue usando la
   * hoja 1— y lo que se mueve es el cuerpo y el interlineado de esta variante. No
   * sube a I.1.4 mientras tenga un solo consumidor.
   *
   * El tracking SÍ se recalcula, al revés que en las desviaciones de 2.F: el de
   * `medico.nombre` no es 0 —vale −0.012 em—, así que mover el cuerpo lo mueve.
   *
   * Vale 10 pt de encabezado de continuación, y es el primero de los tres tramos que
   * separaban los 166 pt que pesaba esta hoja de los 95 que mide la lámina.
   */
  continuacion: { cuerpoNombre: 14, interlineadoNombre: 18 },
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
      /**
       * Qué lámina fija la banda y el espaciador de cierre. Sin ella, la de
       * Laboratorio: un solo renglón, sin cédulas ni universidad, y cierre de 12.
       * Ver la nota junto al render.
       */
      lamina?: Lamina
    }
  | {
      variante: 'continuacion'
      medico: MedicoMembrete
      acento: AcentoResuelto
      /**
       * EL RÓTULO DEL DOCUMENTO, PLEGADO DENTRO DE LA CABECERA.
       *
       * En capitalización de oración y **ya con su rótulo de continuación**: quien lo
       * arma es 2.V, que es donde vive esa cadena para los ocho formatos. Aquí solo
       * se coloca y se compone en mayúsculas.
       *
       * Colapsa si no viene, y entonces la cabecera es solo el nombre — que es lo que
       * componía esta variante antes de plegar el título.
       */
      rotulo?: string
      /** La celda de folio de 2.C, a la derecha de la cabecera. Colapsa si no viene. */
      riel?: ReactNode
      /**
       * Qué lámina fija el espaciador de cierre de ESTA hoja. Sin ella, los 12 pt del
       * chasis, que son los que componen las cuatro láminas anteriores.
       *
       * ⚠ **NO TOCA NADA MÁS DE LA VARIANTE**, y eso es deliberado: la cabecera, el
       * nombre a 14 / 18 y la cédula bajo el filete siguen siendo los mismos en las
       * cinco. Si esta prop empezara a ramificar más piezas, lo que haría falta es una
       * variante y no un discriminante.
       */
      lamina?: Lamina
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
  /** El mismo nombre, a la mitad. Ver `GEOMETRIA.continuacion`. */
  nombreContinuacion: {
    ...estiloTipografico('medico.nombre'),
    fontSize: GEOMETRIA.continuacion.cuerpoNombre,
    lineHeight:
      GEOMETRIA.continuacion.interlineadoNombre / GEOMETRIA.continuacion.cuerpoNombre,
    letterSpacing:
      TIPOGRAFIA['medico.nombre'].tracking * GEOMETRIA.continuacion.cuerpoNombre,
  },
  /**
   * LA CABECERA DE CONTINUACIÓN — rótulo y nombre a la izquierda, folio a la derecha.
   *
   * La lámina **pliega el rótulo del documento aquí dentro** en vez de montar un
   * bloque de título entero con su propio filete debajo: los dos comparten el filete
   * que este componente ya cierra (regla 4). Son 30 pt de encabezado, el segundo de
   * los tres tramos.
   */
  cabeceraContinuacion: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  rotuloContinuacion: { ...estiloTipografico('titulo.seccion') },
  rielContinuacion: { alignItems: 'flex-end', flexShrink: 0 },
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
  /**
   * El renglón de la banda de Imagenología, con la desviación de interlineado
   * encima del rol. El cuerpo no se desvía, así que el `letterSpacing` que trae
   * `estiloTipografico()` sigue siendo el bueno y no hay que recalcularlo — mismo
   * caso que el rótulo de celda en 2.F.
   */
  credencialAlta: {
    ...estiloTipografico('medico.credencial'),
    lineHeight:
      GEOMETRIA.interlineadoBandaImagenologia / TIPOGRAFIA['medico.credencial'].cuerpo,
  },
  /**
   * El segundo renglón NO lleva margen propio: la lámina lo compone pegado al
   * primero, y esos 12 pt de altura son todo lo que aporta. Existe como estilo
   * aparte para que quede escrito que el cero es medido y no un olvido.
   */
  segundoRenglon: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  /**
   * El cierre del bloque. Caja sin contenido y sin margen a ningún lado: su alto
   * ES la separación. Ver `GEOMETRIA.espaciadorCierre` antes de tocarlo.
   */
  espaciador: {
    height: GEOMETRIA.espaciadorCierre,
  },
  /** El mismo cierre, dos puntos más bajo. Ver `GEOMETRIA.espaciadorCierreReceta`. */
  espaciadorReceta: {
    height: GEOMETRIA.espaciadorCierreReceta,
  },
  /** El mismo cierre en la hoja 2 de Honorarios, el doble de alto. */
  espaciadorContinuacionHonorarios: {
    height: GEOMETRIA.espaciadorContinuacionHonorarios,
  },
})

/**
 * La raya del sistema, la misma con la que 2.L une las credenciales bajo la
 * firma. Aquí une las dos cédulas en el renglón que la lámina compone en uno.
 */
const SEPARADOR_CREDENCIALES = ' · '

/** 2.B · `Membrete`. */
export default function Membrete(props: MembreteProps): ReactElement {
  const { acento, medico } = props
  const lamina: Lamina = props.lamina ?? 'chasis'
  /**
   * LA BANDA DE HONORARIOS ES LA DE LABORATORIO CON OTRO INTERLINEADO.
   *
   * Un solo renglón, sin cédulas y sin universidad —`D23` otra vez, y ahora son dos
   * láminas contra tres—, pero a **12 pt de interlineado** en vez de a 11: es el mismo
   * 12 con el que Imagenología, Receta y Suplementación componen sus DOS renglones. Por
   * eso esta lámina no cae ni en el `chasis` ni en el resto, y hacen falta las dos
   * condiciones: el renglón alto lo tiene todo lo que no es chasis, y el segundo
   * renglón lo pierde ella sola.
   */
  const honorarios = lamina === 'honorarios'
  const conCedulas = lamina !== 'chasis' && !honorarios

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
        <View style={estilos.cabeceraContinuacion}>
          <View>
            {props.rotulo === undefined ? null : (
              <Text style={estilos.rotuloContinuacion}>{props.rotulo.toUpperCase()}</Text>
            )}
            <Text style={estilos.nombreContinuacion}>{medico.nombre}</Text>
          </View>
          {props.riel === undefined ? null : (
            <View style={estilos.rielContinuacion}>{props.riel}</View>
          )}
        </View>
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
          cédulas la lámina no imprime nada. Son 10 pt de encabezado, la segunda de
          las tres causas del exceso que impedía que 18 estudios cupieran en una
          hoja.

          Lo que aquella lectura llamó «un contenedor vacío que solo ocupa altura»
          NO es la columna de cédulas ausente: es el espaciador de cierre, que ahora
          se compone abajo y en los ocho. Ver `GEOMETRIA.espaciadorCierre`.

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
        <>
          {/*
            LAS BANDAS DE IMAGENOLOGÍA Y DE RECETA SÍ LLEVAN CÉDULAS Y UNIVERSIDAD,
            Y SON DOS RENGLONES DE 12 pt.

            Las dos láminas coinciden hasta el punto: 129.5 → 141.5 y 141.5 → 153.5
            en las coordenadas de Receta, que son los mismos 24 pt de banda con el
            segundo renglón pegado al primero. Dos de las tres láminas medidas
            componen así, y solo Laboratorio compone un renglón sin credenciales —lo
            que inclina `CONCILIA D23`, sin cerrarlo, hacia el lado de I.3.7.

            Es la otra mitad de la contradicción de `CONCILIA D23` que la cabecera
            reporta: Laboratorio compone un renglón sin credenciales y esta lámina
            compone dos con ellas. **Las dos son láminas aprobadas**, así que el
            chasis no elige: lo declara el formato.

            SON DOS Y NO TRES. Los 12 pt que la extracción leyó como un tercer
            renglón vacío eran el espaciador de cierre, que ahora se compone abajo
            y para los ocho formatos. Ver `GEOMETRIA.espaciadorCierre`.

            Los dos renglones llevan el MISMO tratamiento —Archivo 7.5 / 12, peso
            400, `tinta.secundaria`—, así que ninguno de los dos destaca sobre el
            otro; lo único propio del primero es el margen de 6 pt que lo despega
            del filete, y ese es `transicion.membreteLineaFina`.

            El reparto en dos zonas del segundo renglón —cédulas a la izquierda,
            universidad a la derecha— es el que mide B.2 §4. La nota de medición lo
            escribe como una sola cadena unida por la raya; imprime lo mismo con
            otra alineación, y queda reportado como lo único de esta banda donde
            las dos lecturas de la lámina no coinciden.
          */}
          <View style={estilos.bandaDireccion}>
            <Text style={lamina === 'chasis' ? estilos.credencial : estilos.credencialAlta}>
              {props.consultorio.domicilio}
            </Text>
            <Text style={lamina === 'chasis' ? estilos.credencial : estilos.credencialAlta}>
              {props.consultorio.telefono}
            </Text>
          </View>

          {!conCedulas ? null : (
            <View style={estilos.segundoRenglon}>
              <Text style={estilos.credencialAlta}>
                {medico.cedulas.join(SEPARADOR_CREDENCIALES)}
              </Text>
              <Text style={estilos.credencialAlta}>{medico.universidad}</Text>
            </View>
          )}
        </>
      ) : (
        // La ficha no declara dónde va la cédula principal en `continuacion`:
        // queda bajo el nombre, a la izquierda. Sin columna izquierda no hay
        // nada que separar, así que tampoco lleva la regla vertical.
        <View style={estilos.lineaFina}>
          <Text style={estilos.credencial}>{medico.cedulas[0]}</Text>
        </View>
      )}

      {/*
        EL CIERRE DEL BLOQUE. Va en las DOS variantes: lo que separa es el membrete
        de lo que venga debajo, y en una hoja de continuación el membrete sigue
        siendo un membrete. Ninguna lámina de continuación está medida todavía, así
        que ese lado queda anotado — si al medirla resulta otra cifra, es una
        variante del espaciador, no un aire del formato.

        Dos láminas lo miden en 12 y una en 10. Ver `GEOMETRIA.espaciadorCierreReceta`.
      */}
      <View
        style={
          props.variante === 'continuacion'
            ? honorarios
              ? estilos.espaciadorContinuacionHonorarios
              : estilos.espaciador
            : lamina === 'receta'
              ? estilos.espaciadorReceta
              : estilos.espaciador
        }
      />
    </View>
  )
}
