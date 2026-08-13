/**
 * Sistema de documentos v2 — **la puerta entre lo que la fila guarda y lo que el
 * formato compone**. Piezas compartidas por los nueve adaptadores.
 *
 * ══ QUÉ ES UN ADAPTADOR, Y QUÉ NO ═══════════════════════════════════════════
 *
 * `formatos/*.tsx` recibe props tipadas y no decide nada: es la transcripción del
 * spec. `documentos.contenido` es `jsonb` sin forma garantizada. Entre los dos
 * hace falta alguien que lea lo segundo y construya lo primero, y ese es el
 * adaptador. **No compone geometría ni redacta rótulos**: coloca.
 *
 * ══ DE DÓNDE LEE, Y POR QUÉ NO DE LA OTRA ═══════════════════════════════════
 *
 * De los nombres que usa `contenido`, **nunca de los que usa el `data` que hoy
 * recibe el renderizador v1**. Son dos objetos distintos en los nueve
 * formularios, y el motivo de elegir el primero es que es EL ÚNICO QUE EXISTE AL
 * REGENERAR: meses después, lo que hay en la fila es `contenido` y nada más. Un
 * adaptador que leyera de `data` compondría bien al emitir y saldría en blanco al
 * reimprimir, que es el peor de los dos fallos posibles porque no se ve el día
 * que ocurre.
 *
 * Donde los dos objetos divergen —`tipo_doc`/`tipoDoc`, `monto`/`total`,
 * `seleccionados`/`suplementos`— el que se movió fue el formulario: pasa la clave
 * de `contenido` también en `data`. Ver el commit del cableado.
 *
 * ══ POR QUÉ LOS LECTORES SON TOLERANTES ═════════════════════════════════════
 *
 * `contenido` no tiene esquema en la base: hay mil filas escritas por versiones
 * anteriores de cada formulario. Un `as` sobre eso es una promesa que la base no
 * respalda, y este proyecto los prohíbe. Los lectores de aquí devuelven el valor
 * o el vacío que hace colapsar la ranura, que es exactamente lo que el chasis
 * espera de un dato ausente.
 *
 * ══ LA FECHA, Y POR QUÉ SE NORMALIZA EN LOS DOS SENTIDOS ════════════════════
 *
 * `contenido.fecha` es ISO —`2026-08-13`— y el `data` de emisión trae la misma
 * fecha ya redactada —`13 de agosto de 2026`—. Las dos entran por la misma clave.
 * Si el adaptador imprimiera lo que le llega, el papel emitido y el reimpreso
 * dirían la fecha de dos formas distintas, y la promesa de v2 es justo la
 * contraria. `partesDeFecha` reconoce las dos formas y `fechaLarga`/`fechaCorta`
 * componen la que pide cada ranura.
 *
 * Sin `'use client'`: módulo neutro, como el resto de v2.
 */

import { Document } from '@react-pdf/renderer'
import type { DocumentProps } from '@react-pdf/renderer'
import type { ReactElement } from 'react'
import type { PdfConsultorioData, PdfMedicoData } from '@/lib/pdf/PdfStyles'
import type { ConsultorioMembrete, MedicoMembrete } from '../Membrete'
import type { PanelCircularProps } from '../PanelCircular'
import { registrarFuentesV2 } from '../fonts'
import { resolverAcento, type AcentoResuelto } from '../tokens'

/**
 * Lo que recibe todo adaptador: **la misma firma que los `render…` de v1**, para
 * que el `switch` de `mobileShare.ts` pueda elegir rama sin construir dos juegos
 * de argumentos.
 */
export interface EntradaAdaptador {
  readonly medico: PdfMedicoData | null
  readonly data: Record<string, unknown>
  readonly logoUrl?: string
  readonly consultorio?: PdfConsultorioData
}

// ─── Lectores de `contenido` ─────────────────────────────────────────────────

/** El texto, o cadena vacía. Para las ranuras que el formato declara requeridas. */
export function texto(valor: unknown): string {
  return typeof valor === 'string' ? valor.trim() : ''
}

/**
 * El texto, o `undefined` — que es lo que hace colapsar una ranura opcional.
 *
 * La cadena vacía se convierte en ausencia a propósito: los formularios guardan
 * `''` en todo campo opcional que el médico no llenó, y `tieneValor` de 2.E ya
 * trata las dos igual. Pasar `''` compondría el rótulo con la línea vacía.
 */
export function textoOpcional(valor: unknown): string | undefined {
  const t = texto(valor)
  return t === '' ? undefined : t
}

/** Booleano estricto: solo `true` enciende. `'si'`, `1` y `'true'` no son banderas. */
export function bandera(valor: unknown): boolean {
  return valor === true
}

/** Los elementos que son objetos. Lo demás de la lista se descarta. */
export function filas(valor: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(valor)) return []
  return valor.filter(
    (v): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v),
  )
}

/** Los elementos que son texto no vacío. Lo demás de la lista se descarta. */
export function textos(valor: unknown): readonly string[] {
  if (!Array.isArray(valor)) return []
  return valor.map(texto).filter(t => t !== '')
}

/** El número, o `undefined`. Acepta la cadena numérica: `jsonb` no distingue. */
export function numero(valor: unknown): number | undefined {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  if (typeof valor === 'string' && valor.trim() !== '') {
    const n = Number(valor)
    if (Number.isFinite(n)) return n
  }
  return undefined
}

// ─── La fecha ────────────────────────────────────────────────────────────────

const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
] as const

const MESES_CORTOS = [
  'ene', 'feb', 'mar', 'abr', 'may', 'jun',
  'jul', 'ago', 'sep', 'oct', 'nov', 'dic',
] as const

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/
const REDACTADA = /^(\d{1,2}) de ([a-záéíóúñ]+) de (\d{4})$/i

/**
 * Día, mes (0-11) y año, vengan en ISO o ya redactados.
 *
 * `null` cuando no es ninguna de las dos: hay `contenido` viejo con fechas de
 * otras formas y lo correcto entonces es imprimir la cadena tal cual, no
 * inventar una fecha ni dejar la ranura vacía.
 *
 * **No pasa por `Date`.** Un `new Date('2026-08-13')` se interpreta en UTC y en
 * México resta un día; el rodeo del mediodía que usan los formularios existe por
 * eso. Aquí no hay aritmética de calendario que hacer, así que no hace falta.
 */
function partesDeFecha(valor: string): { dia: number; mes: number; anio: string } | null {
  const iso = ISO.exec(valor)
  if (iso !== null) {
    const mes = Number(iso[2]) - 1
    if (mes < 0 || mes > 11) return null
    return { dia: Number(iso[3]), mes, anio: iso[1] }
  }

  const redactada = REDACTADA.exec(valor)
  if (redactada !== null) {
    const mes = MESES.indexOf(redactada[2].toLowerCase() as (typeof MESES)[number])
    if (mes < 0) return null
    return { dia: Number(redactada[1]), mes, anio: redactada[3] }
  }

  return null
}

/** `13 de agosto de 2026`. La forma de la hoja 1 (B.1 §2). */
export function fechaLarga(valor: unknown): string | undefined {
  const bruto = texto(valor)
  if (bruto === '') return undefined
  const p = partesDeFecha(bruto)
  return p === null ? bruto : `${p.dia} de ${MESES[p.mes]} de ${p.anio}`
}

/**
 * `13 ago 2026`. La forma del riel derecho del bloque de título.
 *
 * La celda de emisión mide la mitad de un riel de 156 pt, así que la forma larga
 * no cabe: la lámina compone ahí `4 ago 2026 · 11:05`. **Sin hora**, porque
 * ningún formulario del sistema la captura.
 */
export function fechaCorta(valor: unknown): string | undefined {
  const bruto = texto(valor)
  if (bruto === '') return undefined
  const p = partesDeFecha(bruto)
  return p === null ? bruto : `${p.dia} ${MESES_CORTOS[p.mes]} ${p.anio}`
}

// ─── El médico, su consultorio y su acento ───────────────────────────────────

/**
 * Las dos líneas de cédula, redactadas aquí: 2.B coloca, no rotula.
 *
 * Una cédula ausente **no deja línea vacía**: el membrete de un médico con
 * especialidad sin registrar imprime una sola. Que el perfil incompleto no
 * bloquee la emisión es el defecto de producto que `DOCUMENTOS_HANDOFF.md` §7.3
 * declara nivel 1 y que sigue abierto; este archivo no lo empeora ni lo tapa.
 */
function cedulas(medico: PdfMedicoData | null): readonly string[] {
  const lineas: string[] = []
  const profesional = texto(medico?.cedula_profesional)
  const especialidad = texto(medico?.cedula_especialidad)
  if (profesional !== '') lineas.push(`Céd. Prof. ${profesional}`)
  if (especialidad !== '') lineas.push(`Céd. Esp. ${especialidad}`)
  return lineas
}

/** 2.B · el médico del membrete. */
export function membrete(medico: PdfMedicoData | null): MedicoMembrete {
  return {
    nombre: texto(medico?.nombre),
    especialidad: texto(medico?.especialidad),
    universidad: texto(medico?.universidad),
    cedulas: cedulas(medico),
  }
}

/**
 * 2.B · el consultorio, con el teléfono YA ROTULADO.
 *
 * Manda el consultorio activo y el perfil es el respaldo: es el mismo orden de
 * precedencia que usan los seis renderizadores de v1, y el que hace que cambiar
 * de consultorio cambie el domicilio del papel.
 */
export function consultorioMembrete(
  medico: PdfMedicoData | null,
  consultorio?: PdfConsultorioData,
): ConsultorioMembrete {
  const domicilio = texto(consultorio?.direccion) || texto(medico?.direccion_consultorio)
  const telefono = texto(consultorio?.telefono) || texto(medico?.telefono_consultorio)
  return { domicilio, telefono: telefono === '' ? '' : `Tel. ${telefono}` }
}

/**
 * 2.A · el panel circular.
 *
 * Sin logo cae al monograma con las iniciales del nombre, y sin nombre se oculta:
 * un anillo con una letra inventada dentro es peor que no componerlo. `oculto` es
 * una variante del chasis, no una degradación.
 */
export function panel(
  medico: PdfMedicoData | null,
  logoUrl: string | undefined,
  acento: AcentoResuelto,
): PanelCircularProps {
  const logo = texto(logoUrl)
  if (logo !== '') return { variante: 'logo', acento, logo }

  /*
   * Las iniciales salen de las COLUMNAS ESTRUCTURADAS cuando las hay: `nombre` es
   * la línea del membrete y trae el título delante —`Dr. Ángel Ancona`—, así que
   * derivarlas de ahí compone `DÁ`, que no son las iniciales de nadie. Con el
   * nombre suelto se descartan los tratamientos, que es lo que acaba en punto.
   */
  const estructurado = [texto(medico?.nombres), texto(medico?.apellido_paterno)]
    .filter(p => p !== '')
  const partes = estructurado.length > 0
    ? estructurado
    : texto(medico?.nombre).split(/\s+/).filter(p => p.length > 1 && !p.endsWith('.'))

  const iniciales = partes.slice(0, 2).map(p => p[0].toUpperCase()).join('')

  return iniciales === '' ? { variante: 'oculto' } : { variante: 'monograma', acento, iniciales }
}

/**
 * El acento del médico: su color primario.
 *
 * `resolverAcento` deriva los cuatro valores con contraste garantizado y cae a
 * tinta negra si el hex no es válido, así que un perfil con el color corrupto
 * emite un documento en negro y no un documento roto.
 */
export function acentoDe(medico: PdfMedicoData | null): AcentoResuelto {
  const hex = texto(medico?.color_primario)
  return hex === '' ? resolverAcento() : resolverAcento(hex)
}

/**
 * El trazo autógrafo del médico, que en v1 viaja como `firma_url` — hoy siempre
 * una data-URL, porque el PDF se compone en el navegador y la imagen tiene que
 * ir dentro.
 */
export function rubricaDe(medico: PdfMedicoData | null): string | undefined {
  return textoOpcional(medico?.firma_url)
}

// ─── La envoltura ────────────────────────────────────────────────────────────

/**
 * Envuelve la hoja del formato en su `Document` **y registra las tipografías**.
 *
 * Los dos actos van juntos a propósito: un formato de v2 compuesto sin
 * `registrarFuentesV2()` sale con la fuente por defecto del renderer y **no
 * falla**, así que un adaptador que lo olvidara produciría un PDF plausible y
 * equivocado. Aquí no hay forma de olvidarlo.
 *
 * El `Page` lo devuelve el formato (2.M): la paginación de la banda de pie se lee
 * de `subPage*`, que cuenta las hojas de ese elemento.
 */
export function envolver(titulo: string, hoja: ReactElement): ReactElement<DocumentProps> {
  registrarFuentesV2()
  return <Document title={titulo}>{hoja}</Document>
}

/**
 * Las cuatro piezas que los nueve formatos reciben igual. Se arman una vez por
 * documento porque el acento se deriva con tres conversiones de color y el panel
 * lo necesita ya resuelto.
 */
export function comunes(entrada: EntradaAdaptador): {
  medico: MedicoMembrete
  consultorio: ConsultorioMembrete
  panel: PanelCircularProps
  acento: AcentoResuelto
} {
  const acento = acentoDe(entrada.medico)
  return {
    medico: membrete(entrada.medico),
    consultorio: consultorioMembrete(entrada.medico, entrada.consultorio),
    panel: panel(entrada.medico, entrada.logoUrl, acento),
    acento,
  }
}
