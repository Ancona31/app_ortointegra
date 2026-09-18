/**
 * Sistema de documentos v3 — formato **II.9 · Denegación o Revocación del
 * Consentimiento**. Brief `09`.
 *
 * Documento INDEPENDIENTE de una hoja, que se emite **en lugar** del consentimiento
 * cuando el paciente rechaza el procedimiento o revoca una autorización previa. **No es
 * una hoja de II.7** y **no es el Consentimiento con menos cosas**, que es el error
 * fácil de cometer: comparte con él la anatomía de celda de declaración y el marco de
 * su párrafo, y **sus dos aires de encabezado son los del chasis**.
 *
 * ── LO QUE CAMBIA RESPECTO DE v2 ────────────────────────────────────────────
 *
 * 1. **CABE EN UNA HOJA, SIEMPRE** (defecto §7). En v2 el caso denso se iba a dos, y la
 *    causa estaba medida: un título de dos renglones, una ficha de cuatro filas y la
 *    credencial del médico partida. Tres cosas lo cierran, y las tres son del chasis:
 *    el título con `maxLines: 2` + elipsis, la ficha reducida a **dos filas** con
 *    hospital y lugar unidos en la misma, y la banda de cierre de 83.75 en vez de 105.4.
 * 2. **El diagnóstico sale de la declaración** (brief 00 §5.2): se imprime una sola vez
 *    por documento, y en este formato vive en la ficha. La declaración cita el
 *    procedimiento, que es lo que se revoca.
 * 3. **El médico firma a la izquierda**, como en los otros ocho.
 * 4. **Sin aviso de continuación** (`aviso={false}`): un documento de una hoja por
 *    construcción no anuncia una hoja 2 que no existe.
 *
 * ── LA VARIANTE POR SUSTITUCIÓN ─────────────────────────────────────────────
 *
 * Cuando el paciente no puede firmar, la banda de cierre pasa de **tres celdas**
 * —médico, paciente, familiar— a **dos** —médico, familiar—, y aparece la constancia
 * del motivo: un bloque con fondo al velo del acento donde el médico asienta por qué
 * firma otro. Es la única rama del formato, y su holgura es de **26.04 pt**: por eso los
 * dos aires del encabezado son los del chasis y no los del Consentimiento — con
 * aquéllos, el documento mide 258.59 de encabezado en vez de 240.59 y esos 18 pt salen
 * justo de aquí.
 */

import { Page, StyleSheet, Text, View } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import BloqueFirmas, { type CeldaFirma, type Firma } from '../BloqueFirmas'
import MarcoParcial, { MARCO } from '../MarcoParcial'
import MotorFlujo from '../MotorFlujo'
import PieDocumento from '../PieDocumento'
import type { ConsultorioMembrete, MedicoMembrete } from '../Membrete'
import type { PanelCircularProps } from '../PanelCircular'
import type { CeldaPaciente, ValoresPaciente } from '../BloquePaciente'
import {
  CAJA,
  ESPACIO,
  MARGEN,
  PAPEL,
  TINTA,
  TRANSICION,
  estiloTipografico,
  veloDeAcento,
  type AcentoResuelto,
} from '../tokens'

const TITULO = 'Denegación o revocación del consentimiento'
const ROTULO_MOTIVO = 'Motivo por el que el paciente no firma'
const NOTA_SUSTITUCION =
  'El paciente no puede firmar por sí mismo; firma en su lugar el familiar o responsable, cuyos datos se asientan en el recuadro de la derecha.'
const ROL_MEDICO = 'Médico tratante'
const ROL_PACIENTE = 'Paciente'
const ROL_FAMILIAR = 'Familiar o responsable'
const NOTA_PACIENTE = 'Nombre y firma'
const NOTA_FAMILIAR = 'Representante del paciente'

const PRESENCIA_DECLARACION = 96

/** Velo del acento para la constancia de motivo. El 6 % del sistema. */
const PROPORCION_VELO = 0.06

/**
 * Dos filas y no cuatro. Ver el punto 1 de la cabecera: hospital y lugar comparten la
 * segunda, y el familiar es **campo vacío requerido** —sin dato conserva su rótulo y
 * deja la línea—.
 */
const FICHA: readonly (readonly CeldaPaciente[])[] = [
  [
    { campo: 'paciente', columnas: 6 },
    { campo: 'edad', columnas: 3 },
    { campo: 'fecha', columnas: 3 },
  ],
  [
    { campo: 'familiar', columnas: 4 },
    { campo: 'hospital', columnas: 5, etiqueta: 'Hospital o clínica' },
    { campo: 'lugar', columnas: 3 },
  ],
]

export interface FirmanteDenegacion {
  /** Sin nombre, el renglón se reserva para llenarlo a mano. */
  readonly nombre?: string
  readonly rubrica?: string
}

export interface DenegacionConsentimientoProps {
  readonly medico: MedicoMembrete
  readonly consultorio: ConsultorioMembrete
  readonly panel: PanelCircularProps
  readonly acento: AcentoResuelto
  readonly paciente: ValoresPaciente
  /** El procedimiento que se rechaza o revoca. Bloquea emisión. */
  readonly procedimiento: string
  readonly firmantes: {
    readonly medico: FirmanteDenegacion
    readonly paciente: FirmanteDenegacion
    readonly familiar: FirmanteDenegacion
  }
  /** `true` cuando el paciente no puede firmar. Ver la variante por sustitución. */
  readonly sustitucion: boolean
  /** Motivo asentado por el médico. Sólo se compone con `sustitucion`. */
  readonly motivo?: string
  readonly folio: string
}

const estilos = StyleSheet.create({
  hoja: {
    backgroundColor: TINTA.papel,
    paddingTop: MARGEN.superior,
    paddingLeft: MARGEN.izquierdo,
    paddingRight: MARGEN.derecho,
    paddingBottom: MARGEN.inferior,
  },
  declaracion: { marginBottom: ESPACIO[12] },
  parrafo: {
    ...estiloTipografico('seccion.parrafo'),
    /**
     * ⚠ **LA PRIMERA DE LAS DOS EXCEPCIONES DECLARADAS A I.3.2** vive en el
     * Consentimiento; ésta es la MISMA decisión aplicada a su documento hermano —«el
     * Consentimiento va justificado, y con él toda la familia D»—. `grep -rn
     * "'justify'"` tiene que devolver tres líneas contadas: II.7, II.8 y ésta.
     */
    textAlign: 'justify',
    marginBottom: ESPACIO[8],
  },
  fuerte: { fontWeight: 500 },
  nota: { ...estiloTipografico('texto.reducido'), marginBottom: ESPACIO[10] },
  rotulo: { ...estiloTipografico('etiqueta') },
  motivo: { ...estiloTipografico('seccion.parrafo') },
  banda: { marginTop: TRANSICION.contenidoCierre },
})

/** II.9 · Denegación o Revocación del Consentimiento. */
export default function DenegacionConsentimiento({
  medico,
  consultorio,
  panel,
  acento,
  paciente,
  procedimiento,
  firmantes,
  sustitucion,
  motivo,
  folio,
}: DenegacionConsentimientoProps): ReactElement {
  const celdaMedico: Firma = {
    rol: ROL_MEDICO,
    nombre: firmantes.medico.nombre ?? medico.nombre,
    credenciales: medico.cedulas,
    rubrica: firmantes.medico.rubrica,
  }
  const celdaPaciente: Firma = {
    rol: ROL_PACIENTE,
    nombre: firmantes.paciente.nombre ?? paciente.paciente,
    credenciales: [NOTA_PACIENTE],
    pesoNombre: 600,
  }
  const nombreFamiliar = firmantes.familiar.nombre ?? paciente.familiar
  const celdaFamiliar: Firma = {
    rol: ROL_FAMILIAR,
    nombre: nombreFamiliar,
    credenciales: [NOTA_FAMILIAR],
  }

  /**
   * Tres celdas en el caso normal y dos en la sustitución. Los huecos NO se usan aquí:
   * cuando el paciente no firma, su celda **no existe** —no es una firma pendiente, es
   * una firma que no se le pidió—, y lo que dice que no la dio es la constancia de
   * motivo. Es la diferencia con el testigo ausente del Consentimiento.
   *
   * ⚠ **SOLO FIRMA QUIEN TIENE NOMBRE, y esa regla faltaba.** La celda del familiar se
   * componía siempre, así que una denegación firmada por el paciente y sin familiar
   * declarado sacaba una tercera columna rotulada y vacía: el papel decía que se previó
   * una firma que nadie pidió. En la sustitución no aplica —ahí el familiar es quien
   * firma y su nombre es obligatorio por construcción—.
   */
  const hayFamiliar = nombreFamiliar !== undefined && nombreFamiliar.trim() !== ''
  const firmas: readonly CeldaFirma[] = sustitucion
    ? [celdaMedico, celdaFamiliar]
    : hayFamiliar
      ? [celdaMedico, celdaPaciente, celdaFamiliar]
      : [celdaMedico, celdaPaciente]

  return (
    <Page size={[PAPEL.ancho, PAPEL.alto]} style={estilos.hoja}>
      <MotorFlujo
        encabezado={{
          medico,
          consultorio,
          panel,
          acento,
          titulo: TITULO,
          /* El subtítulo nombra el procedimiento revocado, con una línea y elipsis: es
             el recorte que devuelve este documento a su hoja única. */
          subtitulo: procedimiento,
          folio,
          paciente,
          filasFicha: FICHA,
          calibracionFicha: 'declaracion',
        }}
        /* Ver el punto 4 de la cabecera. */
        aviso={false}
        firmas={
          <View style={estilos.banda}>
            {/*
              Dos ramas y no un ternario dentro de las props: `BloqueFirmasProps` es una
              unión discriminada por `variante`, y `pareja` exige exactamente dos celdas
              y no admite `columnas`.
            */}
            {sustitucion ? (
              <BloqueFirmas variante="pareja" firmas={[firmas[0]!, firmas[1]!]} />
            ) : (
              <BloqueFirmas variante="reticula" firmas={firmas} columnas={3} />
            )}
          </View>
        }
      >
        <View style={estilos.declaracion} minPresenceAhead={PRESENCIA_DECLARACION}>
          <MarcoParcial padding={MARCO.leyenda} ancho={CAJA.ancho} color={acento.base}>
            <Text style={estilos.parrafo}>
              {'Yo, '}
              <Text style={estilos.fuerte}>{paciente.paciente}</Text>
              {/*
                ⚠⚠ **EL INCISO DEL DIAGNÓSTICO, Y FALTABA EN LA ENTREGA.**

                Este documento **no compone el diagnóstico en ningún otro sitio**: su ficha
                no lleva esa celda, a diferencia de la del Consentimiento. Sin el inciso, la
                denegación salía sin decir de qué se estaba denegando el tratamiento, que en
                un documento que acredita una negativa es contenido, no adorno. Se repone
                con la fórmula de v2, que es también la del puente de v1.

                **DESAPARECE ENTERO CUANDO NO HAY DIAGNÓSTICO**: sin hueco, sin guion y sin
                coma doble. La coma que abre el inciso viaja DENTRO de él y la que cierra
                abre el tramo siguiente, así que `Yo, X, declaro…` sale bien puntuado en los
                dos casos.
              */}
              {paciente.diagnostico === undefined || paciente.diagnostico.trim() === '' ? null : (
                <>
                  {', con diagnóstico de '}
                  <Text style={estilos.fuerte}>{paciente.diagnostico}</Text>
                </>
              )}
              {', declaro que he sido informado de manera clara y completa sobre el procedimiento '}
              <Text style={estilos.fuerte}>{procedimiento}</Text>
              {/*
                ⚠ SIN ARTÍCULO ANTES DEL NOMBRE, y llevaba `por el`. El nombre ya trae
                su tratamiento —`Dra. Elena Marín Solís`—, así que el artículo fijo en
                masculino componía `por el Dra.` en cuanto firma una médica. Es la misma
                redacción que usa la declaración de II.7, que nunca lo llevó.
              */}
              {', sus riesgos, beneficios y alternativas, por '}
              <Text style={estilos.fuerte}>{medico.nombre}</Text>
              {'.'}
            </Text>
            <Text style={estilos.parrafo}>
              No obstante, en pleno uso de mis facultades y de forma libre y voluntaria,
              manifiesto mi decisión de no autorizar o revocar la autorización previamente
              otorgada para la realización del procedimiento descrito, asumiendo las
              consecuencias que de ello puedan derivarse, las cuales me han sido explicadas.
            </Text>
            <Text style={estilos.parrafo}>
              Se me ha informado que puedo cambiar de opinión y otorgar mi consentimiento en
              cualquier momento.
            </Text>
          </MarcoParcial>
        </View>

        {!sustitucion ? null : (
          <>
            <Text style={estilos.nota}>{NOTA_SUSTITUCION}</Text>
            {motivo === undefined || motivo.trim() === '' ? null : (
              /*
                El fondo al velo del acento NO es el único portador de significado
                (I.3.3): el bloque se distingue además por su rótulo en versalita. En
                fotocopia sigue siendo un recuadro rotulado.
              */
              <View
                style={{
                  backgroundColor: veloDeAcento(acento.base, PROPORCION_VELO),
                  padding: ESPACIO[10],
                  marginBottom: ESPACIO[12],
                }}
                wrap={false}
              >
                <Text style={estilos.rotulo}>{ROTULO_MOTIVO.toUpperCase()}</Text>
                <Text style={estilos.motivo}>{motivo}</Text>
              </View>
            )}
          </>
        )}
      </MotorFlujo>

      {/*
        `completo`: la denegación se archiva y se cita por folio —es el documento que
        acredita que un procedimiento NO se autorizó—.
      */}
      <PieDocumento variante="completo" folio={folio} documento={TITULO} acento={acento} />
    </Page>
  )
}
