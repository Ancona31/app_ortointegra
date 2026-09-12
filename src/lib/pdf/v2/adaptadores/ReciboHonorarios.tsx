/**
 * Adaptador de II.5 · **Recibo de Honorarios / Cotización**.
 *
 * Lo que la fila guarda (`NotaHonorariosForm`, `contenido`):
 *
 *   paciente · fecha · tipo_doc: 'honorarios' | 'cotizacion' · divisa · notas
 *   lineas: { concepto, precio: number, origen? }[] · monto: number
 *   cotización → vigencia_dias: number · vigencia_hasta: ISO · subtotales · aseguradora
 *   recibo     → forma_pago · anticipo: number · saldo: number
 *
 * ── LAS CIFRAS SON NÚMEROS EN LA FILA Y CADENAS EN EL PAPEL ─────────────────
 *
 * `precio`, `monto`, `anticipo`, `saldo` y los subtotales se guardan como números
 * y el formato los quiere **ya compuestos**: I.3.6 dice que el documento coloca,
 * no calcula ni formatea. La redacción es la misma de v1 —`toLocaleString` con la
 * divisa—, y por eso el recibo reimpreso dice la misma cifra que el entregado.
 *
 * ── EL DISCRIMINANTE MANDA, Y ES EL DEL FORMULARIO ──────────────────────────
 *
 * `tipo_doc` separa dos documentos que comparten tabla y no serie de folio —NOH
 * contra COT—. La unión del formato es discriminada por él a propósito: pasarle un
 * anticipo a una cotización o una aseguradora a un recibo no compila.
 *
 * Cualquier valor que no sea `cotizacion` es un recibo, que es exactamente lo que
 * hace el trigger de la base al elegir la serie.
 */

import type { ReactElement } from 'react'
import type { DocumentProps } from '@react-pdf/renderer'
import ReciboHonorarios, {
  type AseguradoraCotizacion,
  type ConceptoCobrado,
  type Divisa,
  type ReciboHonorariosProps,
} from '../formatos/ReciboHonorarios'
import {
  comunes, envolver, fechaCorta, filas, numero, rubricaDe, texto,
  textoOpcional, type EntradaAdaptador,
} from './comun'

/** El signo de menos tipográfico, no el guion del teclado. */
const MENOS = '−'

/** Las dos divisas del catálogo. Cualquier otra cosa colapsa la celda. */
function divisaDe(valor: unknown): Divisa | undefined {
  return valor === 'MXN' || valor === 'USD' ? valor : undefined
}

/**
 * `$45,000.00`. Mismo criterio que `NotaHonorariosPdf` y que el formulario: la
 * divisa decide la configuración regional, no solo el símbolo.
 *
 * Sin cifra no hay cadena: es lo que hace colapsar el anticipo y su saldo.
 */
function importe(valor: unknown, divisa: Divisa | undefined): string | undefined {
  const n = numero(valor)
  if (n === undefined) return undefined
  const codigo = divisa ?? 'MXN'
  return n.toLocaleString(codigo === 'MXN' ? 'es-MX' : 'en-US', {
    style: 'currency',
    currency: codigo,
  })
}

function lineaDe(fila: Record<string, unknown>, divisa: Divisa | undefined): ConceptoCobrado {
  return {
    concepto: texto(fila.concepto),
    precio: importe(fila.precio, divisa) ?? '',
    origen: textoOpcional(fila.origen),
  }
}

/** Colapsa ENTERA, no por celdas: sin nombre no hay caja de aseguradora. */
function aseguradoraDe(valor: unknown): AseguradoraCotizacion | undefined {
  if (typeof valor !== 'object' || valor === null || Array.isArray(valor)) return undefined
  const fila = valor as Record<string, unknown>
  const nombre = texto(fila.nombre)
  if (nombre === '') return undefined
  return {
    nombre,
    poliza: textoOpcional(fila.poliza),
    cobertura: textoOpcional(fila.cobertura),
  }
}

/**
 * `Hasta el 12 sep 2026`.
 *
 * La compone el cable y no el formato: son dos claves de la fila —`vigencia_dias`
 * y `vigencia_hasta`— y una sola celda del riel, y redactar la fecha en español es
 * formatear, que es justo lo que el contrato de 2.D excluye. Ver la nota junto a
 * `paciente` en el formato.
 *
 * ── POR QUÉ LA FECHA SOLA, Y NO EL PLAZO MÁS LA FECHA ───────────────────────
 *
 * El formato pedía `30 días · hasta el 7 de septiembre de 2026`. **No cabe, y
 * está medido**: la celda es de 3 columnas —114.75 pt— y admite unos 20
 * caracteres en un renglón. Contando las operaciones de texto del PDF, esa cadena
 * compone TRES renglones donde la lámina tiene uno; `30 días · 12 sep 2026`, con
 * 21 caracteres, todavía compone dos. Un valor que crece de renglón mueve el alto
 * del riel según lo que traiga, que es la violación de I.3.4 que el sistema
 * persigue en todas partes.
 *
 * De los dos datos se conserva **el que se cita**: nadie pregunta cuántos días
 * duraba una cotización, preguntan hasta cuándo vale. El rótulo de la celda ya
 * dice `Vigencia`, así que la frase se lee entera. Sin fecha —filas viejas— cae al
 * plazo, que es mejor que una celda vacía.
 */
function vigenciaDe(data: Record<string, unknown>): string | undefined {
  const hasta = fechaCorta(data.vigencia_hasta)
  if (hasta !== undefined) return `Hasta el ${hasta}`

  const dias = numero(data.vigencia_dias)
  return dias === undefined ? undefined : `${dias} ${dias === 1 ? 'día' : 'días'}`
}

export function propsReciboHonorarios(entrada: EntradaAdaptador): ReciboHonorariosProps {
  const { data } = entrada
  const divisa = divisaDe(data.divisa)
  const esCotizacion = data.tipo_doc === 'cotizacion'

  const comun = {
    ...comunes(entrada),
    /*
     * Tres celdas y ninguna más: no hay edad, ni sexo, ni expediente, ni
     * diagnóstico. `paciente` puede ir vacío —es el único formato donde la celda
     * no colapsa sino que deja la línea— y por eso se pasa `texto()` y no
     * `textoOpcional()`.
     */
    paciente: {
      paciente: texto(data.paciente),
      fecha: fechaCorta(data.fecha),
      vigencia: esCotizacion ? vigenciaDe(data) : undefined,
    },
    lineas: filas(data.lineas).map(fila => lineaDe(fila, divisa)),
    monto: importe(data.monto, divisa) ?? '',
    divisa,
    notas: textoOpcional(data.notas),
    folio: texto(data.folio),
    rubrica: rubricaDe(entrada.medico),
  }

  if (esCotizacion) {
    return {
      ...comun,
      tipo_doc: 'cotizacion',
      subtotales: filas(data.subtotales).map(fila => ({
        origen: texto(fila.origen),
        total: importe(fila.total, divisa) ?? '',
      })),
      aseguradora: aseguradoraDe(data.aseguradora),
    }
  }

  // El anticipo lleva su signo: es dinero que se resta del total. Sin anticipo no
  // hay bloque, y sin bloque el saldo no tiene dónde colgarse (2.T regla 3).
  const anticipo = importe(data.anticipo, divisa)
  const hayAnticipo = (numero(data.anticipo) ?? 0) > 0

  return {
    ...comun,
    tipo_doc: 'honorarios',
    anticipo: hayAnticipo && anticipo !== undefined ? `${MENOS}${anticipo}` : undefined,
    saldo: hayAnticipo ? importe(data.saldo, divisa) : undefined,
    forma_pago: textoOpcional(data.forma_pago),
  }
}

export function renderReciboHonorariosV2(
  entrada: EntradaAdaptador,
): ReactElement<DocumentProps> {
  const props = propsReciboHonorarios(entrada)
  return envolver(
    props.tipo_doc === 'cotizacion' ? 'Cotización' : 'Recibo de honorarios',
    <ReciboHonorarios {...props} />,
  )
}
