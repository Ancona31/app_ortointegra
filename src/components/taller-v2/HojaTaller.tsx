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
import { registrarFuentesV2 } from '@/lib/pdf/v2/fonts'
import {
  CAJA,
  ESPACIO,
  FUENTE,
  MARGEN,
  PAPEL,
  TINTA,
  TIPOGRAFIA,
  ZONA_SEGURA,
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

/**
 * DOS CONVERSIONES DE UNIDAD que todo consumidor de la escala tipográfica
 * necesita, porque el spec y react-pdf no hablan en las mismas unidades:
 *
 * - `lineHeight` numérico en react-pdf es un MULTIPLICADOR del cuerpo, y el spec
 *   declara el interlineado en pt → `interlineado / cuerpo`, que es esta función.
 * - `letterSpacing` es en pt y el spec declara el tracking en em →
 *   `tracking × cuerpo`, que se hace en cada estilo.
 */
function interlineadoRelativo(rol: { cuerpo: number; interlineado: number | null }): number {
  return (rol.interlineado ?? rol.cuerpo) / rol.cuerpo
}

const ETIQUETA = TIPOGRAFIA.etiqueta

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
  rotulo: {
    fontFamily: ETIQUETA.familia,
    fontSize: ETIQUETA.cuerpo,
    fontWeight: ETIQUETA.peso,
    lineHeight: interlineadoRelativo(ETIQUETA),
    letterSpacing: ETIQUETA.tracking * ETIQUETA.cuerpo,
    color: TINTA.etiqueta,
    marginTop: ESPACIO[8],
  },
  nota: {
    fontFamily: FUENTE.humanista,
    fontSize: TIPOGRAFIA['titulo.subtitulo'].cuerpo,
    lineHeight: interlineadoRelativo(TIPOGRAFIA['titulo.subtitulo']),
    color: TINTA.secundaria,
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
