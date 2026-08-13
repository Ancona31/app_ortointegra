/**
 * Adaptador de II.7 · **Consentimiento Informado**.
 *
 * Lo que la fila guarda (`ConsentimientoInformadoForm`, `contenido`):
 *
 *   paciente · lugar · fecha · edad · procedimiento · diagnostico · familiar
 *   testigo1 · testigo2 · autorizaTransfusion · autorizaFotos · pacienteNoPuedeFirmar
 *   secciones: { preoperatorio, beneficios, anestesia, descripcion,
 *                riesgosComunes, riesgosEspecificos, alternativas }
 *
 * Y lo que **solo existe en el acto de sellar** y no se persiste en `contenido`:
 * `firmas`, `selladoEn`, `huella` e `identificaciones`. Están en la tabla
 * `firmas_documento` y en Storage, no en la fila; al regenerar llegan ausentes y
 * el documento sale con las celdas para la pluma, que es lo que hace hoy v1 por
 * ese mismo camino.
 *
 * ── LOS CINCO FIRMANTES, Y QUIÉN TIENE CELDA ────────────────────────────────
 *
 * El formato decide que existe una celda cuando el firmante trae nombre o sello
 * —`pidioFirma`—, así que aquí basta con pasar los cinco: quien llegó con el
 * nombre vacío no tiene celda, y es lo que implementa «solo firma quien tiene
 * nombre».
 *
 * ── UNA DIFERENCIA DELIBERADA CON v1, Y HAY QUE MIRARLA ─────────────────────
 *
 * v1 estampaba la rúbrica del médico **solo si el documento se había sellado**; en
 * uno impreso para firma manual dejaba su celda en blanco. v2 la imprime siempre,
 * como los otros ocho formatos: es lo que declara el formato —«el médico es el
 * único cuya rúbrica se imprime siempre»— y lo que hace el sistema entero. El
 * médico ya firmó lo que emite; quien tiene que firmar delante es el paciente.
 */

import type { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import ConsentimientoInformado, {
  type ConsentimientoInformadoProps,
  type FirmanteConsentimiento,
  type IdentificacionAnexo,
} from '../formatos/ConsentimientoInformado'
import {
  bandera, comunes, envolver, fechaCorta, filas, rubricaDe, texto, textoOpcional,
  type EntradaAdaptador,
} from './comun'

/** Los cinco roles, con el nombre que usan `firmas_documento` y el flujo de firmado. */
type Rol = 'medico' | 'paciente' | 'familiar' | 'testigo_1' | 'testigo_2'

/**
 * `09/08/2026 12:41:52`. La misma composición que v1 —`selloLegible`— para que un
 * consentimiento sellado y su reimpresión digan la misma hora.
 *
 * Aquí sí se pasa por `Date`: `firmadoEn` es un instante ISO completo, no una
 * fecha de calendario, así que no hay corrimiento de día que evitar.
 */
function selloLegible(iso: unknown): string | undefined {
  const bruto = texto(iso)
  if (bruto === '') return undefined
  const d = new Date(bruto)
  if (Number.isNaN(d.getTime())) return undefined
  const p = (n: number): string => String(n).padStart(2, '0')
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`
    + ` ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}

/** Índice de las firmas capturadas por rol. Vacío en un documento sin sellar. */
function firmasPorRol(valor: unknown): Map<string, Record<string, unknown>> {
  return new Map(filas(valor).map(f => [texto(f.rol), f]))
}

function firmanteDe(
  rol: Rol,
  nombre: string | undefined,
  porRol: Map<string, Record<string, unknown>>,
): FirmanteConsentimiento {
  const firma = porRol.get(rol)
  return {
    nombre,
    rubrica: textoOpcional(firma?.trazo),
    sello: selloLegible(firma?.firmadoEn),
  }
}

function identificacionDe(fila: Record<string, unknown>): IdentificacionAnexo {
  return {
    rol: texto(fila.rol),
    nombre: texto(fila.nombre),
    // El tipo y el número no se piden: el dato está impreso en la credencial
    // fotografiada y teclearlo introduce divergencia en un documento legal. El
    // pie del recuadro colapsa. Decisión cerrada — RANURAS_MUERTAS §2.
    tipo: textoOpcional(fila.tipo),
    numero: textoOpcional(fila.numero),
    foto: textoOpcional(fila.foto),
  }
}

/** `'si' | 'no'`, y nada más: el campo es de tres estados y el tercero es no contestar. */
function transfusion(valor: unknown): 'si' | 'no' | undefined {
  return valor === 'si' || valor === 'no' ? valor : undefined
}

export function propsConsentimientoInformado(
  entrada: EntradaAdaptador,
): ConsentimientoInformadoProps {
  const { data } = entrada
  const porRol = firmasPorRol(data.firmas)
  const selladoEn = selloLegible(data.selladoEn)
  const huella = textoOpcional(data.huella)
  const secciones = typeof data.secciones === 'object' && data.secciones !== null
    ? (data.secciones as Record<string, unknown>)
    : {}

  return {
    ...comunes(entrada),
    paciente: {
      paciente: texto(data.paciente),
      edad: textoOpcional(data.edad),
      diagnostico: textoOpcional(data.diagnostico),
      familiar: textoOpcional(data.familiar),
      lugar: textoOpcional(data.lugar),
      fecha: fechaCorta(data.fecha),
    },
    procedimiento: texto(data.procedimiento),
    secciones: {
      preoperatorio: textoOpcional(secciones.preoperatorio),
      beneficios: textoOpcional(secciones.beneficios),
      anestesia: textoOpcional(secciones.anestesia),
      descripcion: textoOpcional(secciones.descripcion),
      riesgosComunes: textoOpcional(secciones.riesgosComunes),
      riesgosEspecificos: textoOpcional(secciones.riesgosEspecificos),
      alternativas: textoOpcional(secciones.alternativas),
    },
    firmantes: {
      // Sin nombre: el formato cae al del membrete, que es de donde tiene que
      // salir para que no haya dos juegos de datos del mismo médico en la hoja.
      medico: { rubrica: rubricaDe(entrada.medico), sello: selloLegible(porRol.get('medico')?.firmadoEn) },
      paciente: firmanteDe('paciente', textoOpcional(data.paciente), porRol),
      familiar: firmanteDe('familiar', textoOpcional(data.familiar), porRol),
      testigo1: firmanteDe('testigo_1', textoOpcional(data.testigo1), porRol),
      testigo2: firmanteDe('testigo_2', textoOpcional(data.testigo2), porRol),
    },
    pacienteNoPuedeFirmar: bandera(data.pacienteNoPuedeFirmar),
    autorizaTransfusion: transfusion(data.autorizaTransfusion),
    autorizaFotos: bandera(data.autorizaFotos),
    identificaciones: filas(data.identificaciones).map(identificacionDe),
    // Los dos juntos o ninguno: un bloque de cierre que declarara el sellado sin
    // la huella que lo acredita diría menos de lo que promete.
    sellado: selladoEn !== undefined && huella !== undefined
      ? { fecha: selladoEn, huella }
      : undefined,
    folio: texto(data.folio),
  }
}

export function renderConsentimientoInformadoV2(
  entrada: EntradaAdaptador,
): ReactElement<DocumentProps> {
  return envolver(
    'Consentimiento informado',
    <ConsentimientoInformado {...propsConsentimientoInformado(entrada)} />,
  )
}
