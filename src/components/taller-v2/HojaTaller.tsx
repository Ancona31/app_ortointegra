/**
 * ⚠️ ANDAMIAJE TEMPORAL — SE BORRA AL CERRAR LA FASE 1.
 *
 * Hoja de prueba del taller de componentes v2. No es un formato del sistema, no
 * se emite, no se guarda y ningún médico la ve nunca. Existe para poder mirar
 * cada componente del chasis en un PDF real antes de que exista el formato que
 * lo consume — sin esto, los veinte componentes de I.2 se construirían a ciegas
 * hasta el Paso 4.
 *
 * Cuando la Fase 1 cierre, se borra la carpeta `src/components/taller-v2/`
 * completa y la ruta `src/app/super-admin/dashboard/taller-v2/`. Nada del chasis
 * depende de este archivo: la dependencia va en un solo sentido.
 *
 * REGLAS QUE ESTE ARCHIVO RESPETA
 * - No importa nada de `src/lib/pdf/` (v1). El chasis v2 no comparte código con
 *   el renderer viejo, y el taller tampoco.
 * - No lee ni escribe base de datos ni Storage. El médico es ficticio y vive
 *   en `TallerV2.tsx`.
 * - Ninguna posición sale de un literal: todas vienen de `tokens.ts`.
 */

import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  pdf,
  type DocumentProps,
} from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import PanelCircular from '@/lib/pdf/v2/PanelCircular'
import Membrete, { type MedicoMembrete } from '@/lib/pdf/v2/Membrete'
import TituloDocumento from '@/lib/pdf/v2/TituloDocumento'
import BloquePaciente from '@/lib/pdf/v2/BloquePaciente'
import Campo from '@/lib/pdf/v2/Campo'
import RielDatos from '@/lib/pdf/v2/RielDatos'
import BloqueNegativo from '@/lib/pdf/v2/BloqueNegativo'
import BloqueDestacado from '@/lib/pdf/v2/BloqueDestacado'
import ContadorLista from '@/lib/pdf/v2/ContadorLista'
import ParserBloques from '@/lib/pdf/v2/ParserBloques'
import { registrarFuentesV2 } from '@/lib/pdf/v2/fonts'
import {
  CAJA,
  ESPACIO,
  MARGEN,
  PAPEL,
  TINTA,
  ZONA_SEGURA,
  estiloTipografico,
  resolverAcento,
  type AcentoResuelto,
} from '@/lib/pdf/v2/tokens'

/** El médico ficticio del taller. Definido en `TallerV2.tsx`. */
export interface MedicoFicticio {
  readonly nombre: string
  readonly iniciales: string
  readonly especialidad: string
  readonly cedulaProfesional: string
  readonly cedulaEspecialidad: string
  readonly universidad: string
  readonly domicilio: string
  readonly telefono: string
  /** Ráster ya normalizado, como lo entregaría el ingest del perfil. */
  readonly logo: string
}

/**
 * ANDAMIAJE, NO CHASIS. Las guías son del taller y se van con él, así que sus
 * grosores y colores viven aquí y no en `tokens.ts`: no son tokens del sistema y
 * no deben ascender a serlo. Lo que sí sale de tokens es cada POSICIÓN — que es
 * justamente lo que las guías sirven para comprobar.
 */
const GUIA = {
  grosor: 0.5,
  /** Rosa apenas visible: el borde de lo que ninguna impresora garantiza. */
  zonaSegura: '#E8C9C9',
  /** Azul apenas visible: la caja de texto donde vive el contenido. */
  caja: '#C6D6E6',
} as const

const estilos = StyleSheet.create({
  pagina: {
    backgroundColor: TINTA.papel,
  },
  guiaZonaSegura: {
    position: 'absolute',
    left: ZONA_SEGURA,
    top: ZONA_SEGURA,
    width: PAPEL.ancho - ZONA_SEGURA * 2,
    height: PAPEL.alto - ZONA_SEGURA * 2,
    borderWidth: GUIA.grosor,
    borderColor: GUIA.zonaSegura,
    borderStyle: 'dashed',
  },
  guiaCaja: {
    position: 'absolute',
    left: MARGEN.izquierdo,
    top: MARGEN.superior,
    width: CAJA.ancho,
    height: CAJA.alto,
    borderWidth: GUIA.grosor,
    borderColor: GUIA.caja,
  },
  contenido: {
    position: 'absolute',
    left: MARGEN.izquierdo,
    top: MARGEN.superior,
    width: CAJA.ancho,
  },
  fila: {
    flexDirection: 'row',
  },
  celda: {
    marginRight: ESPACIO[24],
    alignItems: 'center',
  },
  // El rol trae familia, cuerpo, interlineado, peso, tracking y color ya en las
  // unidades de react-pdf. Aquí solo se añade lo que es del taller.
  rotulo: {
    ...estiloTipografico('etiqueta'),
    marginTop: ESPACIO[8],
  },
  nota: {
    ...estiloTipografico('titulo.subtitulo'),
    marginTop: ESPACIO[32],
  },
  /** Separación entre muestras de componentes distintos. Es del taller. */
  seccion: {
    marginTop: ESPACIO[48],
  },
  muestra: {
    marginTop: ESPACIO[32],
  },
  /**
   * Marca de arranque: dónde empezaría el bloque siguiente. Sirve para medir el
   * hueco que deja cada variante de 2.C. Andamiaje del taller, no chasis.
   */
  marcaArranque: {
    width: '100%',
    height: GUIA.grosor,
    backgroundColor: GUIA.caja,
  },
  /**
   * Fila de campos de 2.E. La separación va en el CONTENEDOR y por `gap`, que es
   * la regla 4 de la ficha: un margen en el propio campo sobreviviría al colapso
   * y dejaría justo el hueco que el colapso existe para no dejar. Un campo que
   * devuelve `null` no monta nodo, así que tampoco consume su `gap`.
   */
  filaCampos: {
    flexDirection: 'row',
    gap: ESPACIO[24],
  },
  /**
   * Fila para poner dos bloques de 2.H uno junto a otro. `alignItems` arriba para
   * que la comparación sea de ANCHO y no de posición vertical, que es lo que la
   * verificación visible de la ficha manda mirar.
   */
  filaBloques: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: ESPACIO[24],
  },
  /** Separación entre las muestras apiladas de 2.I. Es del taller. */
  destacado: {
    marginTop: ESPACIO[24],
  },
})

/**
 * Rótulo de cada muestra. Va en `etiqueta`, que es versalita: mayúsculas con
 * tracking, no versalitas reales de la fuente (I.1.4).
 */
function Rotulo({ children }: { children: string }): ReactElement {
  return <Text style={estilos.rotulo}>{children.toUpperCase()}</Text>
}

/**
 * Compone las líneas de cédula que el membrete imprime.
 *
 * La redacción es DEL TALLER, no del spec: 2.B declara «una línea por cédula»
 * pero no cómo se rotula cada una, así que el componente no lo inventa y quien
 * llama lo decide. Estas dos cadenas son las que usa hoy v1 en `PdfHeader.tsx`.
 */
/** Una muestra de 2.J con su rótulo. Andamiaje del taller. */
function MuestraParser({
  rotulo,
  texto,
  marca,
}: {
  rotulo: string
  texto: string
  marca: 'raya' | 'numero'
}): ReactElement {
  return (
    <View style={estilos.seccion}>
      <Rotulo>{rotulo}</Rotulo>
      <View style={estilos.muestra}>
        <ParserBloques texto={texto} marca={marca} />
        {/* Marca de arranque: con la cadena vacía tiene que quedar pegada al
            rótulo, sin banda vacía entre los dos. */}
        <View style={estilos.marcaArranque} />
      </View>
    </View>
  )
}

function medicoMembrete(medico: MedicoFicticio): MedicoMembrete {
  return {
    nombre: medico.nombre,
    especialidad: medico.especialidad,
    universidad: medico.universidad,
    cedulas: [
      `Céd. Prof. ${medico.cedulaProfesional}`,
      `Céd. Esp. ${medico.cedulaEspecialidad}`,
    ],
  }
}

/**
 * Paciente de prueba del taller. INVENTADO, como el médico. No sale de la base y
 * no hay ninguna ruta desde este archivo hasta ella.
 *
 * Vive aquí y no en `TallerV2.tsx` porque no lleva ningún control en la barra
 * lateral: las cuatro muestras de 2.D se distinguen por qué campos se le pasan al
 * componente, no por lo que valgan.
 */
const PACIENTE_FICTICIO = {
  paciente: 'María Fernanda Ruiz Ortega',
  edad: '54 años',
  sexo: 'Femenino',
  expediente: 'EXP-004821',
  diagnostico: 'Gonartrosis bilateral grado III',
  fecha: '4 ago 2026',
  hora: '11:40',
} as const

/** Cadena para comparar familias: la misma palabra en las dos celdas vecinas. */
const CADENA_COMPARACION = 'Gonartrosis bilateral'

/**
 * Celdas sueltas para mirar 2.F sin pasar por 2.D. Los anchos son enteros de
 * `riel.celda` y suman 12 por fila, que es la regla 1 de la ficha.
 */
const CELDAS_2F = {
  fila1: [
    { clave: 'servicio', etiqueta: 'Servicio', valor: 'Ortopedia', columnas: 5 },
    { clave: 'turno', etiqueta: 'Turno', valor: 'Matutino', columnas: 4 },
    { clave: 'cama', etiqueta: 'Cama', valor: '204-B', columnas: 3 },
  ],
  fila2: [
    { clave: 'ayuno', etiqueta: 'Ayuno', valor: '8 horas', columnas: 6 },
    { clave: 'traslado', etiqueta: 'Traslado', valor: 'Camilla', columnas: 6 },
  ],
} as const

/**
 * Texto real para las tres variantes de 2.I. INVENTADO como el resto del taller,
 * pero con la longitud y el registro que tendría el pasaje real de cada formato:
 * un bloque destacado con dos palabras dentro no demuestra nada sobre la sangría.
 */
const TEXTO_2I = {
  /** Recomendaciones de una Receta (II.3). */
  alarma:
    'Tome el medicamento con alimentos y complete la caja aunque los síntomas cedan antes. Si aparece erupción en la piel, hinchazón de labios o dificultad para respirar, suspenda y acuda a urgencias.',
  /**
   * Instrucciones al paciente de un Internamiento (II.6). Van NUMERADAS, y por
   * eso este texto trae encabezado y viñetas: es lo que 2.J convierte en lista.
   */
  instrucciones: [
    'El día del ingreso:',
    '- Preséntese en admisión a las 06:00 h con identificación oficial.',
    '- Ayuno absoluto de ocho horas antes del ingreso.',
    '- Traiga los estudios de laboratorio y las radiografías recientes.',
  ].join('\n'),
  /** Seguimiento de un Plan de Suplementación (II.4). */
  cita: 'Reevaluación en ocho semanas con biometría hemática y perfil de hierro. Suspenda la suplementación y avise por el canal habitual si aparece intolerancia digestiva.',
} as const

/**
 * Los siete casos de la batería de 2.J, con el texto que los provoca. Son los
 * mismos que prueba `src/lib/tests/parserBloques.test.ts`: aquí se ven, allí se
 * comprueban. El caso 2 va primero, como en la ficha y como en el archivo de
 * pruebas.
 */
const CASOS_2J: readonly { readonly rotulo: string; readonly texto: string; readonly marca: 'raya' | 'numero' }[] = [
  {
    rotulo: 'caso 2 · prosa sin viñetas y sin items debajo',
    texto:
      'El paciente ingresa por dolor lumbar de tres semanas.\nSe solicita valoración por rehabilitación.',
    marca: 'raya',
  },
  {
    rotulo: 'caso 1 · encabezado + dos items',
    texto: 'Indicaciones generales:\n- Dieta blanda\n- Signos vitales cada ocho horas',
    marca: 'raya',
  },
  {
    rotulo: 'caso 3 · viñetas antes del primer encabezado',
    texto:
      '- Dieta blanda\n- Reposo relativo\nIndicaciones al egreso:\n- Deambulación asistida con andadera',
    marca: 'raya',
  },
  {
    rotulo: 'caso 4 · un solo item, que no se numera',
    texto: '- Ayuno absoluto de ocho horas',
    marca: 'numero',
  },
  {
    rotulo: 'caso 5 · item con dos puntos en medio',
    texto: '- Ayuno: ocho horas antes del ingreso\n- Traslado: en camilla desde urgencias',
    marca: 'raya',
  },
  {
    rotulo: 'caso 6 · cadena vacia, que colapsa entera',
    texto: '',
    marca: 'raya',
  },
  {
    rotulo: 'caso 7 · dos bloques con contador corrido',
    texto: [
      'Antes del ingreso:',
      '- Ayuno de ocho horas',
      '- Traer estudios recientes',
      '',
      'El día del procedimiento:',
      '- Presentarse a las 06:00 h',
      '- Acudir acompañado',
    ].join('\n'),
    marca: 'numero',
  },
]

/** El texto de la verificación visible de 2.J, tal como lo pide la ficha. */
const VERIFICACION_2J = [
  'El paciente ingresa por dolor lumbar de tres semanas de evolución.',
  'Se solicita valoración por el servicio de rehabilitación en las primeras 24 horas.',
  'Indicaciones de ingreso a piso:',
  '- Dieta blanda, tolerando vía oral',
  '- Signos vitales cada ocho horas',
  '- Deambulación asistida a partir del segundo día',
].join('\n')

function HojaTaller({
  medico,
  acento,
}: {
  medico: MedicoFicticio
  acento: AcentoResuelto
}): ReactElement {
  return (
    <Document title="Taller de componentes v2">
      <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.pagina}>
        <View style={estilos.guiaZonaSegura} fixed />
        <View style={estilos.guiaCaja} fixed />

        <View style={estilos.contenido}>
          <View style={estilos.fila}>
            <View style={estilos.celda}>
              <PanelCircular variante="logo" acento={acento} logo={medico.logo} />
              <Rotulo>logo</Rotulo>
            </View>

            <View style={estilos.celda}>
              <PanelCircular
                variante="monograma"
                acento={acento}
                iniciales={medico.iniciales}
              />
              <Rotulo>monograma</Rotulo>
            </View>

            <View style={estilos.celda}>
              <PanelCircular variante="oculto" />
              <Rotulo>oculto</Rotulo>
            </View>
          </View>

          <Text style={estilos.nota}>
            2.A · PanelCircular. La variante «oculto» no reserva sitio: su rótulo
            queda pegado al borde superior de la caja porque no hay panel encima
            que lo baje. El monograma es el único texto que cambia de tono con el
            acento, y lo hace en «acento.tinta» derivado, que I.1.8 admite.
          </Text>

          <View style={estilos.seccion}>
            <Rotulo>2.B membrete · completo</Rotulo>
            <View style={estilos.muestra}>
              <Membrete
                variante="completo"
                acento={acento}
                medico={medicoMembrete(medico)}
                consultorio={{
                  domicilio: medico.domicilio,
                  telefono: medico.telefono,
                }}
                panel={{ variante: 'logo', acento, logo: medico.logo }}
              />
            </View>
          </View>

          <View style={estilos.seccion}>
            <Rotulo>2.B membrete · continuacion</Rotulo>
            <View style={estilos.muestra}>
              <Membrete
                variante="continuacion"
                acento={acento}
                medico={medicoMembrete(medico)}
              />
            </View>
          </View>

          <Text style={estilos.nota}>
            2.B · Membrete, cerrado por 2.O · FileteGruesoFino. El segmento grueso
            del filete mide 96 pt y es el único sitio del sistema donde el acento
            va como barra sólida; el resto de la línea es negro y no cambia con el
            acento. La variante «continuacion» imprime nombre y cédula principal,
            sin panel y sin riel de consultorio.
          </Text>
        </View>
      </Page>

      <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.pagina}>
        <View style={estilos.guiaZonaSegura} fixed />
        <View style={estilos.guiaCaja} fixed />

        <View style={estilos.contenido}>
          <Rotulo>2.C titulo · fijo, con subtitulo</Rotulo>
          <View style={estilos.muestra}>
            <TituloDocumento
              variante="fijo"
              acento={acento}
              titulo="Solicitud de laboratorio"
              subtitulo="Estudios de laboratorio clínico"
            />
          </View>

          <Rotulo>2.C titulo · variable largo, con fecha</Rotulo>
          <View style={estilos.muestra}>
            <TituloDocumento
              variante="variable"
              acento={acento}
              titulo="Constancia de atención médica y recomendaciones laborales"
              fecha="4 ago 2026"
            />
          </View>

          <Text style={estilos.nota}>
            2.C · TituloDocumento. El título se guarda en capitalización de oración
            y se compone en mayúsculas aquí, no en la base (regla 1 del preámbulo de
            II). El variable rompe a dos líneas y la fecha se queda en la PRIMERA,
            nunca en la segunda ni centrada entre las dos.
          </Text>
        </View>
      </Page>

      <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.pagina}>
        <View style={estilos.guiaZonaSegura} fixed />
        <View style={estilos.guiaCaja} fixed />

        <View style={estilos.contenido}>
          <View>
            <Rotulo>fijo · membrete → titulo → arranque</Rotulo>
            <View style={estilos.muestra}>
              <Membrete
                variante="continuacion"
                acento={acento}
                medico={medicoMembrete(medico)}
              />
              <TituloDocumento
                variante="fijo"
                acento={acento}
                titulo="Solicitud de laboratorio"
              />
              <View style={estilos.marcaArranque} />
            </View>
          </View>

          <View style={estilos.seccion}>
            <Rotulo>ausente · membrete → titulo → arranque</Rotulo>
            <View style={estilos.muestra}>
              <Membrete
                variante="continuacion"
                acento={acento}
                medico={medicoMembrete(medico)}
              />
              <TituloDocumento variante="ausente" />
              <View style={estilos.marcaArranque} />
            </View>
          </View>

          <Text style={estilos.nota}>
            Las dos muestras de arriba son el mismo membrete con las dos variantes
            del título. La línea azul marca dónde arrancaría el bloque siguiente:
            la diferencia entre las dos es exactamente el bloque del título más su
            filete, sin banda vacía residual. En «ausente» el filete del membrete
            hace doble trabajo.
          </Text>
        </View>
      </Page>

      <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.pagina}>
        <View style={estilos.guiaZonaSegura} fixed />
        <View style={estilos.guiaCaja} fixed />

        <View style={estilos.contenido}>
          <Rotulo>2.D paciente · completo, las siete celdas</Rotulo>
          <View style={estilos.muestra}>
            <BloquePaciente variante="completo" {...PACIENTE_FICTICIO} />
          </View>

          <View style={estilos.seccion}>
            <Rotulo>2.D paciente · como llega hoy, sin sexo ni expediente ni hora</Rotulo>
            <View style={estilos.muestra}>
              <BloquePaciente
                variante="completo"
                paciente={PACIENTE_FICTICIO.paciente}
                edad={PACIENTE_FICTICIO.edad}
                diagnostico={PACIENTE_FICTICIO.diagnostico}
                fecha={PACIENTE_FICTICIO.fecha}
              />
            </View>
          </View>

          <View style={estilos.seccion}>
            <Rotulo>2.D paciente · reducido, hojas de continuacion</Rotulo>
            <View style={estilos.muestra}>
              <BloquePaciente
                variante="reducido"
                paciente={PACIENTE_FICTICIO.paciente}
                expediente={PACIENTE_FICTICIO.expediente}
              />
            </View>
          </View>

          <View style={estilos.seccion}>
            <Rotulo>2.D paciente · comparacion de familia</Rotulo>
            <View style={estilos.muestra}>
              {/* La misma cadena en dos celdas vecinas de la fila inferior:
                  diagnóstico en la humanista, fecha en la neo-grotesca. */}
              <BloquePaciente
                variante="completo"
                paciente={PACIENTE_FICTICIO.paciente}
                diagnostico={CADENA_COMPARACION}
                fecha={CADENA_COMPARACION}
              />
            </View>
          </View>

          <Text style={estilos.nota}>
            2.D · BloquePaciente. Es UN riel de siete celdas en dos filas, no dos
            rieles: sus anchos salen de «riel.celda» (40.5 pt), que es la segunda
            retícula de I.1.3, no de «reticula.columna». En la segunda muestra las
            tres celdas ausentes desaparecen y las restantes se ensanchan hasta
            ocupar el riel completo, sin dejar hueco. En la cuarta, las dos celdas
            vecinas llevan la misma palabra: la de diagnóstico va en IBM Plex Sans
            11 / 16, única excepción de familia del riel, y la de fecha en la
            neo-grotesca del rol «dato».
          </Text>
        </View>
      </Page>

      <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.pagina}>
        <View style={estilos.guiaZonaSegura} fixed />
        <View style={estilos.guiaCaja} fixed />

        <View style={estilos.contenido}>
          <Rotulo>2.E campo · los tres estados, uno junto a otro</Rotulo>
          <View style={[estilos.muestra, estilos.filaCampos]}>
            <Campo etiqueta="Genérico" valor="Amoxicilina" requerido />
            <Campo etiqueta="Nombre comercial" requerido />
            {/* Este tercero no se ve: colapsa entero. Está aquí para que se
                compruebe que entre el segundo y el borde no queda nada. */}
            <Campo etiqueta="Proyecciones" requerido={false} />
          </View>
          <View style={estilos.marcaArranque} />

          <View style={estilos.seccion}>
            <Rotulo>2.E campo · tres campos, el del medio opcional vacio</Rotulo>
            <View style={[estilos.muestra, estilos.filaCampos]}>
              <Campo etiqueta="Genérico" valor="Amoxicilina" requerido />
              <Campo etiqueta="Presentación" requerido={false} />
              <Campo etiqueta="Vía" valor="Oral" requerido />
            </View>
          </View>

          <View style={estilos.seccion}>
            <Rotulo>2.E campo · la misma fila sin el campo del medio</Rotulo>
            <View style={[estilos.muestra, estilos.filaCampos]}>
              <Campo etiqueta="Genérico" valor="Amoxicilina" requerido />
              <Campo etiqueta="Vía" valor="Oral" requerido />
            </View>
          </View>

          <Text style={estilos.nota}>
            2.E · Campo. Las dos filas de abajo tienen que ser IDÉNTICAS: la
            primera lleva tres campos con el del medio en «vacío opcional» y la
            segunda solo los dos que quedan. Si el colapso dejara aire, «Vía»
            estaría más a la derecha en la primera. La separación entre campos es
            del contenedor, no del campo: por eso un campo que colapsa tampoco se
            lleva su separación. Arriba, los dos estados con tinta: la diferencia
            entre «con valor» y «vacío requerido» vive entera bajo el rótulo, y el
            segundo mide 4 pt más porque el espacio de escritura es más alto que un
            renglón de texto. No lleva ninguna leyenda de error: el rótulo y la
            línea ya dicen qué falta y dónde se escribe.
          </Text>
        </View>
      </Page>

      <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.pagina}>
        <View style={estilos.guiaZonaSegura} fixed />
        <View style={estilos.guiaCaja} fixed />

        <View style={estilos.contenido}>
          <Rotulo>2.F riel · variante celdas, dos filas</Rotulo>
          <View style={estilos.muestra}>
            <RielDatos
              variante="celdas"
              filas={[CELDAS_2F.fila1, CELDAS_2F.fila2]}
            />
          </View>

          <View style={estilos.seccion}>
            <Rotulo>2.F riel · variante una linea</Rotulo>
            <View style={estilos.muestra}>
              <RielDatos variante="unaLinea" celdas={CELDAS_2F.fila1} />
            </View>
          </View>

          <View style={estilos.seccion}>
            <Rotulo>2.F riel · celdas, con la del medio colapsada</Rotulo>
            <View style={estilos.muestra}>
              <RielDatos
                variante="celdas"
                filas={[
                  [
                    CELDAS_2F.fila1[0],
                    { ...CELDAS_2F.fila1[1], valor: undefined },
                    CELDAS_2F.fila1[2],
                  ],
                  CELDAS_2F.fila2,
                ]}
              />
            </View>
          </View>

          <View style={estilos.seccion}>
            <Rotulo>2.D sobre 2.F · el riel del paciente, sin cambios</Rotulo>
            <View style={estilos.muestra}>
              <BloquePaciente variante="completo" {...PACIENTE_FICTICIO} />
            </View>
          </View>

          <Text style={estilos.nota}>
            2.F · RielDatos. Las dos primeras muestras son la misma fila con las
            dos variantes de composición: arriba dentro de un riel de dos filas,
            debajo como riel de una sola. En la tercera, «Turno» no trae dato:
            desaparece y «Servicio» y «Cama» se ensanchan hasta llenar el riel, sin
            dejar hueco ni regla suelta. La cuarta es 2.D compuesto ya sobre 2.F —
            sus reglas verticales caen en 202.5, 283.5 y 364.5 pt, que son 5, 2, 2
            y 3 columnas de «riel.celda», exactamente donde caían cuando 2.D
            componía su propio riel.
          </Text>
        </View>
      </Page>

      <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.pagina}>
        <View style={estilos.guiaZonaSegura} fixed />
        <View style={estilos.guiaCaja} fixed />

        <View style={estilos.contenido}>
          <Rotulo>2.H negativo · via corta y via larga, una junto a otra</Rotulo>
          <View style={[estilos.muestra, estilos.filaBloques]}>
            <BloqueNegativo variante="via" via="oral" />
            <BloqueNegativo variante="via" via="intramuscular" />
          </View>

          <View style={estilos.seccion}>
            <Rotulo>2.H negativo · via acentuada, para el gate de I.3.1</Rotulo>
            <View style={estilos.muestra}>
              <BloqueNegativo variante="via" via="transdérmica" />
            </View>
          </View>

          <View style={estilos.seccion}>
            <Rotulo>2.H negativo · badge urgente y su repeticion reducida</Rotulo>
            <View style={[estilos.muestra, estilos.filaBloques]}>
              <BloqueNegativo variante="urgente" />
              <BloqueNegativo variante="urgenteReducido" />
            </View>
          </View>

          <Text style={estilos.nota}>
            2.H · BloqueNegativo. Los dos bloques de arriba tienen que medir
            ANCHOS CLARAMENTE DISTINTOS y las dos palabras leerse enteras: el
            ancho es la variable, el cuerpo no. Si midieran lo mismo, alguien puso
            un ancho fijo y la palabra larga está comprimida o cortada. Ninguna se
            abrevia y ninguna lleva elipsis. El badge reducido de la última
            muestra imprime la misma palabra al mismo cuerpo: lo único que pierde
            es aire lateral, de 8 pt a 4 pt por lado.
          </Text>
        </View>
      </Page>

      <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.pagina}>
        <View style={estilos.guiaZonaSegura} fixed />
        <View style={estilos.guiaCaja} fixed />

        <View style={estilos.contenido}>
          <Rotulo>2.I destacado · alarma, filete superior e izquierdo</Rotulo>
          <View style={estilos.muestra}>
            <BloqueDestacado variante="alarma" texto={TEXTO_2I.alarma} />
          </View>

          <View style={estilos.destacado}>
            <Rotulo>2.I destacado · instrucciones, solo izquierdo</Rotulo>
            <View style={estilos.muestra}>
              <BloqueDestacado
                variante="instrucciones"
                texto={TEXTO_2I.instrucciones}
              />
            </View>
          </View>

          <View style={estilos.destacado}>
            <Rotulo>2.I destacado · cita, solo izquierdo</Rotulo>
            <View style={estilos.muestra}>
              <BloqueDestacado variante="cita" texto={TEXTO_2I.cita} />
            </View>
          </View>

          <Text style={estilos.nota}>
            2.I · BloqueDestacado. Ninguna de las tres lleva trama ni fondo detrás
            del texto: solo filete. La jerarquía la carga el grosor —3, 2 y 1.6
            pt—, que es lo único que sobrevive intacto a una fotocopia, y el de
            alarma se ve claramente más grueso que el de cita. La alarma es la
            única con filete superior, y su texto va en «alarma.cuerpo», un punto
            por encima del texto corrido de las otras dos. Las tres componen ya a
            través de 2.J: la de «instrucciones» sale NUMERADA porque ahí la
            secuencia significa algo, y las otras dos entran como prosa y salen
            como prosa — que es la degradación segura del parser, no una excepción
            de este componente.
          </Text>
        </View>
      </Page>

      <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.pagina}>
        <View style={estilos.guiaZonaSegura} fixed />
        <View style={estilos.guiaCaja} fixed />

        <View style={estilos.contenido}>
          <Rotulo>2.K contador · hoja intermedia</Rotulo>
          <View style={estilos.muestra}>
            <ContadorLista
              forma="intermedia"
              items="estudios"
              enEstaHoja={5}
              total={9}
            />
          </View>

          <View style={estilos.seccion}>
            <Rotulo>2.K contador · hoja final</Rotulo>
            <View style={estilos.muestra}>
              <ContadorLista forma="final" items="estudios" total={9} />
            </View>
          </View>

          <Text style={estilos.nota}>
            2.K · ContadorLista. Las dos formas dicen cosas distintas y se
            distinguen a simple vista: la intermedia cuenta lo que lleva ESA hoja y
            de cuántas, la final da el total. Si la hoja 1 mostrara el total,
            estaría contando el documento y no la hoja, y quien la recibe suelta no
            podría saber que le falta la 2. El sustantivo —aquí ESTUDIOS, de la
            Solicitud de Laboratorio— lo declara el formato en la Sección II; el
            componente no lo conoce. Va en «pie» en versalita, pero en
            «tinta.secundaria» y no en «tinta.papel»: vive en el área de contenido,
            no sobre la banda de acento.
          </Text>
        </View>
      </Page>

      <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.pagina}>
        <View style={estilos.guiaZonaSegura} fixed />
        <View style={estilos.guiaCaja} fixed />

        <View style={estilos.contenido}>
          <Rotulo>2.J parser · la verificacion visible de la ficha</Rotulo>
          <View style={estilos.muestra}>
            <ParserBloques texto={VERIFICACION_2J} marca="raya" />
          </View>

          <Text style={estilos.nota}>
            2.J · ParserBloques. Los DOS PRIMEROS RENGLONES salen en minúsculas,
            en humanista, sin raya y sin número: son prosa sin viñetas y sin ítems
            debajo. Si salieran en versalita, no hay lookahead — y ese es el bug
            que ya apareció una vez, en el mockup de Internamiento. El tercer
            renglón sí sale en versalita, y no por llevar dos puntos sino porque
            debajo tiene viñetas. La raya cuelga en el riel y el texto sangra una
            columna exacta: 23.25 + 9 = 32.25 pt.
          </Text>
        </View>
      </Page>

      <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.pagina}>
        <View style={estilos.guiaZonaSegura} fixed />
        <View style={estilos.guiaCaja} fixed />

        <View style={estilos.contenido}>
          {CASOS_2J.slice(0, 4).map((caso) => (
            <MuestraParser
              key={caso.rotulo}
              rotulo={caso.rotulo}
              texto={caso.texto}
              marca={caso.marca}
            />
          ))}

          <Text style={estilos.nota}>
            Los cuatro primeros casos de la batería, en el mismo orden en que se
            prueban. El 2 va primero. En el 4, el ítem único se compone como
            párrafo y NO lleva número, aunque la muestra pida numeración: una lista
            de uno no es una lista. Distíngase de 2.G, donde una sola entrada sí
            lleva su «01».
          </Text>
        </View>
      </Page>

      <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.pagina}>
        <View style={estilos.guiaZonaSegura} fixed />
        <View style={estilos.guiaCaja} fixed />

        <View style={estilos.contenido}>
          {CASOS_2J.slice(4).map((caso) => (
            <MuestraParser
              key={caso.rotulo}
              rotulo={caso.rotulo}
              texto={caso.texto}
              marca={caso.marca}
            />
          ))}

          <Text style={estilos.nota}>
            Los tres restantes. En el 5, los dos puntos van dentro de un ítem y no
            lo ascienden a encabezado: el tipo lo decide la viñeta y el lookahead,
            nunca la puntuación. En el 6 la línea azul queda pegada al rótulo — la
            cadena vacía no monta ningún nodo, así que no deja hueco. En el 7 la
            numeración corre entre los dos bloques: 1, 2, 3, 4, sin repetir el 1 al
            abrir el segundo.
          </Text>
        </View>
      </Page>
    </Document>
  )
}

/** Genera el blob del PDF del taller. Se llama desde el cliente. */
export async function generarPdfTaller(
  medico: MedicoFicticio,
  acentoHex: string,
): Promise<Blob> {
  registrarFuentesV2()
  const elemento: ReactElement<DocumentProps> = (
    <HojaTaller medico={medico} acento={resolverAcento(acentoHex)} />
  )
  return pdf(elemento).toBlob()
}
