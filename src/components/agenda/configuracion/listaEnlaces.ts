/**
 * La lista de `GET /api/agenda/enlaces` tal como la usa la pantalla de
 * configuración: los enlaces vigentes, si hay secreto, si el aviso es
 * publicable y la `preparacion` por médico (tanda T2, punto 8). La pide
 * `ConfiguracionCalendario` una vez y la reparte: la lee la sección de enlaces
 * y la lista «Para empezar» (punto 7), así que no hay dos peticiones.
 *
 * Nombre distinto de cualquier componente de la carpeta (regla de mayúsculas
 * de `CLAUDE.md`).
 */
import { z } from 'zod'
import { MOTIVOS_APERTURA, type MotivoApertura } from '@/lib/reserva/aperturaEnlace'
import type { EnlaceReserva } from '@/lib/reserva/gestionReserva'

export interface ListaEnlaces {
  enlaces: EnlaceReserva[]
  secreto: boolean
  /** `false` = el aviso de la reserva está pendiente de revisión: no abre ningún enlace. */
  aviso: boolean
  /** Por médico, por qué su enlace no abriría. `null` = no se pudo calcular. */
  preparacion: Record<string, MotivoApertura[]> | null
}

export type EstadoLista = ListaEnlaces | 'error' | null

const PreparacionSchema = z.record(z.string(), z.array(z.enum(MOTIVOS_APERTURA))).nullable().catch(null)

/** La forma de cada enlace la fija `COLUMNAS_ENLACE`; aquí sólo se comprueba el sobre. */
export function leerLista(j: unknown): ListaEnlaces | null {
  if (!j || typeof j !== 'object' || !('enlaces' in j) || !Array.isArray(j.enlaces)) return null
  return {
    enlaces: j.enlaces,
    secreto: !('secreto' in j) || j.secreto !== false,
    aviso: !('aviso' in j) || j.aviso !== false,
    preparacion: 'preparacion' in j ? PreparacionSchema.parse(j.preparacion) : null,
  }
}

export async function cargarListaEnlaces(): Promise<ListaEnlaces | 'error'> {
  try {
    const res = await fetch('/api/agenda/enlaces', { cache: 'no-store' })
    if (!res.ok) return 'error'
    return leerLista(await res.json().catch(() => null)) ?? 'error'
  } catch {
    return 'error'
  }
}
