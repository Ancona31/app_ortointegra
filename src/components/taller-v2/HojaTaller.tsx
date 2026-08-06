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
