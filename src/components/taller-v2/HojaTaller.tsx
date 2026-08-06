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
